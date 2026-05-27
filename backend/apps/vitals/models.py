"""
apps/vitals/models.py — Phase 19: Vital Signs Tracking
"""
from django.db import models
from shared.models import BaseModel


VITAL_TYPES = [
    ('BP_SYSTOLIC',  'Blood Pressure Systolic (mmHg)'),
    ('BP_DIASTOLIC', 'Blood Pressure Diastolic (mmHg)'),
    ('GLUCOSE',      'Blood Glucose (mg/dL)'),
    ('SPO2',         'Oxygen Saturation (%)'),
    ('WEIGHT',       'Weight (kg)'),
    ('HEART_RATE',   'Heart Rate (bpm)'),
    ('TEMPERATURE',  'Body Temperature (°C)'),
    ('RESPIRATORY',  'Respiratory Rate (breaths/min)'),
]

VITAL_SOURCES = [
    ('MANUAL',     'Manual Entry'),
    ('DEVICE',     'IoT Device'),
    ('HEALTHKIT',  'Apple HealthKit'),
    ('GOOGLEFIT',  'Google Fit'),
]


class VitalReading(BaseModel):
    patient         = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='vitals_readings')
    vital_type      = models.CharField(max_length=20, choices=VITAL_TYPES, db_index=True)
    value           = models.DecimalField(max_digits=8, decimal_places=2)
    unit            = models.CharField(max_length=20)
    recorded_at     = models.DateTimeField(db_index=True)
    source          = models.CharField(max_length=15, choices=VITAL_SOURCES, default='MANUAL')
    device_brand    = models.CharField(max_length=100, null=True, blank=True)
    prescription    = models.ForeignKey('clinical.Prescription', null=True, blank=True, on_delete=models.SET_NULL, related_name='vital_readings')
    notes           = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'vitals_readings'
        indexes  = [models.Index(fields=['patient', 'vital_type', 'recorded_at'])]
        ordering = ['-recorded_at']

    def __str__(self):
        return f'{self.vital_type}={self.value}{self.unit} ({self.patient})'


class VitalTarget(BaseModel):
    patient         = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='vital_targets')
    vital_type      = models.CharField(max_length=20, choices=VITAL_TYPES)
    target_min      = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    target_max      = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    set_by_doctor   = models.BooleanField(default=False)
    set_by          = models.ForeignKey('identity.User', on_delete=models.PROTECT, null=True, blank=True, related_name='+')

    class Meta:
        db_table = 'vitals_targets'
        unique_together = ('patient', 'vital_type')

    def __str__(self):
        return f'{self.vital_type} target for {self.patient}'
