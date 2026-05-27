"""
shared/models.py — BaseModel for the entire MedAdhere platform.
All app models inherit from BaseModel.
"""
import uuid
from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)

    def soft_delete(self, user=None):
        for obj in self:
            obj.soft_delete(user=user)


class SoftDeleteManager(models.Manager):
    """Default manager excludes soft-deleted rows."""
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()

    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db)

    def only_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db).deleted()


class BaseModel(models.Model):
    """
    Abstract base model for all MedAdhere entities.
    - UUID primary key (no sequential IDs exposed in URLs)
    - Soft delete (records never physically deleted)
    - Optimistic locking via version field
    - Created/updated timestamps
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    version    = models.PositiveIntegerField(default=1)

    objects         = SoftDeleteManager()
    all_objects     = models.Manager()   # includes soft-deleted

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def soft_delete(self, user=None):
        """Soft delete — sets deleted_at, never removes from DB."""
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at', 'updated_at'])
        # Audit logging handled by AuditAgent via signal

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
        self.save(update_fields=['deleted_at', 'updated_at'])

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None
