"""
apps/telemetry/urls.py
"""
from django.urls import path
from .views import (
    IoTDeviceListCreateView, IoTDeviceDetailView,
    TelemetryIngestView, VitalReadingListView,
    AnomalyListView, AnomalyResolveView,
)

iot_urlpatterns = [
    path('devices/',                IoTDeviceListCreateView.as_view(), name='iot-devices'),
    path('devices/<uuid:device_id>/', IoTDeviceDetailView.as_view(),  name='iot-device-detail'),
    path('ingest/',                 TelemetryIngestView.as_view(),     name='iot-ingest'),
]

vital_urlpatterns = [
    path('',    VitalReadingListView.as_view(), name='vitals'),
]

anomaly_urlpatterns = [
    path('',                          AnomalyListView.as_view(),    name='anomalies'),
    path('<uuid:anomaly_id>/resolve/', AnomalyResolveView.as_view(), name='anomaly-resolve'),
]

urlpatterns = iot_urlpatterns + vital_urlpatterns + anomaly_urlpatterns
