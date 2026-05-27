"""
Initial migration for ai_engine models.
Creates tables in ai_engine PostgreSQL schema.
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.RunSQL(
            "CREATE SCHEMA IF NOT EXISTS ai_engine;",
            reverse_sql="DROP SCHEMA IF EXISTS ai_engine CASCADE;",
        ),
        migrations.CreateModel(
            name="AIModelRegistry",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("model_name", models.CharField(max_length=100)),
                ("model_version", models.CharField(max_length=50, unique=True)),
                ("algorithm_type", models.CharField(max_length=100)),
                ("is_active", models.BooleanField(default=False)),
                ("auc_roc", models.DecimalField(decimal_places=4, max_digits=6, null=True)),
                ("f1_score", models.DecimalField(decimal_places=4, max_digits=6, null=True)),
                ("precision_score", models.DecimalField(decimal_places=4, max_digits=6, null=True)),
                ("recall_score", models.DecimalField(decimal_places=4, max_digits=6, null=True)),
                ("brier_score", models.DecimalField(decimal_places=4, max_digits=6, null=True)),
                ("training_dataset_size", models.IntegerField(null=True)),
                ("training_cutoff_date", models.DateField(null=True)),
                ("feature_list", models.JSONField(default=list)),
                ("hyperparameters", models.JSONField(default=dict)),
                ("artifact_path", models.TextField(null=True)),
                ("deployed_at", models.DateTimeField(null=True)),
                ("retired_at", models.DateTimeField(null=True)),
                ("created_by_user_id", models.UUIDField(null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": '"ai_engine"."model_registry"'},
        ),
        migrations.CreateModel(
            name="PatientRiskScore",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("patient_id", models.UUIDField(db_index=True)),
                ("prescription_id", models.UUIDField(null=True, db_index=True)),
                ("period_start", models.DateField()),
                ("period_end", models.DateField()),
                ("risk_score", models.DecimalField(decimal_places=4, max_digits=5)),
                ("risk_level", models.CharField(db_index=True, max_length=10)),
                ("previous_risk_level", models.CharField(max_length=10, null=True)),
                ("risk_trend", models.CharField(max_length=20, null=True)),
                ("confidence", models.DecimalField(decimal_places=4, max_digits=5, null=True)),
                ("feature_adherence_7d", models.DecimalField(decimal_places=4, max_digits=5, null=True)),
                ("feature_adherence_30d", models.DecimalField(decimal_places=4, max_digits=5, null=True)),
                ("feature_avg_delay_min", models.DecimalField(decimal_places=2, max_digits=8, null=True)),
                ("feature_skip_count_7d", models.SmallIntegerField(null=True)),
                ("feature_missed_count_7d", models.SmallIntegerField(null=True)),
                ("feature_regimen_complexity", models.SmallIntegerField(null=True)),
                ("feature_app_opens_7d", models.SmallIntegerField(null=True)),
                ("feature_refill_days_late", models.SmallIntegerField(null=True)),
                ("feature_weekend_miss_ratio", models.DecimalField(decimal_places=4, max_digits=5, null=True)),
                ("top_reason_1", models.TextField(null=True)),
                ("top_reason_2", models.TextField(null=True)),
                ("top_reason_3", models.TextField(null=True)),
                ("shap_values_json", models.JSONField(null=True)),
                ("model", models.ForeignKey(db_column="model_id", null=True, on_delete=django.db.models.deletion.PROTECT, to="ai_engine.aimodelregistry")),
                ("model_version", models.CharField(max_length=50)),
                ("computed_by", models.CharField(default="ML_MODEL", max_length=30)),
                ("trigger", models.CharField(default="NIGHTLY_BATCH", max_length=30)),
                ("is_advisory_only", models.BooleanField(default=True, editable=False)),
                ("reviewed_by_user_id", models.UUIDField(null=True)),
                ("reviewed_at", models.DateTimeField(null=True)),
                ("generated_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": '"ai_engine"."risk_scores"', "ordering": ["-generated_at"]},
        ),
        migrations.CreateModel(
            name="AIRecommendation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("patient_id", models.UUIDField(db_index=True)),
                ("risk_score", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to="ai_engine.patientriskscore")),
                ("recommendation_type", models.CharField(max_length=50)),
                ("priority", models.CharField(default="medium", max_length=10)),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField()),
                ("action_data", models.JSONField(null=True)),
                ("target_audience", models.CharField(default="patient", max_length=20)),
                ("evidence", models.TextField(null=True)),
                ("status", models.CharField(default="pending", max_length=20)),
                ("shown_to_user_id", models.UUIDField(null=True)),
                ("shown_at", models.DateTimeField(null=True)),
                ("responded_at", models.DateTimeField(null=True)),
                ("response", models.CharField(max_length=20, null=True)),
                ("response_note", models.TextField(null=True)),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": '"ai_engine"."ai_recommendations"'},
        ),
        migrations.CreateModel(
            name="AIInsight",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("patient_id", models.UUIDField(db_index=True)),
                ("insight_type", models.CharField(max_length=50)),
                ("title", models.CharField(max_length=255)),
                ("body", models.TextField()),
                ("data", models.JSONField(default=dict)),
                ("is_read", models.BooleanField(default=False)),
                ("generated_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
            ],
            options={"db_table": '"ai_engine"."ai_insights"'},
        ),
        migrations.AddIndex(
            model_name="patientriskscore",
            index=models.Index(fields=["patient_id", "-generated_at"], name="idx_risk_patient_latest"),
        ),
        migrations.AddIndex(
            model_name="patientriskscore",
            index=models.Index(fields=["risk_level", "expires_at"], name="idx_risk_level"),
        ),
    ]
