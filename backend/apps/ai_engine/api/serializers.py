"""
AI Engine API Serializers
"""
from rest_framework import serializers
from apps.ai_engine.models import PatientRiskScore, AIInsight, AIRecommendation, AIModelRegistry


class RiskScoreSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField()
    risk_score = serializers.DecimalField(max_digits=5, decimal_places=4)
    reasons = serializers.SerializerMethodField()

    class Meta:
        model = PatientRiskScore
        fields = [
            "id", "patient_id", "risk_score", "risk_level", "confidence",
            "previous_risk_level", "risk_trend",
            "top_reason_1", "top_reason_2", "top_reason_3",
            "model_version", "computed_by", "is_advisory_only",
            "generated_at", "expires_at",
        ]

    def get_reasons(self, obj):
        return [r for r in [obj.top_reason_1, obj.top_reason_2, obj.top_reason_3] if r]


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = ["id", "insight_type", "title", "body", "data", "is_read", "generated_at", "expires_at"]


class AIRecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRecommendation
        fields = [
            "id", "recommendation_type", "priority", "title", "message",
            "action_data", "target_audience", "evidence", "status",
            "shown_at", "responded_at", "response", "expires_at",
        ]


class ModelRegistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModelRegistry
        fields = [
            "id", "model_name", "model_version", "algorithm_type", "is_active",
            "auc_roc", "f1_score", "precision_score", "recall_score", "brier_score",
            "training_dataset_size", "training_cutoff_date",
            "feature_list", "deployed_at", "retired_at", "created_at",
        ]


class RetrainRequestSerializer(serializers.Serializer):
    model_version = serializers.CharField(max_length=50)

    def validate_model_version(self, value):
        import re
        if not re.match(r"^\d+\.\d+\.\d+$", value):
            raise serializers.ValidationError("model_version must be semantic version (e.g. 1.2.0)")
        return value
