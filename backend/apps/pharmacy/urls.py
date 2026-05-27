from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PharmacyPartnerViewSet,
    PharmacyIntegrationView,
    AutoRefillToggleView,
    RefillOrderViewSet,
    PharmacyWebhookView
)

router = DefaultRouter()
router.register(r'partners', PharmacyPartnerViewSet, basename='pharmacy-partner')
router.register(r'refill-orders', RefillOrderViewSet, basename='refill-order')

urlpatterns = [
    path('', include(router.urls)),
    path('integration/', PharmacyIntegrationView.as_view(), name='pharmacy-integration'),
    path('integration/auto-refill/', AutoRefillToggleView.as_view(), name='auto-refill-toggle'),
    path('webhook/<slug:partner_slug>/', PharmacyWebhookView.as_view(), name='pharmacy-webhook'),
]
