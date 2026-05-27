"""
apps/scheduling/models.py — ReminderJob, DoseLog, SnoozedDose, AdherenceSummary.
"""
import uuid
from django.db import models
from django.utils import timezone
from shared.models import BaseModel


class ReminderStatus(models.TextChoices):
    PENDING   = 'PENDING',   'Pending'
    SENT      = 'SENT',      'Sent'
    TAKEN     = 'TAKEN',     'Taken'
    MISSED    = 'MISSED',    'Missed'
    SKIPPED   = 'SKIPPED',   'Skipped'
    SNOOZED   = 'SNOOZED',   'Snoozed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class DoseSource(models.TextChoices):
    APP       = 'APP',       'Mobile / Web App'
    IOT       = 'IOT',       'IoT Pill Dispenser'
    CAREGIVER = 'CAREGIVER', 'Caregiver'
    VOICE     = 'VOICE',     'Voice Assistant'
    NFC       = 'NFC',       'NFC Tap'


# ─── Reminder Job (one instance per scheduled dose time) ──────────────────────
class ReminderJob(BaseModel):
    schedule        = models.ForeignKey(
        'clinical.MedicationSchedule', on_delete=models.CASCADE, related_name='reminder_jobs'
    )
    scheduled_at    = models.DateTimeField(db_index=True)
    window_start    = models.DateTimeField()      # scheduled_at - lead_minutes
    window_end      = models.DateTimeField()      # scheduled_at + 60 min grace
    status          = models.CharField(max_length=20, choices=ReminderStatus.choices, default=ReminderStatus.PENDING)
    sent_at         = models.DateTimeField(null=True, blank=True)
    dose_value      = models.DecimalField(max_digits=8, decimal_places=2)
    dose_unit       = models.CharField(max_length=30, default='mg')
    with_food       = models.BooleanField(default=False)
    label           = models.CharField(max_length=100, blank=True, null=True)  # e.g. "Morning"
    snooze_until    = models.DateTimeField(null=True, blank=True)
    snooze_count    = models.SmallIntegerField(default=0)
    notification_id = models.CharField(max_length=200, blank=True, null=True)  # FCM message id

    class Meta:
        db_table = 'scheduling_reminder_jobs'
        indexes  = [
            models.Index(fields=['status', 'scheduled_at']),
            models.Index(fields=['schedule', 'scheduled_at']),
        ]
        ordering = ['scheduled_at']

    def __str__(self):
        rx = self.schedule.prescription
        return f'{rx.patient.patient_code} — {rx.medication.name} @ {self.scheduled_at.isoformat()}'

    @property
    def is_within_window(self) -> bool:
        now = timezone.now()
        return self.window_start <= now <= self.window_end

    @property
    def patient(self):
        return self.schedule.prescription.patient


# ─── Dose Log (audit trail of every dose action) ──────────────────────────────
class DoseLog(BaseModel):
    reminder_job  = models.OneToOneField(
        ReminderJob, on_delete=models.CASCADE, related_name='dose_log', null=True, blank=True
    )
    prescription  = models.ForeignKey(
        'clinical.Prescription', on_delete=models.CASCADE, related_name='dose_logs'
    )
    logged_by     = models.ForeignKey(
        'identity.User', on_delete=models.SET_NULL, null=True, related_name='dose_logs_created'
    )
    status        = models.CharField(max_length=20, choices=ReminderStatus.choices)
    source        = models.CharField(max_length=20, choices=DoseSource.choices, default=DoseSource.APP)
    taken_at      = models.DateTimeField(null=True, blank=True)
    dose_value    = models.DecimalField(max_digits=8, decimal_places=2)
    dose_unit     = models.CharField(max_length=30, default='mg')
    with_food     = models.BooleanField(default=False)
    side_effects  = models.TextField(blank=True, null=True)
    notes         = models.TextField(blank=True, null=True)
    mood_score    = models.SmallIntegerField(null=True, blank=True)   # 1-10 (optional PRN)
    pain_score    = models.SmallIntegerField(null=True, blank=True)   # 1-10
    photo_url     = models.URLField(blank=True, null=True)            # photo proof (IoT / premium)
    latitude      = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude     = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    iot_device_id = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        db_table = 'scheduling_dose_logs'
        ordering = ['-taken_at']
        indexes  = [
            models.Index(fields=['prescription', 'taken_at']),
            models.Index(fields=['status', 'taken_at']),
        ]

    def __str__(self):
        return f'DoseLog [{self.status}] {self.prescription.medication.name} @ {self.taken_at}'


# ─── Adherence Summary (denormalised, updated nightly by Celery) ───────────────
class AdherenceSummary(BaseModel):
    patient       = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='adherence_summaries')
    prescription  = models.ForeignKey('clinical.Prescription', on_delete=models.CASCADE, related_name='adherence_summaries')
    period_start  = models.DateField()
    period_end    = models.DateField()
    period_type   = models.CharField(max_length=10, choices=[('daily','Daily'),('weekly','Weekly'),('monthly','Monthly')], default='daily')
    scheduled_count = models.PositiveIntegerField(default=0)
    taken_count     = models.PositiveIntegerField(default=0)
    missed_count    = models.PositiveIntegerField(default=0)
    skipped_count   = models.PositiveIntegerField(default=0)
    adherence_pct   = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        db_table = 'scheduling_adherence_summaries'
        unique_together = [('patient', 'prescription', 'period_start', 'period_type')]
        ordering = ['-period_start']

    def compute_pct(self):
        if self.scheduled_count == 0:
            self.adherence_pct = 0
        else:
            self.adherence_pct = round(
                (self.taken_count / self.scheduled_count) * 100, 2
            )
        return self.adherence_pct
