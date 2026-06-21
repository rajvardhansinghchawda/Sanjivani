# apps/supervisors/models.py
import uuid
from django.db import models


class Alert(models.Model):

    class AlertType(models.TextChoices):
        BED_LONG_OCCUPANCY          = 'bed_long_occupancy',         'Bed Long Occupancy'
        RESOURCE_MISMATCH           = 'resource_mismatch',          'Resource Mismatch'
        DATA_INCONSISTENCY          = 'data_inconsistency',         'Data Inconsistency'
        HOSPITAL_VERIFICATION_DUE   = 'hospital_verification_due',  'Hospital Verification Due'
        SUSPICIOUS_BED_PATTERN      = 'suspicious_bed_pattern',     'Suspicious Bed Pattern'
        MISSING_DATA                = 'missing_data',               'Missing Data'
        TRANSFER_DELAY              = 'transfer_delay',             'Transfer Delay'
        EQUIPMENT_MAINTENANCE_DUE   = 'equipment_maintenance_due',  'Equipment Maintenance Due'

    class Severity(models.TextChoices):
        HIGH   = 'high',   'High'
        MEDIUM = 'medium', 'Medium'
        LOW    = 'low',    'Low'

    class Status(models.TextChoices):
        OPEN          = 'open',          'Open'
        INVESTIGATING = 'investigating', 'Investigating'
        RESOLVED      = 'resolved',      'Resolved'
        DISMISSED     = 'dismissed',     'Dismissed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    hospital     = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    raised_by    = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='raised_alerts'
    )
    resolved_by  = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='resolved_alerts'
    )

    # optional references to specific resources
    bed          = models.ForeignKey(
        'beds.Bed',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='alerts'
    )
    department   = models.ForeignKey(
        'hospitals.Department',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='alerts'
    )

    alert_type   = models.CharField(max_length=40, choices=AlertType.choices)
    severity     = models.CharField(max_length=10, choices=Severity.choices)
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)

    title        = models.CharField(max_length=255)
    description  = models.TextField()
    resolution_note = models.TextField(null=True, blank=True)

    # auto-raised alerts carry metadata
    meta_data    = models.JSONField(default=dict, blank=True)

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    resolved_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'alerts'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.severity.upper()}] {self.title} — {self.hospital.name}'

    @property
    def duration_hours(self):
        from django.utils import timezone
        end = self.resolved_at or timezone.now()
        return round((end - self.created_at).total_seconds() / 3600, 1)

    @property
    def is_open(self):
        return self.status == self.Status.OPEN


class ResourceAvailability(models.Model):
    """
    Snapshot of a hospital's resource availability
    at a given point in time.
    Used by supervisor to detect mismatches between
    reported and actual availability.
    """

    class ResourceType(models.TextChoices):
        BED         = 'bed',         'Bed'
        VENTILATOR  = 'ventilator',  'Ventilator'
        ICU_BED     = 'icu_bed',     'ICU Bed'
        OXYGEN      = 'oxygen',      'Oxygen'
        BLOOD       = 'blood',       'Blood'
        EQUIPMENT   = 'equipment',   'Equipment'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital            = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='resource_snapshots'
    )
    department          = models.ForeignKey(
        'hospitals.Department',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='resource_snapshots'
    )
    updated_by          = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='resource_updates'
    )

    resource_type       = models.CharField(max_length=20, choices=ResourceType.choices)
    total_count         = models.PositiveIntegerField(default=0)
    available_count     = models.PositiveIntegerField(default=0)
    availability_status = models.CharField(
        max_length=20,
        choices=[('available', 'Available'), ('unavailable', 'Unavailable'), ('limited', 'Limited')],
        default='available'
    )
    notes               = models.TextField(null=True, blank=True)
    recorded_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'resource_availability'
        ordering = ['-recorded_at']

    def __str__(self):
        return f'{self.hospital.name} — {self.resource_type} ({self.available_count}/{self.total_count})'