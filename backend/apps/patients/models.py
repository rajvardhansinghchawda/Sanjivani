# apps/patients/models.py
import uuid
from django.db import models


class Patient(models.Model):

    class Gender(models.TextChoices):
        MALE    = 'male',    'Male'
        FEMALE  = 'female',  'Female'
        OTHER   = 'other',   'Other'

    class BloodGroup(models.TextChoices):
        A_POS  = 'A+',  'A+'
        A_NEG  = 'A-',  'A-'
        B_POS  = 'B+',  'B+'
        B_NEG  = 'B-',  'B-'
        AB_POS = 'AB+', 'AB+'
        AB_NEG = 'AB-', 'AB-'
        O_POS  = 'O+',  'O+'
        O_NEG  = 'O-',  'O-'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # optional link to User account — patient may or may not register
    user            = models.OneToOneField(
        'authentication.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='patient_profile'
    )

    full_name       = models.CharField(max_length=150)
    phone           = models.CharField(max_length=15)
    email           = models.EmailField(null=True, blank=True)
    age             = models.PositiveIntegerField(null=True, blank=True)
    gender          = models.CharField(max_length=10, choices=Gender.choices, null=True, blank=True)
    blood_group     = models.CharField(max_length=5, choices=BloodGroup.choices, null=True, blank=True)
    address         = models.TextField(null=True, blank=True)
    city            = models.CharField(max_length=100, null=True, blank=True)
    area            = models.CharField(max_length=100, null=True, blank=True)

    # emergency contact
    emergency_contact_name  = models.CharField(max_length=150, null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=15,  null=True, blank=True)

    # medical history (brief — full records belong in a separate system)
    known_allergies  = models.TextField(null=True, blank=True)
    chronic_conditions = models.TextField(null=True, blank=True)

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'patients'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.phone})'

    @property
    def current_admission(self):
        """Returns active BedAllocation if patient is currently admitted."""
        return self.allocations.filter(discharged_at__isnull=True).first()

    @property
    def is_admitted(self):
        return self.current_admission is not None


class TransferRequest(models.Model):

    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        ACCEPTED  = 'accepted',  'Accepted'
        REJECTED  = 'rejected',  'Rejected'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class Priority(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH     = 'high',     'High'
        MEDIUM   = 'medium',   'Medium'
        LOW      = 'low',      'Low'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='transfer_requests')

    from_hospital   = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='outgoing_transfers'
    )
    to_hospital     = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='incoming_transfers',
        null=True, blank=True   # null until a hospital accepts
    )

    requested_by    = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='transfer_requests_made'
    )
    accepted_by     = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='transfer_requests_accepted'
    )

    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    priority        = models.CharField(max_length=20, choices=Priority.choices, default=Priority.HIGH)

    reason          = models.TextField()                        # why the transfer is needed
    required_bed_type = models.CharField(max_length=20, null=True, blank=True)  # what bed type is needed
    required_services = models.TextField(null=True, blank=True) # comma-separated service codes

    rejection_reason  = models.TextField(null=True, blank=True)
    notes             = models.TextField(null=True, blank=True)

    requested_at    = models.DateTimeField(auto_now_add=True)
    responded_at    = models.DateTimeField(null=True, blank=True)
    completed_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'transfer_requests'
        ordering = ['-requested_at']

    def __str__(self):
        return f'Transfer: {self.patient} from {self.from_hospital} [{self.status}]'

    @property
    def response_time_minutes(self):
        """How long it took to accept/reject the transfer."""
        if self.responded_at:
            delta = self.responded_at - self.requested_at
            return int(delta.total_seconds() / 60)
        return None