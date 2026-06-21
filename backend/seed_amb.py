import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.ambulances.models import Ambulance
from apps.authentication.models import User

users = User.objects.filter(role='ambulance')
for i, u in enumerate(users):
    amb, created = Ambulance.objects.get_or_create(
        driver=u,
        defaults={
            'vehicle_number': f'MP09-AMB-{1000+i}',
            'ambulance_type': 'basic',
            'driver_name': u.full_name,
            'driver_phone': u.phone,
            'city': 'Indore',
            'status': 'available',
            'is_active': True,
        }
    )
    print(f"Ambulance {amb.vehicle_number} for {u.full_name}: created={created}")
