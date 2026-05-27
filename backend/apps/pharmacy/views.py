import hmac
import hashlib
from rest_framework import viewsets, generics, views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from .models import PharmacyPartner, PharmacyIntegration, RefillOrder
from .serializers import (
    PharmacyPartnerSerializer,
    PharmacyIntegrationSerializer,
    RefillOrderSerializer
)

class PharmacyPartnerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PharmacyPartner.objects.filter(is_active=True)
    serializer_class = PharmacyPartnerSerializer
    permission_classes = [IsAuthenticated]

class PharmacyIntegrationView(generics.RetrieveUpdateAPIView):
    serializer_class = PharmacyIntegrationSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        integration, created = PharmacyIntegration.objects.get_or_create(patient=self.request.user)
        return integration

class AutoRefillToggleView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        integration, _ = PharmacyIntegration.objects.get_or_create(patient=request.user)
        enabled = request.data.get('auto_refill_enabled', False)
        
        # Must have a preferred partner to enable
        if enabled and not integration.preferred_partner:
            return Response(
                {"error": "Please select a preferred pharmacy partner first."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        integration.auto_refill_enabled = enabled
        integration.save()
        return Response({"auto_refill_enabled": enabled})

class RefillOrderViewSet(viewsets.ModelViewSet):
    serializer_class = RefillOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RefillOrder.objects.filter(prescription__patient=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        integration, _ = PharmacyIntegration.objects.get_or_create(patient=self.request.user)
        partner = self.request.data.get('partner_id')
        
        if partner:
            partner_obj = get_object_or_404(PharmacyPartner, id=partner)
        else:
            partner_obj = integration.preferred_partner
            
        if not partner_obj:
            from rest_framework import serializers
            raise serializers.ValidationError({"partner_id": "Pharmacy partner is required."})
            
        serializer.save(
            partner=partner_obj,
            status='PENDING',
            auto_triggered=False
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status not in ['PENDING', 'ACCEPTED']:
            return Response(
                {"error": f"Cannot cancel order in {order.status} status."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        order.status = 'CANCELLED'
        order.save()
        return Response({"status": "cancelled"})

class PharmacyWebhookView(views.APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, partner_slug, *args, **kwargs):
        # 1. Fetch partner to get webhook secret
        partner = get_object_or_404(PharmacyPartner, slug=partner_slug)
        
        # 2. Validate HMAC signature
        received_sig = request.headers.get('X-MedAdhere-Signature')
        if not received_sig:
            return Response({"error": "Missing signature"}, status=status.HTTP_401_UNAUTHORIZED)
            
        computed_sig = hmac.new(
            partner.webhook_secret.encode(),
            request.body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(computed_sig, received_sig):
            return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        # 3. Process payload
        partner_order_id = request.data.get('order_id')
        new_status = request.data.get('status')
        
        if not partner_order_id or not new_status:
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = RefillOrder.objects.get(
                partner=partner, 
                partner_order_id=partner_order_id
            )
            
            # Map external status to internal status
            status_map = {
                'accepted': 'PARTNER_CONFIRMED',
                'shipped':  'DISPATCHED',
                'delivered':'DELIVERED',
                'failed':   'FAILED'
            }
            
            internal_status = status_map.get(new_status.lower())
            if internal_status:
                order.status = internal_status
                if internal_status == 'DELIVERED':
                    from django.utils import timezone
                    order.delivered_at = timezone.now()
                order.save()
                
            return Response({"status": "success"})
        except RefillOrder.DoesNotExist:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
