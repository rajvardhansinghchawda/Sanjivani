"""
apps/telemetry/views.py — IoT device management, telemetry ingest, vitals, anomalies.
"""
import logging
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from shared.response import APIResponse
from shared.permissions import IsPatient
from shared.pagination import StandardResultsPagination
from .models import IoTDevice, VitalReading, Anomaly
from .serializers import (
    IoTDeviceSerializer, IoTDeviceRegisterSerializer,
    TelemetryEventIngestSerializer, VitalReadingSerializer,
    ManualVitalSerializer, AnomalySerializer,
)
from .services import TelemetryIngestService

logger = logging.getLogger('medadhere')


def get_patient_or_404(user):
    try:
        return user.patient_profile
    except Exception:
        from django.http import Http404
        raise Http404


# ─── IoT Device Management ────────────────────────────────────────────────────

class IoTDeviceListCreateView(APIView):
    """GET/POST /api/v1/iot/devices/"""
    permission_classes = [IsAuthenticated, IsPatient]

    def get(self, request):
        from apps.subscriptions.gates import SubscriptionGate
        try:
            SubscriptionGate.check_feature(request.user, 'iot_device')
        except Exception as e:
            return APIResponse.error(str(e), code='SUBSCRIPTION_LIMIT', status=402)

        patient = get_patient_or_404(request.user)
        devices = IoTDevice.objects.filter(patient=patient, deleted_at__isnull=True)
        return APIResponse.success(IoTDeviceSerializer(devices, many=True).data)

    def post(self, request):
        from apps.subscriptions.gates import SubscriptionGate
        try:
            SubscriptionGate.check_feature(request.user, 'iot_device')
        except Exception as e:
            return APIResponse.error(str(e), code='SUBSCRIPTION_LIMIT', status=402)

        patient = get_patient_or_404(request.user)
        s = IoTDeviceRegisterSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)

        import secrets, hashlib
        raw_key  = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

        device = IoTDevice.objects.create(patient=patient, api_key_hash=key_hash, **s.validated_data)
        return APIResponse.created({
            **IoTDeviceSerializer(device).data,
            'api_key': raw_key,   # returned ONCE — store it on device
        }, message='Device registered. Store the api_key securely on your device.')


class IoTDeviceDetailView(APIView):
    """GET/PATCH/DELETE /api/v1/iot/devices/{id}/"""
    permission_classes = [IsAuthenticated, IsPatient]

    def _get_device(self, request, device_id):
        patient = get_patient_or_404(request.user)
        return get_object_or_404(IoTDevice, id=device_id, patient=patient, deleted_at__isnull=True)

    def get(self, request, device_id):
        return APIResponse.success(IoTDeviceSerializer(self._get_device(request, device_id)).data)

    def patch(self, request, device_id):
        device = self._get_device(request, device_id)
        s = IoTDeviceSerializer(device, data=request.data, partial=True)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)
        s.save()
        return APIResponse.success(s.data, message='Device updated.')

    def delete(self, request, device_id):
        device = self._get_device(request, device_id)
        device.soft_delete()
        return APIResponse.no_content('Device removed.')


# ─── Telemetry Ingest (Device → Server) ──────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class TelemetryIngestView(APIView):
    """
    POST /api/v1/iot/ingest/
    Authenticated via X-Device-Key header (device API key).
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        from identity.authentication import DeviceAPIKeyAuthentication
        import hashlib

        hw_id   = request.META.get('HTTP_X_DEVICE_ID', '')
        api_key = request.META.get('HTTP_X_DEVICE_KEY', '')

        if not hw_id or not api_key:
            return APIResponse.error('X-Device-ID and X-Device-Key headers required.', status=401)

        try:
            device = IoTDevice.objects.get(hardware_id=hw_id, is_active=True)
        except IoTDevice.DoesNotExist:
            return APIResponse.error('Device not found.', status=401)

        # Verify key
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        if key_hash != device.api_key_hash:
            return APIResponse.error('Invalid device key.', status=401)

        s = TelemetryEventIngestSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)

        event = TelemetryIngestService.ingest(
            device=device,
            event_type=s.validated_data['event_type'],
            payload=s.validated_data['payload'],
            occurred_at=s.validated_data.get('occurred_at'),
            idempotency_key=s.validated_data.get('idempotency_key'),
            sequence_no=s.validated_data.get('sequence_no'),
        )
        return APIResponse.created({'event_id': str(event.id)}, message='Event ingested.')


# ─── Vital Signs ──────────────────────────────────────────────────────────────

class VitalReadingListView(APIView):
    """GET /api/v1/vitals/?vital_type=HEART_RATE&days=7"""
    permission_classes = [IsAuthenticated, IsPatient]

    def get(self, request):
        import datetime
        patient    = get_patient_or_404(request.user)
        days       = min(int(request.query_params.get('days', 7)), 90)
        vital_type = request.query_params.get('vital_type')
        since      = timezone.now() - datetime.timedelta(days=days)

        qs = VitalReading.objects.filter(patient=patient, recorded_at__gte=since, deleted_at__isnull=True)
        if vital_type:
            qs = qs.filter(vital_type=vital_type.upper())

        paginator = StandardResultsPagination()
        page = paginator.paginate_queryset(qs.order_by('-recorded_at'), request)
        return paginator.get_paginated_response(VitalReadingSerializer(page, many=True).data)

    def post(self, request):
        """POST /api/v1/vitals/ — manual vital entry."""
        patient = get_patient_or_404(request.user)
        s = ManualVitalSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)

        from .services import VITAL_THRESHOLDS
        from decimal import Decimal
        vt  = s.validated_data['vital_type']
        val = s.validated_data['value_primary']
        th  = VITAL_THRESHOLDS.get(vt, {})
        is_abnormal = (th.get('low') and val < th['low']) or (th.get('high') and val > th['high'])

        reading = VitalReading.objects.create(
            patient=patient, source='MANUAL', is_abnormal=is_abnormal, **s.validated_data
        )
        return APIResponse.created(VitalReadingSerializer(reading).data)


# ─── Anomalies ────────────────────────────────────────────────────────────────

class AnomalyListView(APIView):
    """GET /api/v1/anomalies/?resolved=false"""
    permission_classes = [IsAuthenticated, IsPatient]

    def get(self, request):
        patient = get_patient_or_404(request.user)
        qs = Anomaly.objects.filter(patient=patient, deleted_at__isnull=True)
        resolved = request.query_params.get('resolved')
        if resolved is not None:
            qs = qs.filter(is_resolved=resolved.lower() == 'true')
        return APIResponse.success(AnomalySerializer(qs[:50], many=True).data)


class AnomalyResolveView(APIView):
    """PATCH /api/v1/anomalies/{id}/resolve/"""
    permission_classes = [IsAuthenticated, IsPatient]

    def patch(self, request, anomaly_id):
        patient = get_patient_or_404(request.user)
        anomaly = get_object_or_404(Anomaly, id=anomaly_id, patient=patient)
        anomaly.is_resolved = True
        anomaly.resolved_at = timezone.now()
        anomaly.resolved_by = request.user
        anomaly.save(update_fields=['is_resolved', 'resolved_at', 'resolved_by', 'updated_at'])
        return APIResponse.success(AnomalySerializer(anomaly).data, message='Anomaly resolved.')
