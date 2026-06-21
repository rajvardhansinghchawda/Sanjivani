# apps/supervisors/tasks.py
from celery import shared_task
from django.utils import timezone
from django.db.models import Q


@shared_task
def check_long_occupancy_beds():
    """
    Runs every hour via Celery beat.
    Raises an alert for any bed occupied more than 20 days
    that doesn't already have an open alert.
    """
    from apps.beds.models import BedAllocation
    from .models import Alert

    threshold = timezone.now() - timezone.timedelta(days=20)

    long_occupancy = BedAllocation.objects.filter(
        discharged_at__isnull=True,
        admitted_at__lte=threshold
    ).select_related('bed__hospital', 'bed__department', 'patient')

    created_count = 0

    for allocation in long_occupancy:
        bed      = allocation.bed
        hospital = bed.hospital
        days     = (timezone.now() - allocation.admitted_at).days

        # skip if open alert already exists for this bed
        already_alerted = Alert.objects.filter(
            bed=bed,
            alert_type=Alert.AlertType.BED_LONG_OCCUPANCY,
            status__in=[Alert.Status.OPEN, Alert.Status.INVESTIGATING]
        ).exists()

        if not already_alerted:
            Alert.objects.create(
                hospital   = hospital,
                bed        = bed,
                department = bed.department,
                alert_type = Alert.AlertType.BED_LONG_OCCUPANCY,
                severity   = Alert.Severity.HIGH if days > 30 else Alert.Severity.MEDIUM,
                status     = Alert.Status.OPEN,
                title      = f'Bed {bed.bed_number} occupied for {days} days',
                description= (
                    f'Patient {allocation.patient.full_name} has been in '
                    f'bed {bed.bed_number} ({bed.bed_type}) for {days} days. '
                    f'Admitted on {allocation.admitted_at.date()}. Please verify.'
                ),
                meta_data  = {
                    'bed_id'       : str(bed.id),
                    'bed_number'   : bed.bed_number,
                    'patient_id'   : str(allocation.patient.id),
                    'patient_name' : allocation.patient.full_name,
                    'days_occupied': days,
                    'admitted_at'  : str(allocation.admitted_at.date()),
                }
            )
            created_count += 1

    return f'Long occupancy check complete. {created_count} new alerts raised.'


@shared_task
def check_resource_mismatches():
    """
    Runs every 4 hours.
    Compares live bed counts from DB against latest
    ResourceAvailability snapshot. Flags discrepancies.
    """
    from apps.hospitals.models import Hospital
    from apps.beds.models import Bed
    from .models import Alert, ResourceAvailability
    from django.db.models import Count, Q as DQ

    hospitals = Hospital.objects.filter(
        status='active',
        verification_status='verified'
    )

    created_count = 0

    for hospital in hospitals:
        # actual available beds from DB
        actual = Bed.objects.filter(
            hospital=hospital,
            is_active=True,
            status='available'
        ).count()

        # latest snapshot reported by reception
        latest_snapshot = ResourceAvailability.objects.filter(
            hospital=hospital,
            resource_type=ResourceAvailability.ResourceType.BED
        ).order_by('-recorded_at').first()

        if not latest_snapshot:
            continue

        reported = latest_snapshot.available_count
        diff     = abs(actual - reported)

        # flag if difference is more than 5 beds or 20% of total
        threshold = max(5, int(hospital.total_beds * 0.20))

        if diff > threshold:
            already_open = Alert.objects.filter(
                hospital=hospital,
                alert_type=Alert.AlertType.RESOURCE_MISMATCH,
                status__in=[Alert.Status.OPEN, Alert.Status.INVESTIGATING]
            ).exists()

            if not already_open:
                Alert.objects.create(
                    hospital   = hospital,
                    alert_type = Alert.AlertType.RESOURCE_MISMATCH,
                    severity   = Alert.Severity.HIGH,
                    title      = f'Bed count mismatch at {hospital.name}',
                    description= (
                        f'Reported available beds: {reported}. '
                        f'Actual count in system: {actual}. '
                        f'Difference of {diff} beds detected.'
                    ),
                    meta_data  = {
                        'reported_available': reported,
                        'actual_available'  : actual,
                        'difference'        : diff,
                        'snapshot_at'       : str(latest_snapshot.recorded_at),
                    }
                )
                created_count += 1

    return f'Resource mismatch check complete. {created_count} alerts raised.'


@shared_task
def check_pending_hospital_verifications():
    """
    Runs daily.
    Raises an alert for hospitals pending verification
    for more than 7 days.
    """
    from apps.hospitals.models import HospitalRegistration
    from .models import Alert

    threshold = timezone.now() - timezone.timedelta(days=7)

    pending = HospitalRegistration.objects.filter(
        status='pending',
        registration_date__lte=threshold.date()
    ).select_related('hospital')

    created_count = 0

    for reg in pending:
        already_open = Alert.objects.filter(
            hospital=reg.hospital,
            alert_type=Alert.AlertType.HOSPITAL_VERIFICATION_DUE,
            status__in=[Alert.Status.OPEN, Alert.Status.INVESTIGATING]
        ).exists()

        if not already_open:
            Alert.objects.create(
                hospital   = reg.hospital,
                alert_type = Alert.AlertType.HOSPITAL_VERIFICATION_DUE,
                severity   = Alert.Severity.MEDIUM,
                title      = f'Verification pending: {reg.hospital.name}',
                description= (
                    f'{reg.hospital.name} has been awaiting verification '
                    f'since {reg.registration_date}. Please review.'
                ),
                meta_data  = {
                    'registration_date': str(reg.registration_date),
                    'hospital_category': reg.hospital.category,
                }
            )
            created_count += 1

    return f'Verification check complete. {created_count} alerts raised.'


