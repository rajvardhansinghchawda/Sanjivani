import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.ambulances.models import Ambulance
from apps.triage.models import EmergencyCase

ambulances = Ambulance.objects.all()
for a in ambulances:
    print(f"Ambulance: {a.id} {a.driver_name} Status: {a.status} Active: {a.is_active}")

cases = EmergencyCase.objects.all().order_by('-created_at')[:2]
for c in cases:
    print(f"Case: {c.case_id} Patient: {c.patient_name} Status: {c.status}")

from apps.ambulances.models import AmbulanceRequest
requests = AmbulanceRequest.objects.all().order_by('-requested_at')[:2]
for r in requests:
    print(f"Request: {r.id} Status: {r.status} Patient: {r.requester_name}")
