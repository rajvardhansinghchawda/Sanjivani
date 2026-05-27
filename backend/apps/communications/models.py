"""
apps/communications/models.py — ChatRoom and Message models for real-time messaging.
"""
import uuid
from django.db import models
from django.conf import settings
from shared.models import BaseModel


class ChatRoom(BaseModel):
    """
    One room per caregiver-patient pair.
    Both parties connect to the same WebSocket group using the room UUID.
    """
    caregiver = models.ForeignKey(
        'clinical.Caregiver', on_delete=models.CASCADE, related_name='chat_rooms'
    )
    patient = models.ForeignKey(
        'clinical.Patient', on_delete=models.CASCADE, related_name='chat_rooms'
    )

    class Meta:
        unique_together = ('caregiver', 'patient')
        ordering = ['-created_at']

    def __str__(self):
        return f"Room {self.id}: {self.caregiver} ↔ {self.patient}"

    @property
    def group_name(self) -> str:
        return f'chat_{self.id}'

    @property
    def call_group_name(self) -> str:
        return f'call_{self.id}'


class Message(models.Model):
    """Persisted chat message (text or file)."""
    MESSAGE_TYPES = [('text', 'Text'), ('file', 'File')]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room         = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    content      = models.TextField(blank=True, default='')
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    file_url     = models.CharField(max_length=1000, blank=True, null=True)
    file_name    = models.CharField(max_length=255, blank=True, null=True)
    file_size    = models.BigIntegerField(null=True, blank=True)
    mime_type    = models.CharField(max_length=120, blank=True, null=True)
    is_read      = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender_id} → room {self.room_id}: {self.content[:60]}"
