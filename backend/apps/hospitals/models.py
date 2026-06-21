# apps/hospitals/models.py
import uuid
from django.db import models


class Hospital(models.Model):

    class Category(models.TextChoices):
        GOVERNMENT = 'government', 'Government'
        PRIVATE    = 'private',    'Private'
        TRUST      = 'trust',      'Trust'
        TRAUMA     = 'trauma',     'Trauma Center'

    class HospitalType(models.TextChoices):
        MULTISPECIALTY = 'multispecialty', 'Multispecialty'
        SPECIALTY      = 'specialty',      'Specialty'
        CLINIC         = 'clinic',         'Clinic'

    class Status(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        INACTIVE = 'inactive', 'Inactive'

    class VerificationStatus(models.TextChoices):
        VERIFIED = 'verified', 'Verified'
        PENDING  = 'pending',  'Pending'
        REJECTED = 'rejected', 'Rejected'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                = models.CharField(max_length=255)
    category            = models.CharField(max_length=20, choices=Category.choices)
    hospital_type       = models.CharField(max_length=20, choices=HospitalType.choices)

    # location
    address             = models.TextField()
    city                = models.CharField(max_length=100)
    area                = models.CharField(max_length=100)
    district            = models.CharField(max_length=100)
    state               = models.CharField(max_length=100)
    pincode             = models.CharField(max_length=10)
    latitude            = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude           = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # capacity
    total_beds          = models.PositiveIntegerField(default=0)
    icu_capacity        = models.PositiveIntegerField(default=0)

    # contact
    phone               = models.CharField(max_length=15)
    email               = models.EmailField(null=True, blank=True)
    website             = models.URLField(null=True, blank=True)

    # status
    status              = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    verification_status = models.CharField(max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING)
    registration_date   = models.DateField(null=True, blank=True)
    license_number      = models.CharField(max_length=100, null=True, blank=True)

    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hospitals'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.city})'


class Department(models.Model):

    class DeptType(models.TextChoices):
        ICU        = 'icu',        'ICU'
        EMERGENCY  = 'emergency',  'Emergency'
        GENERAL    = 'general',    'General Ward'
        SURGERY    = 'surgery',    'Surgery'
        CARDIOLOGY = 'cardiology', 'Cardiology'
        NEUROLOGY  = 'neurology',  'Neurology'
        PEDIATRICS = 'pediatrics', 'Pediatrics'
        ONCOLOGY   = 'oncology',   'Oncology'
        ORTHOPEDIC = 'orthopedic', 'Orthopedics'
        RADIOLOGY  = 'radiology',  'Radiology'
        PATHOLOGY  = 'pathology',  'Pathology'
        OTHER      = 'other',      'Other'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital   = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='departments')
    name       = models.CharField(max_length=150)
    dept_type  = models.CharField(max_length=20, choices=DeptType.choices, default=DeptType.OTHER)
    floor      = models.CharField(max_length=20, null=True, blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'departments'
        unique_together = ('hospital', 'name')
        ordering = ['name']

    def __str__(self):
        return f'{self.hospital.name} — {self.name}'


class ServiceCategory(models.Model):
    """
    Top-level grouping — e.g. Imaging, Diagnostics,
    ICU & Critical Care, Surgery, Blood & Transfusion
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'service_categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class ServiceMaster(models.Model):
    """
    Individual service defined once by admin.
    e.g. MRI Scan, CT Scan, Blood Bank, Pathology Lab
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category    = models.ForeignKey(ServiceCategory, on_delete=models.CASCADE, related_name='services')
    name        = models.CharField(max_length=150)
    code        = models.CharField(max_length=30, unique=True)  # e.g. IMG_MRI
    description = models.TextField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'service_master'
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.code} — {self.name}'


