# apps/beds/models.py
import uuid
from django.db import models


class Bed(models.Model):

    class BedType(models.TextChoices):
        ICU        = 'icu',        'ICU'
        GENERAL    = 'general',    'General'
        VENTILATOR = 'ventilator', 'Ventilator'
        EMERGENCY  = 'emergency',  'Emergency'
        PRIVATE    = 'private',    'Private'
        SEMI_PVT   = 'semi_pvt',   'Semi-Private'

    class WardType(models.TextChoices):
        ICU_WARD     = 'icu_ward',     'ICU Ward'
        GENERAL_WARD = 'general_ward', 'General Ward'
        EMERGENCY    = 'emergency',    'Emergency Ward'
        PRIVATE_ROOM = 'private_room', 'Private Room'
        NICU         = 'nicu',         'NICU'
        PICU         = 'picu',         'PICU'

    class BedStatus(models.TextChoices):
        AVAILABLE   = 'available',   'Available'
        OCCUPIED    = 'occupied',    'Occupied'
        RESERVED    = 'reserved',    'Reserved'
        MAINTENANCE = 'maintenance', 'Under Maintenance'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital       = models.ForeignKey('hospitals.Hospital',   on_delete=models.CASCADE, related_name='beds')
    department     = models.ForeignKey('hospitals.Department', on_delete=models.CASCADE, related_name='beds', null=True, blank=True)
    bed_number     = models.CharField(max_length=20)
    bed_type       = models.CharField(max_length=20, choices=BedType.choices)
    ward_type      = models.CharField(max_length=20, choices=WardType.choices)
    status         = models.CharField(max_length=20, choices=BedStatus.choices, default=BedStatus.AVAILABLE)
    is_active      = models.BooleanField(default=True)
    notes          = models.TextField(null=True, blank=True)
    last_updated   = models.DateTimeField(auto_now=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table       = 'beds'
        unique_together = ('hospital', 'bed_number')
        ordering        = ['bed_number']

    def __str__(self):
        return f'{self.hospital.name} — Bed {self.bed_number} ({self.bed_type})'

    @property
    def is_available(self):
        return self.status == self.BedStatus.AVAILABLE

    @property
    def occupancy_days(self):
        """Returns how many days this bed has been occupied."""
        active = self.allocations.filter(discharged_at__isnull=True).first()
        if active:
            from django.utils import timezone
            delta = timezone.now() - active.admitted_at
            return delta.days
        return 0


class BedAllocation(models.Model):
    """Records every admit / discharge event for a bed."""

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bed          = models.ForeignKey(Bed, on_delete=models.CASCADE, related_name='allocations')
    patient      = models.ForeignKey('patients.Patient', on_delete=models.CASCADE, related_name='allocations')
    allocated_by = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, null=True, related_name='bed_allocations')
    admitted_at  = models.DateTimeField(auto_now_add=True)
    discharged_at= models.DateTimeField(null=True, blank=True)
    notes        = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'bed_allocations'
        ordering = ['-admitted_at']

    def __str__(self):
        return f'Bed {self.bed.bed_number} → {self.patient} ({self.admitted_at.date()})'

    @property
    def is_active(self):
        return self.discharged_at is None

    @property
    def duration_days(self):
        from django.utils import timezone
        end = self.discharged_at or timezone.now()
        return (end - self.admitted_at).days


class MedicalEquipment(models.Model):

    class EquipmentStatus(models.TextChoices):
        AVAILABLE   = 'available',   'Available'
        IN_USE      = 'in_use',      'In Use'
        MAINTENANCE = 'maintenance', 'Under Maintenance'
        INACTIVE    = 'inactive',    'Inactive'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital            = models.ForeignKey('hospitals.Hospital',   on_delete=models.CASCADE, related_name='equipment')
    department          = models.ForeignKey('hospitals.Department', on_delete=models.CASCADE, related_name='equipment', null=True, blank=True)
    name                = models.CharField(max_length=150)
    equipment_type      = models.CharField(max_length=100)   # Ventilator, MRI, CT Scan, Dialysis
    manufacturer        = models.CharField(max_length=150, null=True, blank=True)
    model_number        = models.CharField(max_length=100, null=True, blank=True)
    serial_number       = models.CharField(max_length=100, null=True, blank=True, unique=True)
    quantity            = models.PositiveIntegerField(default=1)
    available_quantity  = models.PositiveIntegerField(default=1)
    status              = models.CharField(max_length=20, choices=EquipmentStatus.choices, default=EquipmentStatus.AVAILABLE)
    last_used           = models.DateTimeField(null=True, blank=True)
    installation_date   = models.DateField(null=True, blank=True)
    next_maintenance    = models.DateField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medical_equipment'
        ordering = ['equipment_type', 'name']

    def __str__(self):
        return f'{self.hospital.name} — {self.name} ({self.equipment_type})'