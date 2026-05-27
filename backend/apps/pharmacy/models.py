"""
apps/pharmacy/models.py — Phase 13: Pharmacy + Auto-Refill
"""
from django.db import models
from shared.models import BaseModel


REFILL_STATUSES = [
    ('PENDING',            'Pending'),
    ('PARTNER_CONFIRMED',  'Partner Confirmed'),
    ('DISPATCHED',         'Dispatched'),
    ('DELIVERED',          'Delivered'),
    ('FAILED',             'Failed'),
    ('CANCELLED',          'Cancelled'),
]


class PharmacyPartner(BaseModel):
    """Registered pharmacy API partners (PharmEasy, 1mg, Netmeds)."""
    name             = models.CharField(max_length=100)
    slug             = models.SlugField(unique=True)
    api_base_url     = models.URLField()
    api_key_enc      = models.TextField()            # Store encrypted in production
    webhook_secret   = models.TextField()
    is_active        = models.BooleanField(default=True)
    supported_states = models.JSONField(default=list)   # ['MH','DL','KA']
    avg_delivery_hrs = models.PositiveIntegerField(default=48)

    class Meta:
        db_table = 'pharmacy_partners'

    def __str__(self):
        return self.name


class PharmacyIntegration(BaseModel):
    """Patient's saved pharmacy preferences."""
    patient                = models.OneToOneField('clinical.Patient', on_delete=models.PROTECT, related_name='pharmacy_integration')
    preferred_partner      = models.ForeignKey(PharmacyPartner, on_delete=models.SET_NULL, null=True, blank=True)
    delivery_address       = models.JSONField(default=dict)   # {line1, line2, city, state, pincode}
    saved_payment_method   = models.CharField(max_length=200, null=True, blank=True)
    auto_refill_enabled    = models.BooleanField(default=False)

    class Meta:
        db_table = 'pharmacy_integrations'

    def __str__(self):
        return f'{self.patient} pharmacy prefs'


class RefillOrder(BaseModel):
    """One auto-refill order per prescription per cycle."""
    prescription       = models.ForeignKey('clinical.Prescription', on_delete=models.PROTECT, related_name='refill_orders')
    patient            = models.ForeignKey('clinical.Patient', on_delete=models.PROTECT, related_name='refill_orders')
    partner            = models.ForeignKey(PharmacyPartner, on_delete=models.PROTECT)
    quantity_ordered   = models.PositiveIntegerField()
    status             = models.CharField(max_length=20, choices=REFILL_STATUSES, default='PENDING', db_index=True)
    partner_order_id   = models.CharField(max_length=200, null=True, blank=True)
    estimated_delivery = models.DateTimeField(null=True, blank=True)
    delivered_at       = models.DateTimeField(null=True, blank=True)
    total_amount       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    auto_triggered     = models.BooleanField(default=True)
    failure_reason     = models.TextField(null=True, blank=True)
    notes              = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'pharmacy_refill_orders'
        indexes  = [models.Index(fields=['prescription', 'status'])]

    def __str__(self):
        return f'RefillOrder #{self.id} — {self.status}'
