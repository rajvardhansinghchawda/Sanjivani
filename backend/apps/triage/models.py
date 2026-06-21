# apps/triage/models.py
"""
EmergencyCase — persists every emergency triage event with:
  - Raw patient input
  - Full AI triage output (severity, reasoning, red flags, needs profile)
  - AI routing output (ranked hospitals, explanation)
  - Outcome tracking (for the learner feedback loop)

This model is intentionally append-only in the emergency path.
Dispatchers can later mark actual_p_level and trigger undertriage flags.
"""

import uuid
from django.db import models


class EmergencyCase(models.Model):

    class PLevel(models.TextChoices):
        P1 = 'P1', 'P1 — Critical'
        P2 = 'P2', 'P2 — Urgent'
        P3 = 'P3', 'P3 — Moderate'
        P4 = 'P4', 'P4 — Low'

    class CaseStatus(models.TextChoices):
        INCOMING           = 'INCOMING',           'Incoming'
        DISPATCHED         = 'DISPATCHED',          'Dispatched'
        RESOLVED           = 'RESOLVED',            'Resolved'
        FLAGGED_FOR_REVIEW = 'FLAGGED_FOR_REVIEW',  'Flagged for Review'
        CANCELLED          = 'CANCELLED',           'Cancelled'

    class Confidence(models.TextChoices):
        HIGH   = 'HIGH',   'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW    = 'LOW',    'Low'

    # ── Identifiers ───────────────────────────────────────────────────────────
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case_id = models.CharField(max_length=30, unique=True, db_index=True)  # e.g. EMG-1716450000

    # ── Patient Input ─────────────────────────────────────────────────────────
    patient_name        = models.CharField(max_length=150, default='Unknown')
    patient_age         = models.PositiveIntegerField(null=True, blank=True)
    patient_phone       = models.CharField(max_length=20, null=True, blank=True)
    patient_gender      = models.CharField(max_length=10, null=True, blank=True)
    patient_lat         = models.FloatField(null=True, blank=True)
    patient_lng         = models.FloatField(null=True, blank=True)

    # ── Raw Input — THE KEY FIELD for retraining ──────────────────────────────
    raw_symptoms_text   = models.TextField()   # free-text exactly as typed by dispatcher
    known_conditions    = models.TextField(null=True, blank=True)

    # ── AI Triage Output ──────────────────────────────────────────────────────
    ai_p_level          = models.CharField(max_length=5, choices=PLevel.choices, null=True, blank=True)
    ai_severity_label   = models.CharField(max_length=30, null=True, blank=True)
    ai_doctor_category  = models.CharField(max_length=100, null=True, blank=True)
    ai_confidence       = models.CharField(max_length=10, choices=Confidence.choices, default=Confidence.MEDIUM)
    ai_reasoning        = models.TextField(null=True, blank=True)     # 1-3 sentences for dispatcher
    ai_red_flags        = models.JSONField(default=list)              # ["unresponsive", "labored breathing"]
    ai_possible_conditions = models.JSONField(default=list)           # ["Stroke", "TBI"]
    ai_requires_ambulance  = models.BooleanField(default=False)
    ai_requires_icu        = models.BooleanField(default=False)
    ai_was_escalated       = models.BooleanField(default=False)       # True if AI bumped severity up

    # ── Care Needs Profile ────────────────────────────────────────────────────
    needs_profile       = models.JSONField(null=True, blank=True)
    # Example: {
    #   "required_bed_type": "icu",
    #   "required_services": ["IMG_CT", "IMG_MRI"],
    #   "required_departments": ["neurology"],
    #   "requires_ventilator": false,
    #   "time_sensitivity_minutes": 60,
    #   "profile_reasoning": "..."
    # }

    # ── Routing Output ────────────────────────────────────────────────────────
    recommended_hospitals = models.JSONField(default=list)  # top-5 ranked with scores + explanations
    top_hospital          = models.ForeignKey(
        'hospitals.Hospital',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='top_recommended_cases'
    )
    routing_explanation   = models.TextField(null=True, blank=True)  # AI text readable in <10s

    # ── Case Status ───────────────────────────────────────────────────────────
    status      = models.CharField(
        max_length=25, choices=CaseStatus.choices, default=CaseStatus.INCOMING
    )

    # ── Outcome Tracking (Learner Loop) ───────────────────────────────────────
    # Filled in by dispatcher/clinician after the case resolves.
    # Null = not yet recorded.
    actual_p_level      = models.CharField(max_length=5, choices=PLevel.choices, null=True, blank=True)
    outcome_notes       = models.TextField(null=True, blank=True)
    was_undertriaged    = models.BooleanField(null=True, blank=True)  # actual > ai_assigned
    was_overtriaged     = models.BooleanField(null=True, blank=True)  # actual < ai_assigned
    reviewed_by         = models.ForeignKey(
        'authentication.User',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_cases'
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at  = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'emergency_cases'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['status']),
            models.Index(fields=['ai_p_level']),
            models.Index(fields=['created_at']),
            models.Index(fields=['was_undertriaged']),
        ]

    def __str__(self):
        return f'{self.case_id} — {self.patient_name} [{self.ai_p_level}] {self.status}'

    def save(self, *args, **kwargs):
        """Auto-compute undertriage / overtriage flags when actual_p_level is set."""
        if self.actual_p_level and self.ai_p_level:
            # P1 < P2 < P3 < P4 in clinical severity ordering (P1 is worst)
            order = {'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4}
            actual_rank = order.get(self.actual_p_level, 3)
            ai_rank     = order.get(self.ai_p_level, 3)
            # Under-triage: AI said P3 but reality was P1 → ai_rank > actual_rank
            self.was_undertriaged = actual_rank < ai_rank
            # Over-triage: AI said P1 but reality was P3 → ai_rank < actual_rank
            self.was_overtriaged  = actual_rank > ai_rank
        super().save(*args, **kwargs)
