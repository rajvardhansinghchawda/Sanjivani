"""
apps/clinical/serializers.py
"""
from rest_framework import serializers
from .models import (
    Patient, PatientCondition, Caregiver, PatientCaregiverLink,
    Medication, DrugInteraction, Prescription, MedicationSchedule,
    DrugInteractionCheckLog,
)


# ─── Patient ──────────────────────────────────────────────────────────────────

class PatientSerializer(serializers.ModelSerializer):
    email     = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model  = Patient
        fields = [
            'id', 'patient_code', 'email', 'full_name',
            'date_of_birth', 'gender', 'blood_group',
            'timezone', 'primary_language',
            'emergency_contact_name', 'emergency_contact_phone',
            'is_hospitalized', 'hospitalized_since', 'discharge_expected_at', 'hospital_name',
            'cognitive_status', 'has_vision_impairment', 'has_hearing_impairment', 'requires_assistance',
            'is_travel_mode', 'created_at',
        ]
        read_only_fields = ['id', 'patient_code', 'email', 'full_name', 'created_at']


class PatientUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Patient
        fields = [
            'date_of_birth', 'gender', 'blood_group',
            'timezone', 'primary_language',
            'emergency_contact_name', 'emergency_contact_phone',
            'cognitive_status', 'has_vision_impairment', 'has_hearing_impairment', 'requires_assistance',
            'is_travel_mode',
        ]


class HospitalizationSerializer(serializers.Serializer):
    hospitalized_since    = serializers.DateTimeField(required=False)
    discharge_expected_at = serializers.DateTimeField(required=False, allow_null=True)
    hospital_name         = serializers.CharField(max_length=300, required=False, allow_blank=True)


# ─── Conditions ───────────────────────────────────────────────────────────────

class PatientConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PatientCondition
        fields = ['id', 'icd10_code', 'condition_name', 'severity', 'diagnosed_at', 'notes', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


# ─── Caregiver ────────────────────────────────────────────────────────────────

class CaregiverSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email     = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model  = Caregiver
        fields = ['id', 'full_name', 'email', 'is_professional', 'specialty', 'organization_name']


class CaregiverLinkSerializer(serializers.ModelSerializer):
    caregiver = CaregiverSerializer(read_only=True)

    class Meta:
        model  = PatientCaregiverLink
        fields = [
            'id', 'caregiver', 'permission_level', 'can_receive_alerts',
            'is_active', 'accepted_at', 'created_at',
        ]


class CaregiverInviteSerializer(serializers.Serializer):
    caregiver_email    = serializers.EmailField()
    permission_level   = serializers.ChoiceField(choices=['view_only', 'log_doses', 'manage_schedule', 'full_access'])
    can_receive_alerts = serializers.BooleanField(default=True)


class CaregiverPermissionUpdateSerializer(serializers.Serializer):
    permission_level   = serializers.ChoiceField(choices=['view_only', 'log_doses', 'manage_schedule', 'full_access'])
    can_receive_alerts = serializers.BooleanField(required=False)


# ─── Medications ──────────────────────────────────────────────────────────────

class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Medication
        fields = [
            'id', 'name', 'generic_name', 'brand_name', 'drug_class',
            'form', 'default_unit', 'strength', 'manufacturer',
            'requires_food', 'refrigeration_required', 'is_controlled_substance',
            'barcode', 'photo_url', 'description', 'side_effects', 'is_verified',
        ]
        read_only_fields = ['id']


class DrugInteractionSerializer(serializers.ModelSerializer):
    medication_a_name = serializers.CharField(source='medication_a.name', read_only=True)
    medication_b_name = serializers.CharField(source='medication_b.name', read_only=True)

    class Meta:
        model  = DrugInteraction
        fields = ['id', 'medication_a_name', 'medication_b_name', 'severity', 'description']


# ─── Prescriptions ────────────────────────────────────────────────────────────

class MedicationScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MedicationSchedule
        fields = [
            'id', 'frequency_type', 'times_of_day', 'days_of_week',
            'interval_days', 'cycle_on_days', 'cycle_off_days',
            'timezone', 'is_active', 'lead_minutes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PrescriptionSerializer(serializers.ModelSerializer):
    medication = MedicationSerializer(read_only=True)
    schedules  = MedicationScheduleSerializer(many=True, read_only=True)

    class Meta:
        model  = Prescription
        fields = [
            'id', 'medication', 'prescribed_by',
            'dosage_value', 'dosage_unit', 'instructions',
            'start_date', 'end_date', 'is_indefinite',
            'refill_alert_days', 'total_quantity', 'remaining_quantity',
            'compartment_number', 'current_pill_count',
            'purpose', 'special_instructions', 'is_active',
            'photo_url', 'notes', 'schedules', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'schedules']


class PrescriptionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Prescription
        fields = [
            'medication', 'prescribed_by',
            'dosage_value', 'dosage_unit', 'instructions',
            'start_date', 'end_date', 'is_indefinite',
            'refill_alert_days', 'total_quantity', 'remaining_quantity',
            'compartment_number', 'current_pill_count',
            'purpose', 'special_instructions', 'photo_url', 'notes',
        ]

    def validate(self, data):
        if not data.get('is_indefinite') and not data.get('end_date'):
            raise serializers.ValidationError({'end_date': 'Provide an end date or mark as indefinite.'})
        if data.get('end_date') and data.get('start_date') and data['end_date'] < data['start_date']:
            raise serializers.ValidationError({'end_date': 'End date cannot be before start date.'})
        return data


class PrescriptionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Prescription
        fields = [
            'prescribed_by', 'dosage_value', 'dosage_unit', 'instructions',
            'end_date', 'is_indefinite', 'refill_alert_days',
            'total_quantity', 'remaining_quantity',
            'compartment_number', 'current_pill_count',
            'purpose', 'special_instructions', 'photo_url', 'notes',
        ]

# ─── Caregiver-side patient views ─────────────────────────────────────────────

class PatientSummarySerializer(serializers.ModelSerializer):
    """Minimal patient data for caregiver dashboard."""
    full_name    = serializers.CharField(source='user.full_name', read_only=True)
    email        = serializers.EmailField(source='user.email', read_only=True)
    active_meds  = serializers.SerializerMethodField()
    permission   = serializers.SerializerMethodField()

    class Meta:
        model  = Patient
        fields = ['id', 'patient_code', 'full_name', 'email',
                  'timezone', 'is_hospitalized', 'active_meds', 'permission']

    def get_active_meds(self, obj) -> int:
        return obj.prescriptions.filter(is_active=True, deleted_at__isnull=True).count()

    def get_permission(self, obj) -> str:
        request = self.context.get('request')
        if not request:
            return ''
        try:
            link = obj.caregiver_links.get(caregiver__user=request.user, is_active=True)
            return link.permission_level
        except Exception:
            return ''


class DrugInteractionCheckLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DrugInteractionCheckLog
        fields = [
            'id', 'patient', 'prescription_id', 'medications_checked',
            'interactions_found', 'has_severe', 'api_source', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
