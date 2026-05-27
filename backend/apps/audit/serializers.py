"""
apps/audit/serializers.py
"""
from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'created_at', 'actor', 'actor_email', 'action',
            'resource_type', 'resource_id', 'ip_address',
            'before_state', 'after_state', 'trace_id',
        ]

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else None
