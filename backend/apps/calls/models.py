# apps/calls/models.py
import uuid
from django.db import models


class CallLog(models.Model):

    class CallType(models.TextChoices):
        TRANSFER_NOTIFICATION = 'transfer_notification', 'Transfer Notification'
        USER_AGENT            = 'user_agent',            'User AI Agent'

    class Status(models.TextChoices):
        INITIATED   = 'initiated',   'Initiated'
        RINGING     = 'ringing',     'Ringing'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED   = 'completed',   'Completed'
        FAILED      = 'failed',      'Failed'
        NO_ANSWER   = 'no_answer',   'No Answer'

    class Language(models.TextChoices):
        ENGLISH = 'en', 'English'
        HINDI   = 'hi', 'Hindi'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    call_type        = models.CharField(max_length=30, choices=CallType.choices)
    to_number        = models.CharField(max_length=20)
    twilio_call_sid  = models.CharField(max_length=50, null=True, blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)
    language         = models.CharField(max_length=5, choices=Language.choices, default=Language.ENGLISH)
    duration_sec     = models.PositiveIntegerField(null=True, blank=True)

    # link to what triggered this call
    transfer_request = models.ForeignKey(
        'patients.TransferRequest',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='calls'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'call_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.call_type} → {self.to_number} [{self.status}]'


class CallSession(models.Model):
    """
    Stores the conversation history for a user AI agent call.
    Used to maintain context across multiple webhook roundtrips.
    Stored in DB + Redis for fast access during active call.
    """
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    call_log             = models.OneToOneField(CallLog, on_delete=models.CASCADE, related_name='session')
    twilio_call_sid      = models.CharField(max_length=50, db_index=True)
    language             = models.CharField(max_length=5, default='en')
    conversation_history = models.JSONField(default=list)  # [{role, content}, ...]
    detected_intent      = models.CharField(max_length=50, null=True, blank=True)
    user_city            = models.CharField(max_length=100, null=True, blank=True)
    resolved             = models.BooleanField(default=False)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)
    meta_data = models.JSONField(default=dict, blank=True)
    class Meta:
        db_table = 'call_sessions'