class HospitalService(models.Model):
    """
    Junction table — which services a hospital offers.
    Created when hospital selects services during registration.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital     = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='services')
    service      = models.ForeignKey(ServiceMaster, on_delete=models.CASCADE, related_name='hospital_services')
    is_available = models.BooleanField(default=True)
    notes        = models.CharField(max_length=255, null=True, blank=True)  # e.g. "MRI available Mon–Sat only"
    added_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hospital_services'
        unique_together = ('hospital', 'service')

    def __str__(self):
        return f'{self.hospital.name} — {self.service.name}'


class HospitalRegistration(models.Model):
    """
    Tracks the registration + verification lifecycle
    of a hospital joining the platform.
    """
    class RegistrationStatus(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital            = models.OneToOneField(Hospital, on_delete=models.CASCADE, related_name='registration')
    verified_by         = models.ForeignKey(
        'authentication.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='verified_hospitals'
    )
    status              = models.CharField(max_length=20, choices=RegistrationStatus.choices, default=RegistrationStatus.PENDING)
    license_document    = models.FileField(upload_to='hospital_docs/', null=True, blank=True)
    rejection_reason    = models.TextField(null=True, blank=True)
    registration_date   = models.DateField(auto_now_add=True)
    verification_date   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hospital_registrations'

    def __str__(self):
        return f'{self.hospital.name} — {self.status}'

# apps/hospitals/models.py  — add below HospitalRegistration

class Doctor(models.Model):

    class Specialization(models.TextChoices):
        CARDIOLOGY   = 'cardiology',   'Cardiology'
        NEUROLOGY    = 'neurology',    'Neurology'
        ORTHOPEDICS  = 'orthopedics',  'Orthopedics'
        ONCOLOGY     = 'oncology',     'Oncology'
        PEDIATRICS   = 'pediatrics',   'Pediatrics'
        GENERAL      = 'general',      'General Medicine'
        SURGERY      = 'surgery',      'Surgery'
        RADIOLOGY    = 'radiology',    'Radiology'
        EMERGENCY    = 'emergency',    'Emergency Medicine'
        ICU          = 'icu',          'Intensive Care'
        NEPHROLOGY   = 'nephrology',   'Nephrology'
        OTHER        = 'other',        'Other'

    class Status(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        INACTIVE = 'inactive', 'Inactive'
        ON_LEAVE = 'on_leave', 'On Leave'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital        = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='doctors')
    department      = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctors')

    full_name       = models.CharField(max_length=150)
    registration_no = models.CharField(max_length=50, unique=True)   # medical council reg number
    specialization  = models.CharField(max_length=30, choices=Specialization.choices)
    qualification   = models.CharField(max_length=200, null=True, blank=True)  # MBBS, MD etc.
    phone           = models.CharField(max_length=15, null=True, blank=True)
    email           = models.EmailField(null=True, blank=True)
    experience_years= models.PositiveIntegerField(default=0)
    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'doctors'
        ordering = ['full_name']

    def __str__(self):
        return f'Dr. {self.full_name} — {self.specialization} ({self.hospital.name})'

    @property
    def is_on_duty_now(self):
        """Check if doctor has an active duty schedule right now."""
        from django.utils import timezone
        now = timezone.now()
        return self.duty_schedules.filter(
            shift_start__lte=now,
            shift_end__gte=now,
            is_active=True
        ).exists()


class DutySchedule(models.Model):

    class ShiftType(models.TextChoices):
        MORNING  = 'morning',  'Morning  (6am–2pm)'
        EVENING  = 'evening',  'Evening  (2pm–10pm)'
        NIGHT    = 'night',    'Night    (10pm–6am)'
        FULL_DAY = 'full_day', 'Full Day (24hr)'
        CUSTOM   = 'custom',   'Custom'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor      = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='duty_schedules')
    department  = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='duty_schedules')
    shift_type  = models.CharField(max_length=20, choices=ShiftType.choices)
    shift_start = models.DateTimeField()
    shift_end   = models.DateTimeField()
    is_active   = models.BooleanField(default=True)
    notes       = models.TextField(null=True, blank=True)
    created_by  = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_schedules'
    )
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'duty_schedules'
        ordering = ['shift_start']

    def __str__(self):
        return f'Dr. {self.doctor.full_name} — {self.shift_type} ({self.shift_start.date()})'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.shift_end <= self.shift_start:
            raise ValidationError('Shift end must be after shift start')