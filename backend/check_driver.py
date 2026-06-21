import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.authentication.models import User
from apps.ambulances.models import Ambulance

try:
    u = User.objects.get(email='driver1@indorecarehospital.com')
    print(f"Found user: {u.full_name} | Role: {u.role}")
    
    amb = Ambulance.objects.filter(driver=u).first()
    if amb:
        print(f"Ambulance: {amb.driver_name} | Status: {amb.status} | Active: {amb.is_active}")
    else:
        print("NO AMBULANCE RECORD FOR THIS USER!")
except User.DoesNotExist:
    print("User driver1@indorecarehospital.com NOT FOUND.")
