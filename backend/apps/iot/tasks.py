"""
apps/iot/tasks.py — Background Celery tasks for IoT device monitoring.
Phase 3 & 4: Priority scheduler, missed dose alerts, refill alerts, daily flag reset.
"""
import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name='apps.iot.tasks.run_priority_scheduler')
def run_priority_scheduler():
    """
    Phase 3: Run every 2 minutes via Celery Beat.
    Scans all HIGH priority compartments and queues PREPARE_COMPARTMENT if due.
    """
    from apps.iot.services import PriorityScheduler
    PriorityScheduler.run_for_all_devices()


@shared_task(name='apps.iot.tasks.check_device_heartbeats')
def check_device_heartbeats():
    """Run every 5 minutes. Detect offline devices and broadcast alert."""
    from apps.iot.models import Device
    threshold = timezone.now() - timedelta(minutes=15)
    offline_devices = Device.objects.filter(
        is_active=True, last_seen_at__lt=threshold, last_seen_at__isnull=False
    )
    for device in offline_devices:
        logger.warning("Device offline: %s (last_seen=%s)", device.id, device.last_seen_at)
        try:
            from agenthandover import AgentOrchestrator, AgentName, AgentEvent, HandoverPayload
            orchestrator = AgentOrchestrator()
            orchestrator.broadcast(
                AgentName.IOT, AgentEvent.DEVICE_OFFLINE,
                HandoverPayload(
                    user_id=str(device.user_id), device_id=str(device.id),
                    data={'device_name': device.device_name,
                          'last_seen': device.last_seen_at.isoformat(),
                          'battery_level': device.battery_level},
                )
            )
        except Exception as exc:
            logger.warning("Orchestrator unavailable: %s", exc)


@shared_task(name='apps.iot.tasks.push_schedule_to_device')
def push_schedule_to_device(device_id: str):
    """Queue SYNC_SCHEDULE when prescription/schedule changes."""
    from apps.iot.models import Device, DeviceCommand
    from apps.iot.services import get_device_schedule
    try:
        device = Device.objects.get(id=device_id, is_active=True)
    except Device.DoesNotExist:
        return
    schedule = get_device_schedule(device)
    expires_hours = 1 if device.is_online() else 24
    DeviceCommand.objects.create(
        device=device, command_type='SYNC_SCHEDULE',
        payload={'schedule': schedule},
        expires_at=timezone.now() + timedelta(hours=expires_hours),
    )


@shared_task(name='apps.iot.tasks.send_caregiver_missed_dose_alert')
def send_caregiver_missed_dose_alert(mapping_id: str):
    """
    Phase 4: Called when DOSE_TIMEOUT received.
    Sends WhatsApp + SMS to caregiver if set.
    """
    from apps.iot.models import DeviceCompartmentMapping
    try:
        mapping = DeviceCompartmentMapping.objects.select_related('device').get(id=mapping_id)
    except DeviceCompartmentMapping.DoesNotExist:
        return

    if mapping.missed_dose_alert_sent:
        return

    device = mapping.device
    caregiver_phone = device.caregiver_phone
    caregiver_name = device.caregiver_name or 'Caregiver'
    patient_name = str(device.user)
    med_name = mapping.medication_name or 'medication'

    message = (
        f"⚠️ MedAdhere Alert!\n"
        f"Patient *{patient_name}* missed their dose of *{med_name}* "
        f"(Compartment {mapping.compartment_number}).\n"
        f"Please check on them immediately."
    )

    if caregiver_phone:
        try:
            _send_whatsapp(caregiver_phone, message)
            logger.info("Caregiver alert sent to %s for device %s", caregiver_phone, device.id)
        except Exception as exc:
            logger.error("Failed to send caregiver alert: %s", exc)

    # Mark alert sent so we don't spam
    mapping.missed_dose_alert_sent = True
    mapping.save(update_fields=['missed_dose_alert_sent'])


