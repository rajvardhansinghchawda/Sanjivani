from rest_framework import serializers
from .models import SideEffectReport

class SideEffectReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SideEffectReport
        fields = [
            'id', 'prescription', 'symptom', 'severity', 
            'onset_at', 'resolved_at', 'is_ongoing', 
            'reported_to_doctor', 'reported_to_cdsco', 'cdsco_report_id',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
