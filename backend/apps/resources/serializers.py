# apps/resources/serializers.py
from rest_framework import serializers
from .models import ResourceSharingRequest

class ResourceSharingRequestSerializer(serializers.ModelSerializer):
    requester_hospital_name = serializers.SerializerMethodField()
    provider_hospital_name = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    provider_contact_name = serializers.SerializerMethodField()

    def get_requester_hospital_name(self, obj):
        return getattr(getattr(obj, "requester_hospital", None), "name", None)

    def get_provider_hospital_name(self, obj):
        return getattr(getattr(obj, "provider_hospital", None), "name", None)

    def get_requested_by_name(self, obj):
        return getattr(getattr(obj, "requested_by", None), "full_name", None)

    def get_provider_contact_name(self, obj):
        return getattr(getattr(obj, "provider_contact", None), "full_name", None)

    class Meta:
        model = ResourceSharingRequest
        fields = [
            'id', 'requester_hospital', 'requester_hospital_name',
            'provider_hospital', 'provider_hospital_name',
            'equipment_type', 'quantity', 'priority', 'status',
            'requested_by', 'requested_by_name',
            'provider_contact', 'provider_contact_name',
            'reason', 'rejection_reason', 'notes',
            'created_at', 'updated_at', 'responded_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'responded_at', 'completed_at',
            'requested_by', 'requester_hospital'
        ]

    def create(self, validated_data):
        return ResourceSharingRequest.objects.create(**validated_data)
