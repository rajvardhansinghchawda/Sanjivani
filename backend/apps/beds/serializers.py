# apps/beds/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Bed, BedAllocation, MedicalEquipment


class BedSerializer(serializers.ModelSerializer):
    department_name  = serializers.CharField(source='department.name',     read_only=True)
    hospital_name    = serializers.CharField(source='hospital.name',       read_only=True)
    occupancy_days   = serializers.IntegerField(read_only=True)
    is_available     = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Bed
        fields = [
            'id', 'bed_number', 'bed_type', 'ward_type',
            'status', 'is_available', 'occupancy_days',
            'department', 'department_name',
            'hospital', 'hospital_name',
            'notes', 'is_active', 'last_updated',
        ]
        read_only_fields = ['id', 'hospital', 'last_updated']

    def validate(self, attrs):
        hospital   = self.context.get('hospital')
        bed_number = attrs.get('bed_number', getattr(self.instance, 'bed_number', None))

        # uniqueness check within hospital
        qs = Bed.objects.filter(hospital=hospital, bed_number=bed_number)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'bed_number': f'Bed {bed_number} already exists in this hospital'}
            )
        return attrs


class BedStatusUpdateSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer — reception staff only updates status + notes.
    Used for the most frequent operation in the system.
    """
    class Meta:
        model  = Bed
        fields = ['status', 'notes']


class BedAllocationSerializer(serializers.ModelSerializer):
    bed_number     = serializers.CharField(source='bed.bed_number',    read_only=True)
    bed_type       = serializers.CharField(source='bed.bed_type',      read_only=True)
    patient_name   = serializers.CharField(source='patient.full_name', read_only=True)
    allocated_by_name = serializers.CharField(source='allocated_by.full_name', read_only=True)
    duration_days  = serializers.IntegerField(read_only=True)
    is_active      = serializers.BooleanField(read_only=True)

    class Meta:
        model  = BedAllocation
        fields = [
            'id', 'bed', 'bed_number', 'bed_type',
            'patient', 'patient_name',
            'allocated_by', 'allocated_by_name',
            'admitted_at', 'discharged_at',
            'duration_days', 'is_active', 'notes',
        ]
        read_only_fields = ['id', 'admitted_at', 'allocated_by']


class AdmitPatientSerializer(serializers.Serializer):
    """Admit a patient to a specific bed."""
    bed_id     = serializers.UUIDField()
    patient_id = serializers.UUIDField()
    notes      = serializers.CharField(required=False, allow_blank=True)

    def validate_bed_id(self, value):
        try:
            bed = Bed.objects.get(pk=value)
        except Bed.DoesNotExist:
            raise serializers.ValidationError('Bed not found')
        if not bed.is_available:
            raise serializers.ValidationError(
                f'Bed {bed.bed_number} is currently {bed.status}'
            )
        return value


class DischargePatientSerializer(serializers.Serializer):
    """Discharge a patient — frees the bed."""
    allocation_id = serializers.UUIDField()
    notes         = serializers.CharField(required=False, allow_blank=True)

    def validate_allocation_id(self, value):
        try:
            alloc = BedAllocation.objects.get(pk=value, discharged_at__isnull=True)
        except BedAllocation.DoesNotExist:
            raise serializers.ValidationError('Active allocation not found')
        return value


class MedicalEquipmentSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    hospital_name   = serializers.CharField(source='hospital.name',   read_only=True)

    class Meta:
        model  = MedicalEquipment
        fields = [
            'id', 'name', 'equipment_type', 'manufacturer',
            'model_number', 'serial_number',
            'quantity', 'available_quantity', 'status',
            'department', 'department_name',
            'hospital', 'hospital_name',
            'last_used', 'installation_date', 'next_maintenance',
            'updated_at',
        ]
        read_only_fields = ['id', 'hospital', 'updated_at']