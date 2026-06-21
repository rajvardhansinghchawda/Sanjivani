# apps/resources/models.py
import uuid
from django.db import models

class ResourceSharingRequest(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        ACCEPTED  = 'accepted',  'Accepted'
        REJECTED  = 'rejected',  'Rejected'
        SHIPPED   = 'shipped',   'Shipped'
        RECEIVED  = 'received',  'Received'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class Priority(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH     = 'high',     'High'
        MEDIUM   = 'medium',   'Medium'
        LOW      = 'low',      'Low'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    requester_hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='resource_requests_sent'
    )
    provider_hospital = models.ForeignKey(
        'hospitals.Hospital',
        on_delete=models.CASCADE,
        related_name='resource_requests_received',
        null=True, blank=True
    )
    
    equipment_type = models.CharField(max_length=100) # e.g. Ultrasound, Defibrillator
    quantity       = models.PositiveIntegerField(default=1)
    priority       = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    requested_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='resource_requests_made'
    )
    provider_contact = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='resource_requests_handled'
    )
    
    reason           = models.TextField()
    rejection_reason = models.TextField(null=True, blank=True)
    notes            = models.TextField(null=True, blank=True)
    
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'resource_sharing_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.equipment_type} from {self.requester_hospital.name} ({self.status})'
