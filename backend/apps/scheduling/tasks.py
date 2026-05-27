"""
apps/scheduling/tasks.py — Celery tasks for reminder dispatch and adherence computation.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('medadhere')


@shared_task(name='apps.scheduling.tasks.fill_reminder_window')
def fill_reminder_window():
    """Hourly: generate ReminderJob rows for the next 7-day rolling window."""
    from .services import ScheduleGenerationService
    created = ScheduleGenerationService.fill_rolling_window()
    logger.info(f'fill_reminder_window: {created} reminder jobs created.')
    return {'created': created}


@shared_task(name='apps.scheduling.tasks.dispatch_due_reminders')
def dispatch_due_reminders():
    """
    Every 2 min: find PENDING/SNOOZED reminders that are now due.
    Dispatches push notifications via NotificationService.
    """
    from .models import ReminderJob
    now   = timezone.now()
    jobs  = ReminderJob.objects.filter(
        status='PENDING',
        window_start__lte=now,
        scheduled_at__gte=now - __import__('datetime').timedelta(minutes=60),
    ).select_related(
        'schedule__prescription__patient__user',
        'schedule__prescription__medication',
    )

    dispatched = 0
    for job in jobs:
        try:
            _dispatch_single_reminder.delay(str(job.id))
            dispatched += 1
        except Exception as e:
            logger.error(f'Dispatch failed for job={job.id}: {e}')

    # Also re-dispatch snoozed ones
    snoozed = ReminderJob.objects.filter(
        status='SNOOZED',
        snooze_until__lte=now,
    )
    for job in snoozed:
        job.status = 'PENDING'
        job.save(update_fields=['status', 'updated_at'])
        try:
            _dispatch_single_reminder.delay(str(job.id))
            dispatched += 1
        except Exception as e:
            logger.error(f'Snoozed dispatch failed for job={job.id}: {e}')

    return {'dispatched': dispatched}


@shared_task(name='apps.scheduling.tasks._dispatch_single_reminder')
def _dispatch_single_reminder(job_id: str):
    """Dispatch a single reminder push notification."""
    from .models import ReminderJob
    from apps.notifications.services import NotificationDispatcher
    
    try:
        job = ReminderJob.objects.select_related(
            'schedule__prescription__patient__user',
            'schedule__prescription__medication',
        ).get(id=job_id, status='PENDING')
    except ReminderJob.DoesNotExist:
        return

    patient  = job.schedule.prescription.patient
    med_name = job.schedule.prescription.medication.name

    logger.info(
        f'REMINDER: patient={patient.patient_code} med={med_name} '
        f'time={job.scheduled_at.isoformat()} dose={job.dose_value}{job.dose_unit}'
    )

    NotificationDispatcher.dispatch(
        user=patient.user,
        notification_type='DOSE_REMINDER',
        title=f"Time to take {med_name}",
        body=f"Please take {job.dose_value} {job.dose_unit} of {med_name}.",
        data={
            'reminder_id': str(job.id),
            'prescription_id': str(job.schedule.prescription.id),
        },
        idempotency_key=f"reminder_{job.id}"
    )

    job.status  = 'SENT'
    job.sent_at = timezone.now()
    job.save(update_fields=['status', 'sent_at', 'updated_at'])


@shared_task(name='apps.scheduling.tasks.mark_missed_reminders')
def mark_missed_reminders():
    """
    Every 5 min: mark doses as MISSED only after 2 hours past their scheduled_at time.
    After marking MISSED: sends in-app notification + Twilio voice call to each caregiver.
    """
    import datetime as dt
    from .models import ReminderJob
    from apps.clinical.models import PatientCaregiverLink
    from apps.notifications.services import NotificationDispatcher
    from apps.notifications.twilio_service import call_caregiver_missed_dose

    now    = timezone.now()
    # A dose is only MISSED 2 hours after it was scheduled — gives patient time
    cutoff = now - dt.timedelta(hours=2)

    missed_jobs = ReminderJob.objects.filter(
        status__in=['PENDING', 'SENT'],
        scheduled_at__lte=cutoff,
    ).select_related(
        'schedule__prescription__patient__user',
        'schedule__prescription__medication',
    )

    count = 0
    for job in missed_jobs:
        job.status = 'MISSED'
        job.save(update_fields=['status', 'updated_at'])
        count += 1

        try:
            patient  = job.schedule.prescription.patient
            med_name = job.schedule.prescription.medication.name
            # Format scheduled time in local-friendly string for voice call
            dose_time_str = job.scheduled_at.strftime('%I:%M %p')

            alert_caregivers = PatientCaregiverLink.objects.filter(
                patient=patient, is_active=True, can_receive_alerts=True
            ).select_related('caregiver__user')

            for link in alert_caregivers:
                caregiver_user = link.caregiver.user

                # 1. In-app / push notification
                logger.info(
                    f'MISSED DOSE alert → caregiver={caregiver_user.email} '
                    f'patient={patient.patient_code} med={med_name}'
                )
                NotificationDispatcher.dispatch(
                    user=caregiver_user,
                    notification_type='MISSED_DOSE_ALERT',
                    title=f"Missed Dose: {patient.user.full_name}",
                    body=(
                        f"{patient.user.full_name} missed their {med_name} dose "
                        f"scheduled at {dose_time_str}."
                    ),
                    data={
                        'reminder_id': str(job.id),
                        'patient_id':  str(patient.id),
                    },
                    idempotency_key=f"missed_alert_{job.id}_{link.caregiver.id}"
                )

                # 2. Twilio voice call — placed as a background Celery sub-task
                #    so a slow Twilio API doesn't block this loop
                _call_caregiver_twilio.delay(
                    caregiver_phone=caregiver_user.phone_number or '',
                    patient_name=patient.user.full_name,
                    med_name=med_name,
                    dose_time=dose_time_str,
                )

        except Exception as e:
            logger.error(f'Caregiver alert failed for job={job.id}: {e}')

    return {'marked_missed': count}


@shared_task(name='apps.scheduling.tasks._call_caregiver_twilio')
def _call_caregiver_twilio(caregiver_phone: str, patient_name: str, med_name: str, dose_time: str):
    """Fire-and-forget Twilio voice call to a caregiver about a missed dose."""
    from apps.notifications.twilio_service import call_caregiver_missed_dose
    call_caregiver_missed_dose(caregiver_phone, patient_name, med_name, dose_time)


@shared_task(name='apps.scheduling.tasks.compute_daily_adherence')
def compute_daily_adherence():
    """Nightly: compute and upsert AdherenceSummary rows for all active patients."""
    from apps.clinical.models import Patient
    from .services import AdherenceReportService
    from .models import AdherenceSummary
    from django.utils import timezone as tz
    import datetime

    today     = tz.now().date()
    yesterday = today - datetime.timedelta(days=1)
    patients  = Patient.objects.filter(deleted_at__isnull=True, user__is_active=True)

    updated = 0
    for patient in patients:
        prescriptions = patient.prescriptions.filter(is_active=True, deleted_at__isnull=True)
        for rx in prescriptions:
            summary = AdherenceReportService.get_summary(patient, days=1)
            obj, _ = AdherenceSummary.objects.update_or_create(
                patient      = patient,
                prescription = rx,
                period_start = yesterday,
                period_type  = 'daily',
                defaults={
                    'period_end':       today,
                    'scheduled_count':  summary['total_scheduled'],
                    'taken_count':      summary['taken'],
                    'missed_count':     summary['missed'],
                    'skipped_count':    summary['skipped'],
                    'adherence_pct':    summary['adherence_pct'],
                }
            )
            updated += 1

    return {'summaries_updated': updated}


@shared_task(name='apps.scheduling.tasks.check_refill_alerts')
def check_refill_alerts():
    """Daily: check for active prescriptions with low pill count and notify."""
    from apps.clinical.models import Prescription, PatientCaregiverLink
    from apps.notifications.services import NotificationDispatcher

    # Identify prescriptions running low
    low_prescriptions = Prescription.objects.filter(
        is_active=True,
        current_pill_count__lte=4,
        compartment_number__isnull=False
    ).select_related('patient__user', 'medication')

    alerts_sent = 0
    for rx in low_prescriptions:
        patient = rx.patient
        med_name = rx.medication.name
        
        # Notify the patient
        NotificationDispatcher.dispatch(
            user=patient.user,
            notification_type='REFILL_ALERT',
            title=f"Low Stock: {med_name}",
            body=f"You only have {rx.current_pill_count} pills left for {med_name}. Please refill soon.",
            data={'prescription_id': str(rx.id)},
            idempotency_key=f"refill_patient_{rx.id}_{timezone.now().date()}"
        )
        alerts_sent += 1

        # Notify caregivers
        caregivers = PatientCaregiverLink.objects.filter(
            patient=patient, is_active=True, can_receive_alerts=True
        ).select_related('caregiver__user')

        for link in caregivers:
            NotificationDispatcher.dispatch(
                user=link.caregiver.user,
                notification_type='REFILL_ALERT',
                title=f"Refill Needed: {patient.user.full_name}",
                body=f"Patient {patient.user.full_name} has only {rx.current_pill_count} pills left of {med_name}.",
                data={
                    'prescription_id': str(rx.id),
                    'patient_id': str(patient.id),
                },
                idempotency_key=f"refill_caregiver_{rx.id}_{link.caregiver.id}_{timezone.now().date()}"
            )
            alerts_sent += 1

    return {'refill_alerts_sent': alerts_sent}


@shared_task(name='apps.scheduling.tasks.generate_next_day_reminders')
def generate_next_day_reminders():
    """
    Runs every night at 12:01 AM.

    For every active prescription that is still within its duration:
      - Generate ReminderJob rows for the NEXT day only.
      - Never touch past records — history is always preserved.

    Also auto-deactivates prescriptions whose end_date has passed today.
    """
    import datetime
    import pytz
    from apps.clinical.models import MedicationSchedule, Prescription
    from .services import ScheduleGenerationService

    today_utc = timezone.now().date()
    jobs_created = 0
    expired_count = 0

    # ── Step 1: Auto-deactivate prescriptions whose end_date has passed ──────
    expired = Prescription.objects.filter(
        is_active=True,
        is_indefinite=False,
        end_date__lt=today_utc,
        deleted_at__isnull=True,
    )
    for rx in expired:
        rx.is_active = False
        rx.save(update_fields=['is_active', 'updated_at'])
        expired_count += 1

        # Deactivate all schedules under this prescription
        MedicationSchedule.objects.filter(
            prescription=rx, is_active=True
        ).update(is_active=False)

        logger.info(
            f'Auto-deactivated expired prescription: rx={rx.id} '
            f'medication={rx.medication.name} patient={rx.patient.patient_code} '
            f'end_date={rx.end_date}'
        )

    # ── Step 2: Generate NEXT DAY's jobs for all still-active schedules ───────
    schedules = MedicationSchedule.objects.filter(
        is_active=True,
        prescription__is_active=True,
        prescription__deleted_at__isnull=True,
    ).select_related('prescription__patient', 'prescription__medication')

    for schedule in schedules:
        rx = schedule.prescription

        # Respect prescription end_date — don't generate beyond it
        patient_tz = pytz.timezone(schedule.timezone or 'Asia/Kolkata')
        tomorrow_local = (timezone.now().astimezone(patient_tz) + datetime.timedelta(days=1)).date()

        if not rx.is_indefinite and rx.end_date and tomorrow_local > rx.end_date:
            # Tomorrow is past end_date — nothing to generate
            continue

        try:
            # days=2 generates today+tomorrow; since today's jobs already exist
            # (get_or_create is idempotent), only truly missing ones get created.
            created = ScheduleGenerationService.generate_upcoming_reminders(schedule, days=2)
            jobs_created += created
        except Exception as e:
            logger.error(
                f'generate_next_day_reminders failed for schedule={schedule.id}: {e}'
            )

    logger.info(
        f'generate_next_day_reminders: {jobs_created} jobs created, '
        f'{expired_count} prescriptions expired.'
    )
    return {'jobs_created': jobs_created, 'expired_prescriptions': expired_count}
