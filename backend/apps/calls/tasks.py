# apps/calls/tasks.py
from celery import shared_task


@shared_task
def send_transfer_notification_call(transfer_id: str):
    """
    Triggered automatically when a transfer request is accepted.
    Calls the receiving hospital's reception with patient details.
    """
    from apps.patients.models import TransferRequest
    from apps.calls.models import CallLog
    from apps.calls.services import make_transfer_notification_call

    try:
        transfer = TransferRequest.objects.select_related(
            'patient', 'from_hospital', 'to_hospital'
        ).get(pk=transfer_id, status='accepted')
    except TransferRequest.DoesNotExist:
        return f'Transfer {transfer_id} not found or not accepted'

    to_hospital = transfer.to_hospital
    if not to_hospital or not to_hospital.phone:
        return f'Receiving hospital has no phone number'

    phone = to_hospital.phone.strip().replace(' ', '').replace('-', '')
    if not phone.startswith('+'):
        phone = f'+91{phone}'

    call_log = CallLog.objects.create(
        call_type        = CallLog.CallType.TRANSFER_NOTIFICATION,
        to_number        = phone,
        transfer_request = transfer,
    )

    try:
        sid = make_transfer_notification_call(phone, transfer_id)
        call_log.twilio_call_sid = sid
        call_log.status          = CallLog.Status.RINGING
        call_log.save()
        return f'Call initiated to {to_hospital.name} — SID: {sid}'
    except Exception as e:
        call_log.status = CallLog.Status.FAILED
        call_log.save()
        return f'Call failed: {str(e)}'

@shared_task
def send_transfer_alert_call(transfer_id: str):
    """
    Triggered automatically when a transfer request is created.
    Calls the receiving hospital's reception with patient details and bed priority.
    """
    from apps.patients.models import TransferRequest
    from apps.calls.models import CallLog
    from apps.calls.services import make_transfer_alert_call

    try:
        transfer = TransferRequest.objects.select_related(
            'patient', 'from_hospital', 'to_hospital'
        ).get(pk=transfer_id) # Status is usually 'pending' at creation
    except TransferRequest.DoesNotExist:
        return f'Transfer {transfer_id} not found'

    to_hospital = transfer.to_hospital
    if not to_hospital or not to_hospital.phone:
        return f'Receiving hospital has no phone number'

    phone = to_hospital.phone.strip().replace(' ', '').replace('-', '')
    if not phone.startswith('+'):
        phone = f'+91{phone}'

    call_log = CallLog.objects.create(
        call_type        = CallLog.CallType.TRANSFER_NOTIFICATION,
        to_number        = phone,
        transfer_request = transfer,
    )

    try:
        sid = make_transfer_alert_call(phone, transfer_id)
        call_log.twilio_call_sid = sid
        call_log.status          = CallLog.Status.RINGING
        call_log.save()
        return f'Alert Call initiated to {to_hospital.name} — SID: {sid}'
    except Exception as e:
        call_log.status = CallLog.Status.FAILED
        call_log.save()
        return f'Alert Call failed: {str(e)}'