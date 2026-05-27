"""
apps/telemetry/models.py — IoT device telemetry, vital signs, anomaly events.
"""
from django.db import models
from shared.models import BaseModel


class DeviceType(models.TextChoices):
    PILL_DISPENSER  = 'PILL_DISPENSER',  'Smart Pill Dispenser'
    SMARTWATCH      = 'SMARTWATCH',      'Smartwatch'
    BP_MONITOR      = 'BP_MONITOR',      'Blood Pressure Monitor'
    GLUCOSE_METER   = 'GLUCOSE_METER',   'Glucose Meter'
    PULSE_OXIMETER  = 'PULSE_OXIMETER',  'Pulse Oximeter'
    WEIGHT_SCALE    = 'WEIGHT_SCALE',    'Smart Weight Scale'
    THERMOMETER     = 'THERMOMETER',     'Smart Thermometer'
    OTHER           = 'OTHER',           'Other'


# ─── IoT Device Registry ──────────────────────────────────────────────────────
class IoTDevice(BaseModel):
    patient        = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='iot_devices')
    device_type    = models.CharField(max_length=30, choices=DeviceType.choices)
    device_name    = models.CharField(max_length=200)
    hardware_id    = models.CharField(max_length=200, unique=True, db_index=True)
    firmware_version = models.CharField(max_length=50, blank=True, null=True)
    api_key_hash   = models.CharField(max_length=200)         # HMAC-SHA256 of device key
    is_active      = models.BooleanField(default=True)
    last_seen_at   = models.DateTimeField(null=True, blank=True)
    battery_level  = models.SmallIntegerField(null=True, blank=True)   # 0-100%
    signal_strength = models.SmallIntegerField(null=True, blank=True)  # RSSI dBm
    compartments   = models.SmallIntegerField(default=7)               # pill dispenser: # compartments
    meta           = models.JSONField(default=dict)

    class Meta:
        db_table = 'telemetry_iot_devices'

    def __str__(self):
        return f'{self.device_type} — {self.hardware_id} ({self.patient.patient_code})'


# ─── Telemetry Event (raw ingest) ─────────────────────────────────────────────
class TelemetryEventType(models.TextChoices):
    HEARTBEAT         = 'HEARTBEAT',         'Device Heartbeat'
    DOOR_OPENED       = 'DOOR_OPENED',        'Compartment Door Opened'
    DOSE_DISPENSED    = 'DOSE_DISPENSED',     'Dose Dispensed'
    DOSE_NOT_TAKEN    = 'DOSE_NOT_TAKEN',     'Dose Dispensed But Not Taken'
    BUTTON_PRESS      = 'BUTTON_PRESS',       'Patient Confirmation Button'
    LOW_BATTERY       = 'LOW_BATTERY',        'Low Battery'
    MEDICATION_LOADED = 'MEDICATION_LOADED',  'Medication Reloaded'
    ALERT_TRIGGERED   = 'ALERT_TRIGGERED',    'Device Alert'
    VITAL_READING     = 'VITAL_READING',      'Vital Sign Reading'
    TAMPER            = 'TAMPER',             'Tamper Detected'


class TelemetryEvent(BaseModel):
    device         = models.ForeignKey(IoTDevice, on_delete=models.CASCADE, related_name='events')
    event_type     = models.CharField(max_length=30, choices=TelemetryEventType.choices)
    occurred_at    = models.DateTimeField(db_index=True)
    payload        = models.JSONField(default=dict)   # raw device payload
    is_processed   = models.BooleanField(default=False)
    idempotency_key = models.CharField(max_length=200, unique=True, db_index=True)  # prevents duplicate ingest
    sequence_no    = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = 'telemetry_events'
        indexes  = [
            models.Index(fields=['device', 'occurred_at']),
            models.Index(fields=['is_processed', 'event_type']),
        ]
        ordering = ['-occurred_at']

    def __str__(self):
        return f'{self.event_type} @ {self.occurred_at} [{self.device.hardware_id}]'


# ─── Vital Sign Reading ───────────────────────────────────────────────────────
class VitalType(models.TextChoices):
    HEART_RATE      = 'HEART_RATE',      'Heart Rate (bpm)'
    BLOOD_PRESSURE  = 'BLOOD_PRESSURE',  'Blood Pressure (mmHg)'
    SPO2            = 'SPO2',            'Oxygen Saturation (%)'
    GLUCOSE         = 'GLUCOSE',         'Blood Glucose (mg/dL)'
    TEMPERATURE     = 'TEMPERATURE',     'Body Temperature (°C)'
    WEIGHT          = 'WEIGHT',          'Weight (kg)'
    RESPIRATORY_RATE = 'RESPIRATORY_RATE', 'Respiratory Rate (breaths/min)'


class VitalReading(BaseModel):
    patient        = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='vital_readings')
    device         = models.ForeignKey(IoTDevice, on_delete=models.SET_NULL, null=True, blank=True, related_name='vital_readings')
    vital_type     = models.CharField(max_length=30, choices=VitalType.choices)
    value_primary  = models.DecimalField(max_digits=8, decimal_places=2)
    value_secondary = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)  # for BP: diastolic
    unit           = models.CharField(max_length=20)
    recorded_at    = models.DateTimeField(db_index=True)
    source         = models.CharField(max_length=20, choices=[('IOT','IoT'),('MANUAL','Manual'),('APP','App')], default='IOT')
    is_abnormal    = models.BooleanField(default=False)
    notes          = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'telemetry_vital_readings'
        indexes  = [
            models.Index(fields=['patient', 'vital_type', 'recorded_at']),
        ]
        ordering = ['-recorded_at']


# ─── Anomaly / Alert ──────────────────────────────────────────────────────────
class AnomalyType(models.TextChoices):
    CONSECUTIVE_MISSES = 'CONSECUTIVE_MISSES', 'Consecutive Missed Doses'
    VITAL_SPIKE        = 'VITAL_SPIKE',        'Vital Sign Spike'
    DEVICE_OFFLINE     = 'DEVICE_OFFLINE',     'Device Offline'
    LOW_REFILL         = 'LOW_REFILL',         'Low Medication Refill'
    TAMPER             = 'TAMPER',             'Device Tamper'


class Anomaly(BaseModel):
    patient        = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='anomalies')
    anomaly_type   = models.CharField(max_length=30, choices=AnomalyType.choices)
    severity       = models.CharField(max_length=20, choices=[('INFO','Info'),('WARNING','Warning'),('CRITICAL','Critical')], default='WARNING')
    description    = models.TextField()
    is_resolved    = models.BooleanField(default=False)
    resolved_at    = models.DateTimeField(null=True, blank=True)
    resolved_by    = models.ForeignKey('identity.User', on_delete=models.SET_NULL, null=True, blank=True)
    metadata       = models.JSONField(default=dict)

    class Meta:
        db_table = 'telemetry_anomalies'
        ordering = ['-created_at']
