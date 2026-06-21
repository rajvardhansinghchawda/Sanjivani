import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.authentication.models import User
from apps.ambulances.models import Ambulance

try:
    u = User.objects.get(email='driver1@indorecarehospital.com')
    print(f"USER: {u.email} | Name: {u.full_name} | Role: {u.role}")
    
    # Check if there is an ambulance for this user
    amb = Ambulance.objects.filter(driver=u).first()
    if not amb:
        print("Creating ambulance for this driver...")
        amb = Ambulance.objects.create(
            driver=u,
            driver_name=u.full_name,
            driver_phone=u.phone or "9999999999",
            vehicle_number="TEST-AMB-01",
            city="Indore",
            status="available"
        )
        print("Created!")
    else:
        print(f"AMB EXISTS: ID={amb.id} | Name={amb.driver_name} | Status={amb.status}")
except Exception as e:
    print("Error:", e)
