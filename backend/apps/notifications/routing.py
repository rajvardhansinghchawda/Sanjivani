# apps/notifications/routing.py
from django.urls import re_path
from .consumers import AmbulanceDriverConsumer
from apps.supervisors.consumers import TriageDashboardConsumer
from apps.triage.consumers import PatientTriageConsumer

websocket_urlpatterns = [
    re_path(
        r'ws/ambulance/driver/(?P<ambulance_id>[0-9a-f-]{36})/$',
        AmbulanceDriverConsumer.as_asgi()
    ),
    re_path(r'ws/triage/$', TriageDashboardConsumer.as_asgi()),
    re_path(r'ws/triage/patient/(?P<case_id>[\w-]+)/$', PatientTriageConsumer.as_asgi()),
]