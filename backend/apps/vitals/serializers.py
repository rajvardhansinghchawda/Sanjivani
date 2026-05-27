from rest_framework import serializers
from .models import VitalReading, VitalTarget

class VitalTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = VitalTarget
        fields = ['id', 'patient', 'vital_type', 'min_value', 'max_value', 'unit', 'created_at']
        read_only_fields = ['id', 'patient', 'created_at']

class VitalReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = VitalReading
        fields = ['id', 'patient', 'vital_type', 'value', 'unit', 'measured_at', 'source', 'is_out_of_range']
        read_only_fields = ['id', 'patient', 'is_out_of_range']
