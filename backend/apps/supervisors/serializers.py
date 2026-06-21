# apps/supervisors/serializers.py
from rest_framework import serializers
from .models import Alert, ResourceAvailability


class AlertSerializer(serializers.ModelSerializer):
    hospital_name    = serializers.CharField(source='hospital.name',       read_only=True)
    raised_by_name   = serializers.CharField(source='raised_by.full_name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.full_name', read_only=True)
    bed_number       = serializers.CharField(source='bed.bed_number',      read_only=True)
    department_name  = serializers.CharField(source='department.name',     read_only=True)
    duration_hours   = serializers.FloatField(read_only=True)

    class Meta:
        model  = Alert
        fields = [
            'id', 'alert_type', 'severity', 'status',
            'title', 'description', 'resolution_note',
            'hospital', 'hospital_name',
            'raised_by', 'raised_by_name',
            'resolved_by', 'resolved_by_name',
            'bed', 'bed_number',
            'department', 'department_name',
            'meta_data', 'duration_hours',
            'created_at', 'updated_at', 'resolved_at',
        ]
        read_only_fields = [
            'id', 'raised_by', 'resolved_by',
            'created_at', 'updated_at', 'resolved_at',
            'duration_hours',
        ]


class CreateAlertSerializer(serializers.ModelSerializer):
    """Supervisor manually raises an alert."""
    class Meta:
        model  = Alert
        fields = [
            'hospital', 'bed', 'department',
            'alert_type', 'severity',
            'title', 'description', 'meta_data',
        ]

    def create(self, validated_data):
        return Alert.objects.create(
            **validated_data,
            raised_by=self.context['request'].user
        )


class ResolveAlertSerializer(serializers.Serializer):
    """Supervisor resolves or dismisses an alert."""
    action          = serializers.ChoiceField(choices=['resolve', 'dismiss', 'investigate'])
    resolution_note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['action'] == 'resolve' and not attrs.get('resolution_note'):
            raise serializers.ValidationError(
                {'resolution_note': 'Resolution note is required when resolving'}
            )
        return attrs


class ResourceAvailabilitySerializer(serializers.ModelSerializer):
    hospital_name   = serializers.CharField(source='hospital.name',    read_only=True)
    department_name = serializers.CharField(source='department.name',  read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True)

    class Meta:
        model  = ResourceAvailability
        fields = [
            'id', 'resource_type',
            'hospital', 'hospital_name',
            'department', 'department_name',
            'total_count', 'available_count', 'availability_status',
            'updated_by', 'updated_by_name',
            'notes', 'recorded_at',
        ]
        read_only_fields = ['id', 'updated_by', 'recorded_at']

    def create(self, validated_data):
        return ResourceAvailability.objects.create(
            **validated_data,
            updated_by=self.context['request'].user
        )


class HospitalMonitorSerializer(serializers.Serializer):
    """
    Summary view of a hospital's current state.
    Used on supervisor dashboard — one card per hospital.
    """
    hospital_id         = serializers.UUIDField()
    hospital_name       = serializers.CharField()
    city                = serializers.CharField()
    verification_status = serializers.CharField()
    total_beds          = serializers.IntegerField()
    available_beds      = serializers.IntegerField()
    occupied_beds       = serializers.IntegerField()
    open_alerts         = serializers.IntegerField()
    high_alerts         = serializers.IntegerField()
    pending_transfers   = serializers.IntegerField()
    long_occupancy_beds = serializers.IntegerField()