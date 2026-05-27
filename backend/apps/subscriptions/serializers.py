from rest_framework import serializers
from .models import SubscriptionPlan, UserSubscription, SubscriptionInvoice

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    currency = serializers.SerializerMethodField()
    
    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'slug', 'price_monthly', 'price_yearly', 'currency', 'features', 'max_medications', 'max_caregivers']
    
    def get_currency(self, obj):
        return 'INR'

class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)

    class Meta:
        model = UserSubscription
        fields = ['id', 'plan', 'status', 'started_at', 'expires_at', 'auto_renew']

class SubscriptionInvoiceSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='subscription.plan.name', read_only=True)
    
    class Meta:
        model = SubscriptionInvoice
        fields = ['id', 'amount', 'currency', 'status', 'paid_at', 'pdf_url', 'plan_name', 'created_at']
