#!/usr/bin/env python
"""Seed ambulance data for testing"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from apps.ambulances.models import Ambulance
from apps.authentication.models import User
from apps.hospitals.models import Hospital

def seed_ambulances():
    """Create test ambulances for both hospitals"""
    
    # Get hospitals
    try:
        hospital1 = Hospital.objects.get(name='Indore Care Hospital', city='Indore')
        hospital2 = Hospital.objects.get(name='Bombay Hospital Indore', city='Indore')
    except Hospital.DoesNotExist:
        print('❌ Hospitals not found. Please run seed_two_hospitals.py first.')
        return
    
    # Get ambulance drivers
    drivers = User.objects.filter(role=User.Role.AMBULANCE)
    if drivers.count() < 4:
        print(f'❌ Not enough ambulance drivers (found {drivers.count()}, need 4)')
        return
    
    driver_list = list(drivers)
    
    ambulance_data = [
        {
            'hospital': hospital1,
            'driver': driver_list[0],
            'vehicle_number': 'ICH-AMB-001',
            'ambulance_type': 'icu',
            'city': 'Indore',
            'latitude': 22.7196,
            'longitude': 75.8577,
            'status': Ambulance.Status.AVAILABLE,
            'driver_name': 'Arjun Verma',
            'driver_phone': '9876500005',
        },
        {
            'hospital': hospital1,
            'driver': driver_list[1],
            'vehicle_number': 'ICH-AMB-002',
            'ambulance_type': 'basic',
            'city': 'Indore',
            'latitude': 22.7200,
            'longitude': 75.8580,
            'status': Ambulance.Status.AVAILABLE,
            'driver_name': 'Mohan Sharma',
            'driver_phone': '9876500006',
        },
        {
            'hospital': hospital2,
            'driver': driver_list[2],
            'vehicle_number': 'BHI-AMB-001',
            'ambulance_type': 'icu',
            'city': 'Indore',
            'latitude': 22.7192,
            'longitude': 75.8581,
            'status': Ambulance.Status.AVAILABLE,
            'driver_name': 'Suresh Singh',
            'driver_phone': '9876500013',
        },
        {
            'hospital': hospital2,
            'driver': driver_list[3],
            'vehicle_number': 'BHI-AMB-002',
            'ambulance_type': 'basic',
            'city': 'Indore',
            'latitude': 22.7185,
            'longitude': 75.8590,
            'status': Ambulance.Status.AVAILABLE,
            'driver_name': 'Ramesh Kumar',
            'driver_phone': '9876500014',
        },
    ]
    
    created = 0
    for data in ambulance_data:
        amb, created_flag = Ambulance.objects.get_or_create(
            vehicle_number=data['vehicle_number'],
            defaults=data
        )
        if created_flag:
            print(f'✓ Created ambulance: {amb.vehicle_number} ({amb.ambulance_type}) at {amb.hospital.name}')
            created += 1
        else:
            print(f'✓ Ambulance already exists: {amb.vehicle_number}')
    
    print(f'\n✅ Ambulance seeding complete! Created: {created}, Total: {Ambulance.objects.count()}')
    print('\n📊 Available ambulances by location:')
    for amb in Ambulance.objects.all():
        print(f'  - {amb.vehicle_number} ({amb.ambulance_type}): {amb.city} @ ({amb.latitude:.4f}, {amb.longitude:.4f})')

if __name__ == '__main__':
    seed_ambulances()