@shared_task
def check_transfer_delays():
    """
    Runs every 2 hours.
    Flags PENDING transfer requests older than 2 hours —
    no hospital has accepted them yet.
    """
    from apps.patients.models import TransferRequest
    from .models import Alert

    threshold = timezone.now() - timezone.timedelta(hours=2)

    delayed = TransferRequest.objects.filter(
        status=TransferRequest.Status.PENDING,
        requested_at__lte=threshold
    ).select_related('patient', 'from_hospital')

    created_count = 0

    for transfer in delayed:
        hours = round(
            (timezone.now() - transfer.requested_at).total_seconds() / 3600, 1
        )

        already_open = Alert.objects.filter(
            hospital=transfer.from_hospital,
            alert_type=Alert.AlertType.TRANSFER_DELAY,
            status__in=[Alert.Status.OPEN, Alert.Status.INVESTIGATING],
            meta_data__transfer_id=str(transfer.id)
        ).exists()

        if not already_open:
            Alert.objects.create(
                hospital   = transfer.from_hospital,
                alert_type = Alert.AlertType.TRANSFER_DELAY,
                severity   = Alert.Severity.HIGH if transfer.priority == 'critical' else Alert.Severity.MEDIUM,
                title      = f'Transfer unaccepted for {hours}h — {transfer.patient.full_name}',
                description= (
                    f'Transfer request for patient {transfer.patient.full_name} '
                    f'(priority: {transfer.priority}) from {transfer.from_hospital.name} '
                    f'has been pending for {hours} hours with no accepting hospital.'
                ),
                meta_data  = {
                    'transfer_id' : str(transfer.id),
                    'patient_id'  : str(transfer.patient.id),
                    'patient_name': transfer.patient.full_name,
                    'priority'    : transfer.priority,
                    'hours_pending': hours,
                }
            )
            created_count += 1

    return f'Transfer delay check complete. {created_count} alerts raised.'\
    
# apps/supervisors/tasks.py — add below check_transfer_delays

@shared_task
def check_missing_resource_updates():
    """
    Runs every hour via Celery beat.
    Checks if any active hospital's reception has NOT logged
    a ResourceAvailability snapshot in the last 12 hours.
    If silent → raises a MISSING_DATA alert.
    """
    from apps.hospitals.models import Hospital
    from apps.supervisors.models import ResourceAvailability, Alert

    silence_threshold = timezone.now() - timezone.timedelta(hours=12)
    created_count     = 0

    active_hospitals = Hospital.objects.filter(
        status='active',
        verification_status='verified'
    )

    for hospital in active_hospitals:

        latest_update = ResourceAvailability.objects.filter(
            hospital=hospital
        ).order_by('-recorded_at').first()

        is_silent = (
            latest_update is None or
            latest_update.recorded_at < silence_threshold
        )

        if not is_silent:
            continue

        # skip if an open alert already exists for this hospital
        already_alerted = Alert.objects.filter(
            hospital   = hospital,
            alert_type = Alert.AlertType.MISSING_DATA,
            status__in = [Alert.Status.OPEN, Alert.Status.INVESTIGATING]
        ).exists()

        if already_alerted:
            continue

        # calculate how many hours silent
        if latest_update:
            silent_hours = round(
                (timezone.now() - latest_update.recorded_at).total_seconds() / 3600, 1
            )
            last_update_at = str(latest_update.recorded_at)
            updated_by     = latest_update.updated_by.full_name if latest_update.updated_by else 'Unknown'
        else:
            silent_hours   = 'Never updated'
            last_update_at = 'Never'
            updated_by     = 'None'

        Alert.objects.create(
            hospital   = hospital,
            alert_type = Alert.AlertType.MISSING_DATA,
            severity   = Alert.Severity.HIGH if silent_hours == 'Never updated' or float(str(silent_hours).replace('Never updated','24')) > 24 else Alert.Severity.MEDIUM,
            status     = Alert.Status.OPEN,
            title      = f'No resource update from {hospital.name} for {silent_hours}h',
            description= (
                f'Reception at {hospital.name} ({hospital.city}) has not logged '
                f'any resource availability update for {silent_hours} hours. '
                f'Last update was at {last_update_at} by {updated_by}. '
                f'Please verify staff are actively maintaining data.'
            ),
            meta_data  = {
                'hospital_id'   : str(hospital.id),
                'silent_hours'  : silent_hours,
                'last_update_at': last_update_at,
                'last_updated_by': updated_by,
                'threshold_hours': 12,
            }
        )
        created_count += 1

    return f'Missing update check done. {created_count} new alerts raised.'