"""
apps/clinical/tasks.py — Celery tasks for clinical events.
"""
import logging
from celery import shared_task

logger = logging.getLogger('medadhere')


@shared_task(name='apps.clinical.tasks.send_refill_alerts')
def send_refill_alerts():
    """
    Daily 9AM: check prescriptions where remaining_quantity <= refill_alert_days threshold.
    """
    from .models import Prescription
    from django.db.models import F

    low_stock = Prescription.objects.filter(
        is_active=True,
        deleted_at__isnull=True,
        remaining_quantity__isnull=False,
        remaining_quantity__lte=F('refill_alert_days'),
    ).select_related('patient__user', 'medication')

    sent = 0
    for rx in low_stock:
        try:
            # TODO: dispatch via NotificationService (Phase 7)
            logger.info(
                f'Refill alert: patient={rx.patient.patient_code} '
                f'medication={rx.medication.name} remaining={rx.remaining_quantity}'
            )
            sent += 1
        except Exception as e:
            logger.error(f'Refill alert failed for rx={rx.id}: {e}')

    return {'refill_alerts_sent': sent}


@shared_task(name='apps.clinical.tasks.check_prescription_expiries')
def check_prescription_expiries():
    """Daily: mark expired prescriptions as inactive and cancel their reminders."""
    from django.utils import timezone
    from .models import Prescription
    from apps.scheduling.models import ReminderJob

    today = timezone.now().date()
    expired = Prescription.objects.filter(
        is_active=True,
        deleted_at__isnull=True,
        is_indefinite=False,
        end_date__lt=today,
    )

    count = 0
    for rx in expired:
        rx.is_active = False
        rx.save(update_fields=['is_active', 'updated_at'])
        ReminderJob.objects.filter(schedule__prescription=rx, status='PENDING').update(status='CANCELLED')
        count += 1

    return {'prescriptions_expired': count}
