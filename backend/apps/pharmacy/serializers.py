from rest_framework import serializers
from .models import PharmacyPartner, PharmacyIntegration, RefillOrder

class PharmacyPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacyPartner
        fields = ['id', 'name', 'slug', 'supported_states', 'avg_delivery_hrs']

class PharmacyIntegrationSerializer(serializers.ModelSerializer):
    preferred_partner_details = PharmacyPartnerSerializer(source='preferred_partner', read_only=True)
    preferred_partner = serializers.PrimaryKeyRelatedField(
        queryset=PharmacyPartner.objects.filter(is_active=True),
        allow_null=True, required=False
    )

    class Meta:
        model = PharmacyIntegration
        fields = [
            'id', 'preferred_partner', 'preferred_partner_details',
            'delivery_address', 'saved_payment_method', 'auto_refill_enabled'
        ]
        read_only_fields = ['id']

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

class RefillOrderSerializer(serializers.ModelSerializer):
    partner_name = serializers.CharField(source='partner.name', read_only=True)
    prescription_details = serializers.SerializerMethodField()

    class Meta:
        model = RefillOrder
        fields = [
            'id', 'prescription', 'prescription_details', 'partner', 'partner_name',
            'quantity_ordered', 'status', 'partner_order_id', 'estimated_delivery',
            'delivered_at', 'total_amount', 'auto_triggered', 'failure_reason',
            'notes', 'created_at'
        ]
        read_only_fields = [
            'id', 'status', 'partner_order_id', 'estimated_delivery',
            'delivered_at', 'total_amount', 'auto_triggered', 'failure_reason',
            'created_at'
        ]

    def get_prescription_details(self, obj):
        try:
            return {
                'id': str(obj.prescription.id),
                'medication_name': obj.prescription.medication.name,
                'remaining_quantity': obj.prescription.remaining_quantity
            }
        except Exception:
            return None
