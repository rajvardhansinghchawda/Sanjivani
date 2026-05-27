"""
apps/telemetry/services.py — Telemetry ingest, vital analysis, anomaly detection.
"""
import hashlib
import logging
from decimal import Decimal
from django.utils import timezone

logger = logging.getLogger('medadhere')


# ─── Vital thresholds for anomaly detection ───────────────────────────────────
VITAL_THRESHOLDS = {
    'HEART_RATE':       {'low': 40,   'high': 130},
    'SPO2':             {'low': 90,   'high': 100},
    'GLUCOSE':          {'low': 70,   'high': 250},
    'TEMPERATURE':      {'low': 35.0, 'high': 38.5},
    'WEIGHT':           {'low': 30,   'high': 200},
    'RESPIRATORY_RATE': {'low': 10,   'high': 30},
}


class TelemetryIngestService:
    """
    Hardware-optional design: all events are idempotent.
    Duplicate events (same idempotency_key) are silently ignored.
    """

    @staticmethod
    def ingest(device, event_type: str, payload: dict, occurred_at=None,
               idempotency_key: str = None, sequence_no: int = None):
        from .models import TelemetryEvent

        if not idempotency_key:
            raw = f'{device.hardware_id}:{event_type}:{occurred_at or timezone.now().isoformat()}'
            idempotency_key = hashlib.sha256(raw.encode()).hexdigest()

        event, created = TelemetryEvent.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                'device':       device,
                'event_type':   event_type,
                'occurred_at':  occurred_at or timezone.now(),
                'payload':      payload,
                'sequence_no':  sequence_no,
            }
        )

        if not created:
            logger.debug(f'Duplicate event ignored: {idempotency_key}')
            return event

        # Update device heartbeat
        device.last_seen_at = occurred_at or timezone.now()
        battery = payload.get('battery_level')
        if battery is not None:
            device.battery_level = int(battery)
        device.save(update_fields=['last_seen_at', 'battery_level', 'updated_at'])

        # Async processing
        from .tasks import process_telemetry_event
        process_telemetry_event.delay(str(event.id))

        return event

    @staticmethod
    def process_event(event):
        """Dispatched async — routes event to relevant handler."""
        from .models import TelemetryEventType
        from apps.scheduling.models import ReminderJob
        from apps.scheduling.services import DoseLoggingService

        handlers = {
            TelemetryEventType.DOSE_DISPENSED:  TelemetryIngestService._handle_dose_dispensed,
            TelemetryEventType.VITAL_READING:   TelemetryIngestService._handle_vital_reading,
            TelemetryEventType.LOW_BATTERY:     TelemetryIngestService._handle_low_battery,
            TelemetryEventType.TAMPER:          TelemetryIngestService._handle_tamper,
        }

        handler = handlers.get(event.event_type)
        if handler:
            handler(event)

        event.is_processed = True
        event.save(update_fields=['is_processed', 'updated_at'])

    @staticmethod
    def _handle_dose_dispensed(event):
        """Auto-log TAKEN for matching reminder when dispenser fires."""
        from apps.scheduling.models import ReminderJob
        from apps.scheduling.services import DoseLoggingService

        patient       = event.device.patient
        prescription_id = event.payload.get('prescription_id')
        occurred_at   = event.occurred_at

        # Find nearest PENDING reminder within ±90 min
        from django.db.models import functions
        import datetime

        window_start = occurred_at - datetime.timedelta(minutes=90)
        window_end   = occurred_at + datetime.timedelta(minutes=90)

        job = ReminderJob.objects.filter(
            schedule__prescription__patient=patient,
            scheduled_at__gte=window_start,
            scheduled_at__lte=window_end,
            status='PENDING',
        ).order_by('scheduled_at').first()

        if job:
            try:
                DoseLoggingService.log_dose(
                    reminder_job=job,
                    user=patient.user,
                    status='TAKEN',
                    source='IOT',
                    taken_at=occurred_at,
                    notes='Auto-logged by IoT pill dispenser.',
                )
                logger.info(f'IoT dose auto-logged for patient={patient.patient_code}')
            except ValueError as e:
                logger.warning(f'IoT dose log failed: {e}')

    @staticmethod
    def _handle_vital_reading(event):
        """Parse and store vital readings, check thresholds."""
        from .models import VitalReading

        patient    = event.device.patient
        vital_type = event.payload.get('vital_type', 'HEART_RATE')
        value_primary = Decimal(str(event.payload.get('value', 0)))
        value_secondary = event.payload.get('value2')
        unit = event.payload.get('unit', '')

        thresholds   = VITAL_THRESHOLDS.get(vital_type, {})
        is_abnormal  = (
            (thresholds.get('low') and value_primary < thresholds['low']) or
            (thresholds.get('high') and value_primary > thresholds['high'])
        )

        reading = VitalReading.objects.create(
            patient         = patient,
            device          = event.device,
            vital_type      = vital_type,
            value_primary   = value_primary,
            value_secondary = Decimal(str(value_secondary)) if value_secondary is not None else None,
            unit            = unit,
            recorded_at     = event.occurred_at,
            source          = 'IOT',
            is_abnormal     = is_abnormal,
        )

        if is_abnormal:
            TelemetryIngestService._raise_anomaly(
                patient=patient,
                anomaly_type='VITAL_SPIKE',
                severity='CRITICAL' if abs(value_primary - thresholds.get('high', value_primary)) > 20 else 'WARNING',
                description=f'Abnormal {vital_type}: {value_primary}{unit}',
                metadata={'vital_reading_id': str(reading.id), 'vital_type': vital_type},
            )

    @staticmethod
    def _handle_low_battery(event):
        patient = event.device.patient
        TelemetryIngestService._raise_anomaly(
            patient=patient,
            anomaly_type='DEVICE_OFFLINE',
            severity='WARNING',
            description=f'Device {event.device.device_name} battery low ({event.device.battery_level}%).',
            metadata={'device_id': str(event.device.id)},
        )

    @staticmethod
    def _handle_tamper(event):
        patient = event.device.patient
        TelemetryIngestService._raise_anomaly(
            patient=patient,
            anomaly_type='TAMPER',
            severity='CRITICAL',
            description=f'Tamper detected on device {event.device.device_name}.',
            metadata={'device_id': str(event.device.id)},
        )

    @staticmethod
    def _raise_anomaly(patient, anomaly_type, severity, description, metadata=None):
        from .models import Anomaly
        anomaly = Anomaly.objects.create(
            patient      = patient,
            anomaly_type = anomaly_type,
            severity     = severity,
            description  = description,
            metadata     = metadata or {},
        )
        try:
            from agenthandover import get_orchestrator, AgentName, AgentEvent, HandoverPayload
            payload = HandoverPayload(
                patient_id=str(patient.id),
                data={
                    'anomaly_id':   str(anomaly.id),
                    'anomaly_type': anomaly_type,
                    'severity':     severity,
                }
            )
            get_orchestrator().broadcast(AgentName.IOT, AgentEvent.SYSTEM_ALERT, payload)
        except Exception:
            pass


class ConsecutiveMissDetector:
    """Detect patients who missed 3+ consecutive doses → anomaly."""

    @staticmethod
    def run():
        from apps.clinical.models import Patient
        from apps.scheduling.models import ReminderJob
        from .models import Anomaly

        patients = Patient.objects.filter(deleted_at__isnull=True)
        for patient in patients:
            recent = ReminderJob.objects.filter(
                schedule__prescription__patient=patient,
                status__in=['MISSED', 'TAKEN'],
            ).order_by('-scheduled_at')[:5]

            consecutive = sum(1 for j in recent if j.status == 'MISSED')
            if consecutive >= 3:
                already_open = Anomaly.objects.filter(
                    patient=patient,
                    anomaly_type='CONSECUTIVE_MISSES',
                    is_resolved=False,
                ).exists()
                if not already_open:
                    TelemetryIngestService._raise_anomaly(
                        patient=patient,
                        anomaly_type='CONSECUTIVE_MISSES',
                        severity='CRITICAL',
                        description=f'Patient {patient.patient_code} missed {consecutive} consecutive doses.',
                        metadata={'count': consecutive},
                    )
