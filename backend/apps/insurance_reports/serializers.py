from rest_framework import serializers
from .models import AdherenceReportShare, ReportAccessLog

class AdherenceReportShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdherenceReportShare
        fields = [
            'id', 'recipient_type', 'recipient_name', 
            'access_token', 'expires_at', 'data_scope', 
            'is_revoked', 'access_count', 'created_at'
        ]
        read_only_fields = ['id', 'access_token', 'expires_at', 'access_count', 'created_at']

class ReportAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportAccessLog
        fields = '__all__'
