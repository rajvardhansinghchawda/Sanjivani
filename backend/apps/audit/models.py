import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import PermissionDenied


class ImmutableQuerySet(models.QuerySet):
    def delete(self, *args, **kwargs):
        raise PermissionDenied("AuditLog records are immutable and cannot be deleted.")


class ImmutableManager(models.Manager):
    def get_queryset(self):
        return ImmutableQuerySet(self.model, using=self._db)


class AuditLog(models.Model):
    """
    HIPAA-compliant immutable audit trail.
    Records are NEVER deleted — revoke DB DELETE permission in production.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='audit_logs'
    )
    action = models.CharField(max_length=100, db_index=True)           # e.g. 'USER_LOGIN', 'DOSE_LOGGED'
    resource_type = models.CharField(max_length=100, db_index=True)    # e.g. 'User', 'Prescription'
    resource_id = models.CharField(max_length=255, blank=True)         # UUID / PK as string
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    trace_id = models.CharField(max_length=255, blank=True)            # correlates distributed logs

    objects = ImmutableManager()

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['actor', 'action', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
        ]

    def __str__(self):
        return f"[{self.action}] {self.resource_type}:{self.resource_id} by {self.actor_id}"

    # Override instance-level delete as well
    def delete(self, *args, **kwargs):
        raise PermissionDenied("AuditLog records are immutable and cannot be deleted.")
