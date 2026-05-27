"""
apps/store/models.py — Hardware products, orders, and device unique IDs.
"""
import uuid
from django.db import models
from django.conf import settings
from shared.models import BaseModel


class HardwareProduct(BaseModel):
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    specs = models.JSONField(default=dict)
    stock_count = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    image_url = models.URLField(max_length=500, blank=True)

    def __str__(self):
        return f"{self.name} (SKU: {self.sku})"


class HardwareOrder(BaseModel):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
        ('REFUNDED', 'Refunded'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='hardware_orders'
    )
    product = models.ForeignKey(HardwareProduct, on_delete=models.PROTECT, related_name='orders')
    quantity = models.PositiveSmallIntegerField(default=1)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    shipping_address = models.JSONField(default=dict)
    payment_id = models.CharField(max_length=255, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"Order {self.id} — {self.product.name} x{self.quantity}"


class DeviceUniqueID(models.Model):
    """
    Pre-generated device unique IDs (MEDA-XXXX-XXXX-XXXX format).
    Assigned to orders at shipment time.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    unique_code = models.CharField(max_length=50, unique=True, db_index=True)
    product = models.ForeignKey(HardwareProduct, on_delete=models.CASCADE, related_name='device_ids')
    order = models.ForeignKey(
        HardwareOrder, null=True, blank=True, on_delete=models.SET_NULL, related_name='device_ids'
    )
    is_provisioned = models.BooleanField(default=False)
    manufactured_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.unique_code
