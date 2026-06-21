# apps/triage/serializers.py

from rest_framework import serializers
from .models import EmergencyCase


class EmergencyCaseSerializer(serializers.ModelSerializer):
    """Full serializer for EmergencyCase — used in API responses and dashboard."""

    class Meta:
        model  = EmergencyCase
        fields = [
            'id', 'case_id',
            'patient_name', 'patient_age', 'patient_phone', 'patient_gender',
            'patient_lat', 'patient_lng',
            'raw_symptoms_text', 'known_conditions',
            'ai_p_level', 'ai_severity_label', 'ai_doctor_category',
            'ai_confidence', 'ai_reasoning', 'ai_red_flags',
            'ai_possible_conditions', 'ai_requires_ambulance', 'ai_requires_icu',
            'ai_was_escalated',
            'needs_profile',
            'recommended_hospitals', 'top_hospital', 'routing_explanation',
            'status',
            'actual_p_level', 'outcome_notes', 'was_undertriaged', 'was_overtriaged',
            'created_at', 'resolved_at',
        ]
        read_only_fields = [
            'id', 'case_id', 'created_at',
            'was_undertriaged', 'was_overtriaged',
        ]


class RecordOutcomeSerializer(serializers.Serializer):
    """
    Used by dispatchers/clinicians to record actual outcome after case resolution.
    This is the feedback loop that powers the learner role.
    """
    actual_p_level = serializers.ChoiceField(
        choices=['P1', 'P2', 'P3', 'P4'],
        required=True,
        help_text="The actual triage level as assessed by clinicians on arrival.",
    )
    outcome_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=1000,
        help_text="Free text — what was the actual diagnosis / what happened?",
    )
    status = serializers.ChoiceField(
        choices=['RESOLVED', 'CANCELLED'],
        required=False,
        default='RESOLVED',
    )
