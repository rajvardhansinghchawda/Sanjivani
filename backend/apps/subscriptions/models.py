from django.db import models
from django.conf import settings
from shared.models import BaseModel

class SubscriptionPlan(BaseModel):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    features = models.JSONField(default=dict, help_text="Dictionary of features and limits")
    max_medications = models.PositiveIntegerField(default=5)
    max_caregivers = models.PositiveIntegerField(default=1)

    def __str__(self):
        return self.name

class UserSubscription(BaseModel):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('PAST_DUE', 'Past Due'),
        ('CANCELED', 'Canceled'),
        ('UNPAID', 'Unpaid'),
    )
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    gateway_sub_id = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.user.email} - {self.plan.name}"

class SubscriptionInvoice(BaseModel):
    STATUS_CHOICES = (
        ('PAID', 'Paid'),
        ('OPEN', 'Open'),
        ('VOID', 'Void'),
        ('UNCOLLECTIBLE', 'Uncollectible'),
    )
    subscription = models.ForeignKey(UserSubscription, on_delete=models.CASCADE, related_name='invoices')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    paid_at = models.DateTimeField(null=True, blank=True)
    gateway_invoice_id = models.CharField(max_length=255, blank=True, null=True)
    pdf_url = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return f"Invoice {self.id} - {self.amount} {self.currency}"
