"""
apps/scheduling/serializers.py
"""
from rest_framework import serializers
from .models import ReminderJob, DoseLog, AdherenceSummary


class ReminderJobSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source='schedule.prescription.medication.name', read_only=True)
    patient_code    = serializers.CharField(source='schedule.prescription.patient.patient_code', read_only=True)
    prescription_id = serializers.UUIDField(source='schedule.prescription.id', read_only=True)
    is_within_window = serializers.BooleanField(read_only=True)

    class Meta:
        model  = ReminderJob
        fields = [
            'id', 'medication_name', 'patient_code', 'prescription_id',
            'scheduled_at', 'window_start', 'window_end', 'status',
            'sent_at', 'dose_value', 'dose_unit', 'with_food', 'label',
            'snooze_until', 'snooze_count', 'is_within_window',
        ]
        read_only_fields = fields


class DoseLogSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source='prescription.medication.name', read_only=True)
    logged_by_name  = serializers.CharField(source='logged_by.full_name', read_only=True, allow_null=True)

    class Meta:
        model  = DoseLog
        fields = [
            'id', 'medication_name', 'logged_by_name', 'status', 'source',
            'taken_at', 'dose_value', 'dose_unit', 'with_food',
            'side_effects', 'notes', 'mood_score', 'pain_score',
            'photo_url', 'latitude', 'longitude', 'iot_device_id', 'created_at',
        ]
        read_only_fields = fields


class LogDoseSerializer(serializers.Serializer):
    status       = serializers.ChoiceField(choices=['TAKEN', 'SKIPPED', 'MISSED'])
    taken_at     = serializers.DateTimeField(required=False)
    with_food    = serializers.BooleanField(required=False)
    notes        = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    side_effects = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    mood_score   = serializers.IntegerField(min_value=1, max_value=10, required=False)
    pain_score   = serializers.IntegerField(min_value=1, max_value=10, required=False)
    latitude     = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude    = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)


class ManualDoseSerializer(serializers.Serializer):
    prescription_id = serializers.UUIDField()
    taken_at        = serializers.DateTimeField(required=False)
    dose_value      = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)
    notes           = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    source          = serializers.ChoiceField(choices=['APP', 'VOICE', 'NFC'], default='APP')


class SnoozeSerializer(serializers.Serializer):
    minutes = serializers.IntegerField(min_value=5, max_value=120, default=10)


class AdherenceSummarySerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source='prescription.medication.name', read_only=True)

    class Meta:
        model  = AdherenceSummary
        fields = [
            'id', 'medication_name', 'period_start', 'period_end', 'period_type',
            'scheduled_count', 'taken_count', 'missed_count', 'skipped_count',
            'adherence_pct',
        ]
