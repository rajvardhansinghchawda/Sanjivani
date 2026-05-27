"""
scripts/seed_permissions.py
---------------------------
Seeds Patient-Caregiver links and ensures caregivers have profiles.
Enables 'caregiver@medadhere.test' to access AI data for patients.
"""

import os
import django
import sys
import json
from pathlib import Path

# Setup Django
BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.identity.models import User, UserRole
from apps.clinical.models import Patient, Caregiver, PatientCaregiverLink, PermissionLevel

def seed_permissions():
    print("🚀 Seeding Caregiver Permissions...")
    
    # Path to JSON
    json_path = BASE_DIR / 'seed_data' / 'caregiver_permissions.json'
    if not json_path.exists():
        print(f"[-] ERROR: {json_path} not found.")
        return

    with open(json_path, 'r') as f:
        data = json.load(f)

    for entry in data:
        email = entry['caregiver_email']
        user = User.objects.filter(email=email).first()
        
        if not user:
            print(f"[-] User {email} not found. Skipping.")
            continue

        # Ensure Caregiver profile
        caregiver, created = Caregiver.objects.get_or_create(
            user=user,
            defaults={
                'is_professional': True,
                'specialty': 'General Medicine',
                'organization_name': 'MedAdhere Demo Clinic'
            }
        )
        if created:
            print(f"[+] Created Caregiver profile for {email}")

        # Link to patients
        if entry['patients'] == 'all':
            patients = Patient.objects.all()
        else:
            # Could implement specific patient list if needed
            patients = []

        link_count = 0
        for patient in patients:
            link, created = PatientCaregiverLink.objects.get_or_create(
                patient=patient,
                caregiver=caregiver,
                defaults={
                    'permission_level': entry['permission_level'].lower(),
                    'is_active': entry['is_active'],
                    'can_receive_alerts': True
                }
            )
            if created or not link.is_active:
                link.is_active = True
                link.save()
                link_count += 1
        
        print(f"[+] Linked {email} to {link_count} patients.")

    print("\n✅ Permissions seeding complete.")

if __name__ == '__main__':
    seed_permissions()
