"""
apps/whatsapp_bot/models.py — Phase 15: WhatsApp Bot (No-App Flow)
"""
from django.db import models
from shared.models import BaseModel


WA_STATES = [
    ('IDLE',                   'Idle'),
    ('AWAITING_DOSE_RESPONSE', 'Awaiting Dose Response'),
    ('ONBOARDING_LANGUAGE',    'Onboarding: Language'),
    ('ONBOARDING_NAME',        'Onboarding: Name'),
    ('ONBOARDING_PHONE_VERIFY','Onboarding: Phone Verify'),
    ('MAIN_MENU',              'Main Menu'),
    ('HELP',                   'Help'),
]

WA_DIRECTIONS = [('INBOUND', 'Inbound'), ('OUTBOUND', 'Outbound')]

WA_INTENTS = [
    ('DOSE_YES',  'Dose Taken'),
    ('DOSE_NO',   'Dose Not Taken'),
    ('DOSE_SKIP', 'Dose Skipped'),
    ('HELP',      'Help'),
    ('STATUS',    'Status Request'),
    ('UNKNOWN',   'Unknown'),
]


class WhatsAppSession(BaseModel):
    """One session per phone number."""
    phone_number    = models.CharField(max_length=20, unique=True, db_index=True)
    user            = models.ForeignKey('identity.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='whatsapp_session')
    state           = models.CharField(max_length=30, choices=WA_STATES, default='IDLE')
    state_data      = models.JSONField(default=dict)
    last_activity_at= models.DateTimeField()
    onboarding_done = models.BooleanField(default=False)

    class Meta:
        db_table = 'whatsapp_sessions'

    def __str__(self):
        return f'WA {self.phone_number} [{self.state}]'


class WhatsAppInteractionLog(BaseModel):
    """Every inbound/outbound message."""
    session         = models.ForeignKey(WhatsAppSession, on_delete=models.CASCADE, related_name='interactions')
    direction       = models.CharField(max_length=10, choices=WA_DIRECTIONS)
    message_body    = models.TextField()
    intent          = models.CharField(max_length=15, choices=WA_INTENTS, null=True, blank=True)
    whatsapp_msg_id = models.CharField(max_length=200, null=True, blank=True, db_index=True)

    class Meta:
        db_table = 'whatsapp_interaction_logs'
        constraints = [
            models.UniqueConstraint(
                fields=['whatsapp_msg_id'],
                condition=models.Q(whatsapp_msg_id__isnull=False),
                name='uq_wa_msg_id',
            )
        ]

    def __str__(self):
        return f'{self.direction} [{self.intent}] — {self.session.phone_number}'
