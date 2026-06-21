# apps/ambulances/models.py
import uuid
from django.db import models


class Ambulance(models.Model):

    class AmbulanceType(models.TextChoices):
        BASIC    = 'basic',    'Basic Life Support'
        ADVANCED = 'advanced', 'Advanced Life Support'
        ICU      = 'icu',      'ICU Ambulance'
        NEONATAL = 'neonatal', 'Neonatal'
        MORTUARY = 'mortuary', 'Mortuary'

    class Status(models.TextChoices):
        AVAILABLE   = 'available',   'Available'
        ON_TRIP     = 'on_trip',     'On Trip'
        MAINTENANCE = 'maintenance', 'Under Maintenance'
        INACTIVE    = 'inactive',    'Inactive'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital         = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='ambulances',
        null=True, blank=True   # some ambulances are independent providers
    )

    # vehicle details
    vehicle_number   = models.CharField(max_length=20, unique=True)
    ambulance_type   = models.CharField(max_length=20, choices=AmbulanceType.choices)

    # driver details
    driver           = models.OneToOneField(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ambulance',
        limit_choices_to={'role': 'ambulance'}
    )
    driver_name      = models.CharField(max_length=150)
    driver_phone     = models.CharField(max_length=15)
    driver_license   = models.CharField(max_length=50, null=True, blank=True)

    # location (updated by driver in real time via Redis)
    city             = models.CharField(max_length=100)
    area             = models.CharField(max_length=100, null=True, blank=True)
    latitude         = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude        = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # stats
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    trips_completed  = models.PositiveIntegerField(default=0)
    service_rating   = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    is_active        = models.BooleanField(default=True)

    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ambulances'
        ordering = ['city', 'ambulance_type']

    def __str__(self):
        return f'{self.vehicle_number} ({self.ambulance_type}) — {self.city}'


class AmbulanceRequest(models.Model):

    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        ACCEPTED  = 'accepted',  'Accepted'
        EN_ROUTE  = 'en_route',  'En Route to Patient'
        PICKED_UP = 'picked_up', 'Patient Picked Up'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class RequestSource(models.TextChoices):
        PATIENT   = 'patient',   'Patient Portal'
        RECEPTION = 'reception', 'Reception Portal'

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ambulance            = models.ForeignKey(
        Ambulance,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='requests'
    )
    patient              = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='ambulance_requests'
    )
    destination_hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ambulance_requests'
    )

    # pickup details
    pickup_address       = models.TextField()
    pickup_latitude      = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_longitude     = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    pickup_city          = models.CharField(max_length=100)

    ambulance_type       = models.CharField(max_length=20, choices=Ambulance.AmbulanceType.choices, default=Ambulance.AmbulanceType.BASIC)
    status               = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source               = models.CharField(max_length=20, choices=RequestSource.choices, default=RequestSource.PATIENT)

    # contact
    requester_name       = models.CharField(max_length=150)
    requester_phone      = models.CharField(max_length=15)

    # timing
    requested_at         = models.DateTimeField(auto_now_add=True)
    accepted_at          = models.DateTimeField(null=True, blank=True)
    picked_up_at         = models.DateTimeField(null=True, blank=True)
    completed_at         = models.DateTimeField(null=True, blank=True)

    # stats
    response_time_sec    = models.PositiveIntegerField(null=True, blank=True)  # accept - request
    trip_duration_sec    = models.PositiveIntegerField(null=True, blank=True)  # complete - pickup
    patient_rating       = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-5
    notes                = models.TextField(null=True, blank=True)
    cancellation_reason  = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'ambulance_requests'
        ordering = ['-requested_at']

    def __str__(self):
        return f'Request {self.id} — {self.status} — {self.requester_name}'

    @property
    def response_time_minutes(self):
        if self.response_time_sec:
            return round(self.response_time_sec / 60, 1)
        return None

    @property
    def trip_duration_minutes(self):
        if self.trip_duration_sec:
            return round(self.trip_duration_sec / 60, 1)
        return None