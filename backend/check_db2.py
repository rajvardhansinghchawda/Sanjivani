import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.ambulances.models import Ambulance
from apps.authentication.models import User

users = User.objects.filter(role='ambulance')
for u in users:
    print(f"User: {u.id} {u.full_name} phone: {u.phone} role: {u.role}")

ambulances = Ambulance.objects.all()
for a in ambulances:
    print(f"Ambulance: {a.id} {a.driver_name} vehicle: {a.vehicle_number} Status: {a.status} Active: {a.is_active} driver_id: {a.driver_id}")
