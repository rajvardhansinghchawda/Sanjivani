"""apps/tenants/models.py — Phase 28: Multi-Tenant Clinic Mode"""
from django.db import models
from shared.models import BaseModel

PLAN_CHOICES = [('CLINIC','Clinic'),('HOSPITAL','Hospital'),('ENTERPRISE','Enterprise')]

class Tenant(BaseModel):
    name         = models.CharField(max_length=200)
    subdomain    = models.SlugField(unique=True)
    plan         = models.CharField(max_length=15, choices=PLAN_CHOICES, default='CLINIC')
    max_patients = models.PositiveIntegerField(default=500)
    is_active    = models.BooleanField(default=True)
    schema_name  = models.CharField(max_length=63, null=True, blank=True)    # Postgres schema

    class Meta:
        db_table = 'tenants'

    def __str__(self):
        return f'{self.name} ({self.subdomain})'


class TenantAdmin(BaseModel):
    tenant     = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='admins')
    user       = models.ForeignKey('identity.User', on_delete=models.PROTECT, related_name='tenant_roles')
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = 'tenant_admins'
        unique_together = ('tenant', 'user')
