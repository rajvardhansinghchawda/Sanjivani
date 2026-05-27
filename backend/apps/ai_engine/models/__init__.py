"""
AI Engine Models
================
These models store AI outputs — risk scores, insights, recommendations, model registry.
All are READ-HEAVY (written by ML pipeline, read by API layer).
"""

import uuid
from django.db import models


class AIModelRegistry(models.Model):
    """
    Tracks all trained ML model versions.
    Only ONE model per task can be is_active=True at a time.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_name = models.CharField(max_length=100)
    model_version = models.CharField(max_length=50, unique=True)
    algorithm_type = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)

    # Performance metrics
    auc_roc = models.DecimalField(max_digits=6, decimal_places=4, null=True)
    f1_score = models.DecimalField(max_digits=6, decimal_places=4, null=True)
    precision_score = models.DecimalField(max_digits=6, decimal_places=4, null=True)
    recall_score = models.DecimalField(max_digits=6, decimal_places=4, null=True)
    brier_score = models.DecimalField(max_digits=6, decimal_places=4, null=True)

    # Training metadata
    training_dataset_size = models.IntegerField(null=True)
    training_cutoff_date = models.DateField(null=True)
    feature_list = models.JSONField(default=list)
    hyperparameters = models.JSONField(default=dict)

    # Deployment
    artifact_path = models.TextField(null=True)
    deployed_at = models.DateTimeField(null=True)
    retired_at = models.DateTimeField(null=True)
    created_by_user_id = models.UUIDField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"ai_engine"."model_registry"'
        ordering = ["-created_at"]
        verbose_name = "AI Model"
        verbose_name_plural = "AI Models"

    def __str__(self):
        return f"{self.model_name} v{self.model_version} ({'active' if self.is_active else 'inactive'})"


class PatientRiskScore(models.Model):
    """
    Stores computed risk scores for patients.
    Written by ML pipeline (nightly batch + real-time on PREMIUM).
    is_advisory_only is ALWAYS True — AI never makes clinical decisions.
    """

    RISK_LEVELS = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
        ("unknown", "Unknown"),
    ]

    RISK_TRENDS = [
        ("improving", "Improving"),
        ("worsening", "Worsening"),
        ("stable", "Stable"),
        ("new_patient", "New Patient"),
    ]

    TRIGGERS = [
        ("DOSE_EVENT", "Dose Event"),
        ("NIGHTLY_BATCH", "Nightly Batch"),
        ("MANUAL", "Manual"),
        ("SCHEDULE_CHANGE", "Schedule Change"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_id = models.UUIDField(db_index=True)
    prescription_id = models.UUIDField(null=True, db_index=True)

    period_start = models.DateField()
    period_end = models.DateField()

    risk_score = models.DecimalField(max_digits=5, decimal_places=4)
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, db_index=True)
    previous_risk_level = models.CharField(max_length=10, null=True)
    risk_trend = models.CharField(max_length=20, choices=RISK_TRENDS, null=True)
    confidence = models.DecimalField(max_digits=5, decimal_places=4, null=True)

    # Feature snapshot (what the model saw)
    feature_adherence_7d = models.DecimalField(max_digits=5, decimal_places=4, null=True)
    feature_adherence_30d = models.DecimalField(max_digits=5, decimal_places=4, null=True)
    feature_avg_delay_min = models.DecimalField(max_digits=8, decimal_places=2, null=True)
    feature_skip_count_7d = models.SmallIntegerField(null=True)
    feature_missed_count_7d = models.SmallIntegerField(null=True)
    feature_regimen_complexity = models.SmallIntegerField(null=True)
    feature_app_opens_7d = models.SmallIntegerField(null=True)
    feature_refill_days_late = models.SmallIntegerField(null=True)
    feature_weekend_miss_ratio = models.DecimalField(max_digits=5, decimal_places=4, null=True)

    # Explainability
    top_reason_1 = models.TextField(null=True)
    top_reason_2 = models.TextField(null=True)
    top_reason_3 = models.TextField(null=True)
    shap_values_json = models.JSONField(null=True)

    # Model provenance
    model = models.ForeignKey(
        AIModelRegistry, on_delete=models.PROTECT, null=True, db_column="model_id"
    )
    model_version = models.CharField(max_length=50)
    computed_by = models.CharField(max_length=30, default="ML_MODEL")
    trigger = models.CharField(max_length=30, choices=TRIGGERS, default="NIGHTLY_BATCH")

    # Safety — always advisory
    is_advisory_only = models.BooleanField(default=True, editable=False)
    reviewed_by_user_id = models.UUIDField(null=True)
    reviewed_at = models.DateTimeField(null=True)

    generated_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"ai_engine"."risk_scores"'
        ordering = ["-generated_at"]
        indexes = [
            models.Index(
                fields=["patient_id", "-generated_at"], name="idx_risk_patient_latest"
            ),
            models.Index(
                fields=["risk_level", "expires_at"], name="idx_risk_level"
            ),
        ]

    def __str__(self):
        return f"Risk({self.patient_id}) = {self.risk_level} ({self.risk_score})"


class AIRecommendation(models.Model):
    """
    Personalized intervention recommendations generated by AI.
    Human-readable, actionable, always advisory.
    """

    RECOMMENDATION_TYPES = [
        ("RESCHEDULE_DOSE", "Reschedule Dose"),
        ("SIMPLIFY_REGIMEN", "Simplify Regimen"),
        ("EDUCATION", "Education"),
        ("REFILL_REMINDER", "Refill Reminder"),
        ("CONTACT_DOCTOR", "Contact Doctor"),
        ("CHANGE_CHANNEL", "Change Notification Channel"),
        ("MOTIVATIONAL", "Motivational"),
        ("CAREGIVER_INVOLVEMENT", "Caregiver Involvement"),
    ]

    PRIORITY_CHOICES = [("low", "Low"), ("medium", "Medium"), ("high", "High")]

    TARGET_AUDIENCE = [
        ("patient", "Patient"),
        ("caregiver", "Caregiver"),
        ("nurse", "Nurse"),
        ("admin", "Admin"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("shown", "Shown"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
        ("expired", "Expired"),
        ("snoozed", "Snoozed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_id = models.UUIDField(db_index=True)
    risk_score = models.ForeignKey(
        PatientRiskScore, on_delete=models.SET_NULL, null=True
    )

    recommendation_type = models.CharField(max_length=50, choices=RECOMMENDATION_TYPES)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    title = models.CharField(max_length=255)
    message = models.TextField()
    action_data = models.JSONField(null=True)
    target_audience = models.CharField(
        max_length=20, choices=TARGET_AUDIENCE, default="patient"
    )
    evidence = models.TextField(null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    shown_to_user_id = models.UUIDField(null=True)
    shown_at = models.DateTimeField(null=True)
    responded_at = models.DateTimeField(null=True)
    response = models.CharField(max_length=20, null=True)
    response_note = models.TextField(null=True)

    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = '"ai_engine"."ai_recommendations"'
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recommendation_type} → patient {self.patient_id}"


class AIInsight(models.Model):
    """
    Human-readable insights derived from behavioral pattern analysis.
    Short, actionable, personalized.
    """

    INSIGHT_TYPES = [
        ("PATTERN_DETECTION", "Pattern Detection"),
        ("TIMING_OPTIMIZATION", "Timing Optimization"),
        ("RISK_WARNING", "Risk Warning"),
        ("POSITIVE_REINFORCEMENT", "Positive Reinforcement"),
        ("REFILL_REMINDER", "Refill Reminder"),
        ("STREAK_UPDATE", "Streak Update"),
        ("WEEKEND_PATTERN", "Weekend Pattern"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_id = models.UUIDField(db_index=True)
    insight_type = models.CharField(max_length=50, choices=INSIGHT_TYPES)
    title = models.CharField(max_length=255)
    body = models.TextField()
    data = models.JSONField(default=dict)
    is_read = models.BooleanField(default=False)
    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = '"ai_engine"."ai_insights"'
        ordering = ["-generated_at"]

    def __str__(self):
        return f"{self.insight_type} for {self.patient_id}"
