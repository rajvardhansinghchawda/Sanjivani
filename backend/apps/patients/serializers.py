# apps/patients/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Patient, TransferRequest
from apps.beds.models import Bed, BedAllocation


class PatientSerializer(serializers.ModelSerializer):
    is_admitted       = serializers.BooleanField(read_only=True)
    current_admission = serializers.SerializerMethodField()
    transfer_status   = serializers.SerializerMethodField()

    class Meta:
        model  = Patient
        fields = [
            'id', 'full_name', 'phone', 'email',
            'age', 'gender', 'blood_group',
            'address', 'city', 'area',
            'emergency_contact_name', 'emergency_contact_phone',
            'known_allergies', 'chronic_conditions',
            'is_admitted', 'current_admission',
            'transfer_status',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_transfer_status(self, obj):
        # Find if there is an active transfer request for this patient
        try:
            active_transfer = obj.transfer_requests.filter(
                status__in=['pending', 'accepted']
            ).first()
            return 'Transferred' if active_transfer else None
        except Exception:
            return None

    def get_current_admission(self, obj):
        admission = obj.current_admission
        if not admission:
            return None
        return {
            'allocation_id': str(admission.id),
            'bed_number'   : admission.bed.bed_number,
            'bed_type'     : admission.bed.bed_type,
            'ward_type'    : admission.bed.ward_type,
            'admitted_at'  : admission.admitted_at,
            'duration_days': admission.duration_days,
        }


class PatientPublicSerializer(serializers.ModelSerializer):
    """
    Minimal serializer — used when other apps reference
    a patient (e.g. in BedAllocation, TransferRequest).
    Never exposes medical history to non-staff.
    """
    class Meta:
        model  = Patient
        fields = ['id', 'full_name', 'phone', 'age', 'gender', 'blood_group']


class PatientSearchSerializer(serializers.Serializer):
    """Used by reception to quickly find a patient by phone."""
    phone = serializers.CharField()


# ── Transfer Request serializers ──────────────────────────────

class TransferRequestSerializer(serializers.ModelSerializer):
    patient_name        = serializers.CharField(source='patient.full_name',      read_only=True)
    patient_phone       = serializers.CharField(source='patient.phone',           read_only=True)
    patient_age         = serializers.IntegerField(source='patient.age',          read_only=True)
    patient_gender      = serializers.CharField(source='patient.gender',          read_only=True)
    patient_blood_group = serializers.CharField(source='patient.blood_group',     read_only=True)
    patient_condition   = serializers.CharField(source='patient.chronic_conditions', read_only=True)
    from_hospital_name  = serializers.CharField(source='from_hospital.name',      read_only=True)
    to_hospital_name    = serializers.CharField(source='to_hospital.name',        read_only=True)
    requested_by_name   = serializers.CharField(source='requested_by.full_name',  read_only=True)
    accepted_by_name    = serializers.CharField(source='accepted_by.full_name',   read_only=True)
    response_time_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model  = TransferRequest
        fields = [
            'id', 'status', 'priority',
            'patient', 'patient_name', 'patient_phone',
            'patient_age', 'patient_gender', 'patient_blood_group', 'patient_condition',
            'from_hospital', 'from_hospital_name',
            'to_hospital',   'to_hospital_name',
            'requested_by',  'requested_by_name',
            'accepted_by',   'accepted_by_name',
            'reason', 'required_bed_type', 'required_services',
            'rejection_reason', 'notes',
            'requested_at', 'responded_at', 'completed_at',
            'response_time_minutes',
        ]
        read_only_fields = [
            'id', 'requested_by', 'accepted_by',
            'requested_at', 'responded_at', 'completed_at',
            'response_time_minutes',
        ]


class CreateTransferRequestSerializer(serializers.ModelSerializer):
    """
    Used by reception when creating a new transfer.
    from_hospital is auto-set from the logged-in user's hospital.
    destination_hospital is optional — the hospital to transfer to.
    """
    # Accept the destination hospital UUID from the frontend
    destination_hospital = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model  = TransferRequest
        fields = [
            'patient', 'priority',
            'reason', 'required_bed_type', 'required_services',
            'notes', 'destination_hospital',
        ]

    def validate_patient(self, patient):
        # patient must be currently admitted at requesting hospital
        hospital = self.context['request'].user.hospital
        active = BedAllocation.objects.filter(
            patient=patient,
            bed__hospital=hospital,
            discharged_at__isnull=True
        ).exists()
        if not active:
            raise serializers.ValidationError(
                'Patient is not currently admitted at your hospital'
            )
        return patient

    def create(self, validated_data):
        from apps.hospitals.models import Hospital
        request = self.context['request']
        dest_hospital_id = validated_data.pop('destination_hospital', None)
        to_hospital = None
        if dest_hospital_id:
            try:
                to_hospital = Hospital.objects.get(pk=dest_hospital_id)
            except Hospital.DoesNotExist:
                pass
        return TransferRequest.objects.create(
            **validated_data,
            from_hospital=request.user.hospital,
            requested_by=request.user,
            to_hospital=to_hospital,
        )


class RespondToTransferSerializer(serializers.Serializer):
    """
    Used by receiving hospital's reception to accept or reject.
    """
    action           = serializers.ChoiceField(choices=['accept', 'reject'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    notes            = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['action'] == 'reject' and not attrs.get('rejection_reason'):
            raise serializers.ValidationError(
                {'rejection_reason': 'Rejection reason is required when rejecting'}
            )
        return attrs