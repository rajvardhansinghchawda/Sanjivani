"""
apps/telemetry/tasks.py
"""
import logging
from celery import shared_task

logger = logging.getLogger('medadhere')


@shared_task(name='apps.telemetry.tasks.process_telemetry_event')
def process_telemetry_event(event_id: str):
    from .models import TelemetryEvent
    from .services import TelemetryIngestService
    try:
        event = TelemetryEvent.objects.select_related('device__patient__user').get(id=event_id)
        TelemetryIngestService.process_event(event)
    except TelemetryEvent.DoesNotExist:
        logger.error(f'TelemetryEvent {event_id} not found.')
    except Exception as e:
        logger.error(f'process_telemetry_event failed for {event_id}: {e}')
        raise


@shared_task(name='apps.telemetry.tasks.detect_consecutive_misses')
def detect_consecutive_misses():
    """Hourly: detect patients with 3+ consecutive missed doses."""
    from .services import ConsecutiveMissDetector
    ConsecutiveMissDetector.run()


@shared_task(name='apps.telemetry.tasks.detect_offline_devices')
def detect_offline_devices():
    """Daily: flag IoT devices not seen in 24h."""
    from .models import IoTDevice
    from .services import TelemetryIngestService
    from django.utils import timezone
    import datetime

    threshold = timezone.now() - datetime.timedelta(hours=24)
    offline = IoTDevice.objects.filter(is_active=True, last_seen_at__lt=threshold)
    for device in offline:
        TelemetryIngestService._raise_anomaly(
            patient=device.patient,
            anomaly_type='DEVICE_OFFLINE',
            severity='WARNING',
            description=f'Device {device.device_name} has been offline for >24 hours.',
            metadata={'device_id': str(device.id)},
        )
