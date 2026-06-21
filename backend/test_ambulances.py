#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from apps.ambulances.models import Ambulance

print(f'Total ambulances: {Ambulance.objects.count()}')
print(f'Available: {Ambulance.objects.filter(status="available").count()}')
print(f'\nAmbulance details:')
for amb in Ambulance.objects.all()[:5]:
    print(f'  - {amb.vehicle_number}: status={amb.status}, city={amb.city}, lat={amb.latitude}, lng={amb.longitude}, type={amb.ambulance_type}')
