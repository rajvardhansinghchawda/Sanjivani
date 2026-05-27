"""
apps/telemetry/serializers.py
"""
from rest_framework import serializers
from .models import IoTDevice, TelemetryEvent, VitalReading, Anomaly


class IoTDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = IoTDevice
        fields = [
            'id', 'device_type', 'device_name', 'hardware_id', 'firmware_version',
            'is_active', 'last_seen_at', 'battery_level', 'signal_strength',
            'compartments', 'meta',
        ]
        read_only_fields = ['id', 'last_seen_at']


class IoTDeviceRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = IoTDevice
        fields = ['device_type', 'device_name', 'hardware_id', 'firmware_version', 'compartments', 'meta']


class TelemetryEventIngestSerializer(serializers.Serializer):
    event_type      = serializers.CharField(max_length=30)
    payload         = serializers.DictField()
    occurred_at     = serializers.DateTimeField(required=False)
    idempotency_key = serializers.CharField(max_length=200, required=False)
    sequence_no     = serializers.IntegerField(required=False)


class VitalReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VitalReading
        fields = [
            'id', 'vital_type', 'value_primary', 'value_secondary',
            'unit', 'recorded_at', 'source', 'is_abnormal', 'notes',
        ]
        read_only_fields = ['id', 'is_abnormal']


class ManualVitalSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VitalReading
        fields = ['vital_type', 'value_primary', 'value_secondary', 'unit', 'recorded_at', 'notes']


class AnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Anomaly
        fields = [
            'id', 'anomaly_type', 'severity', 'description',
            'is_resolved', 'resolved_at', 'metadata', 'created_at',
        ]
