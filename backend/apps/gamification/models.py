"""
apps/gamification/models.py — Phase 20: Gamification + Streaks + Badges
"""
from django.db import models
from shared.models import BaseModel


BADGE_TYPES = [
    ('FIRST_DOSE',       'First Dose Taken'),
    ('7_DAY_STREAK',     '7-Day Streak'),
    ('14_DAY_STREAK',    '14-Day Streak'),
    ('30_DAY_STREAK',    '30-Day Streak'),
    ('60_DAY_STREAK',    '60-Day Streak'),
    ('90_DAY_STREAK',    '90-Day Streak'),
    ('180_DAY_STREAK',   '180-Day Streak'),
    ('365_DAY_STREAK',   '365-Day Streak'),
    ('PERFECT_WEEK',     'Perfect Week'),
    ('PERFECT_MONTH',    'Perfect Month'),
    ('DEVICE_LINKED',    'Device Linked'),
    ('ABHA_LINKED',      'ABHA Linked'),
    ('DIGITAL_RX',       'Digital Prescription'),
    ('REFILL_PROACTIVE', 'Proactive Refill'),
    ('CAREGIVER_HERO',   'Caregiver Hero'),
    ('WHATSAPP_ONBOARDED','WhatsApp Onboarded'),
]


class Streak(BaseModel):
    patient         = models.OneToOneField('clinical.Patient', on_delete=models.CASCADE, related_name='streak')
    current_days    = models.PositiveIntegerField(default=0)
    longest_days    = models.PositiveIntegerField(default=0)
    last_dose_date  = models.DateField(null=True, blank=True)
    last_broken_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'gamification_streaks'

    def __str__(self):
        return f'{self.patient} — {self.current_days} day streak'


class Badge(BaseModel):
    patient         = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='badges')
    badge_type      = models.CharField(max_length=30, choices=BADGE_TYPES)
    earned_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gamification_badges'
        unique_together = ('patient', 'badge_type')

    def __str__(self):
        return f'{self.badge_type} — {self.patient}'


class WeeklyAdherenceScore(BaseModel):
    patient         = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='weekly_scores')
    week_start      = models.DateField()          # Always Monday
    score           = models.PositiveIntegerField()  # 0–100
    total_doses     = models.PositiveIntegerField()
    taken_doses     = models.PositiveIntegerField()
    missed_doses    = models.PositiveIntegerField()

    class Meta:
        db_table = 'gamification_weekly_scores'
        unique_together = ('patient', 'week_start')
        indexes  = [models.Index(fields=['patient', '-week_start'])]

    def __str__(self):
        return f'{self.patient} week {self.week_start}: {self.score}%'