@shared_task(name='apps.iot.tasks.send_refill_alert')
def send_refill_alert(mapping_id: str):
    """
    Phase 4: Triggered when pills_remaining <= 3 days.
    Alerts patient + optionally sends WhatsApp order to chemist.
    """
    from apps.iot.models import DeviceCompartmentMapping
    try:
        mapping = DeviceCompartmentMapping.objects.select_related('device__user').get(id=mapping_id)
    except DeviceCompartmentMapping.DoesNotExist:
        return

    if mapping.refill_alert_sent:
        return

    device = mapping.device
    med_name = mapping.medication_name or 'medication'
    days_left = mapping.pills_days_remaining()

    # Alert patient
    patient_message = (
        f"💊 MedAdhere Refill Alert!\n"
        f"Your *{med_name}* in compartment {mapping.compartment_number} "
        f"has only *{days_left} day(s)* remaining.\n"
        f"Please refill soon."
    )

    try:
        # Try to get patient phone
        patient = getattr(device.user, 'patient_profile', None)
        patient_phone = getattr(patient, 'phone', None) if patient else None
        if patient_phone:
            _send_whatsapp(patient_phone, patient_message)
    except Exception as exc:
        logger.error("Patient refill alert failed: %s", exc)

    # Auto-order to chemist
    chemist_phone = device.chemist_phone
    if chemist_phone:
        chemist_message = (
            f"🏥 MedAdhere Auto-Order\n"
            f"Patient needs refill: *{med_name}*\n"
            f"Please prepare 1 month supply.\n"
            f"Contact: {device.user}"
        )
        try:
            _send_whatsapp(chemist_phone, chemist_message)
            logger.info("Chemist refill order sent to %s", chemist_phone)
        except Exception as exc:
            logger.error("Chemist auto-order failed: %s", exc)

    mapping.refill_alert_sent = True
    mapping.save(update_fields=['refill_alert_sent'])


@shared_task(name='apps.iot.tasks.reset_daily_dispense_flags')
def reset_daily_dispense_flags():
    """
    Phase 2: Run at midnight (00:00) every day.
    Sends RESET_FLAGS command to all active online devices.
    Also resets missed_dose_alert_sent on all compartments.
    """
    from apps.iot.models import Device, DeviceCommand, DeviceCompartmentMapping
    devices = Device.objects.filter(is_active=True)
    for device in devices:
        DeviceCommand.objects.create(
            device=device,
            command_type='RESET_FLAGS',
            payload={'reset_date': timezone.now().date().isoformat()},
            expires_at=timezone.now() + timedelta(hours=2),
        )
    # Reset missed dose alert flags for today
    DeviceCompartmentMapping.objects.filter(missed_dose_alert_sent=True).update(
        missed_dose_alert_sent=False
    )
    logger.info("RESET_FLAGS queued for %d devices", devices.count())


@shared_task(name='apps.iot.tasks.expire_stale_commands')
def expire_stale_commands():
    """Run hourly. Mark expired PENDING/SENT commands as EXPIRED."""
    from apps.iot.models import DeviceCommand
    count, _ = DeviceCommand.objects.filter(
        status__in=['PENDING', 'SENT'],
        expires_at__lt=timezone.now(),
    ).update(status='EXPIRED')
    if count:
        logger.info("Expired %d stale device commands", count)


@shared_task(name='apps.iot.tasks.check_missed_doses_30min')
def check_missed_doses_30min():
    """
    Phase 4: Run every 5 minutes.
    If a compartment was prepared 30+ min ago and no DOSE_TAKEN received → alert.
    """
    from apps.iot.models import DeviceCompartmentMapping
    threshold = timezone.now() - timedelta(minutes=30)
    overdue = DeviceCompartmentMapping.objects.filter(
        last_dose_prepared_at__lte=threshold,
        last_dose_prepared_at__isnull=False,
        missed_dose_alert_sent=False,
    )
    for mapping in overdue:
        send_caregiver_missed_dose_alert.delay(str(mapping.id))


def _send_whatsapp(phone: str, message: str):
    """
    Internal helper. Uses Twilio WhatsApp or local stub.
    Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in env.
    """
    import os
    sid = os.environ.get('TWILIO_ACCOUNT_SID')
    token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')

    if not sid or not token:
        logger.warning("[WhatsApp STUB] To: %s | Msg: %s", phone, message)
        return

    from twilio.rest import Client
    client = Client(sid, token)
    client.messages.create(
        from_=from_number,
        to=f'whatsapp:{phone}',
        body=message,
    )
