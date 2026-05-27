import os
import django
import sys
from pathlib import Path

# Setup Django
BASE_DIR = Path(__file__).resolve().parents[0]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.identity.models import User
from apps.clinical.models import Patient, PatientCaregiverLink

def debug_access(patient_id_str):
    print(f"--- Debugging Access for Patient ID: {patient_id_str} ---")
    
    # 1. Check if Patient exists
    patient = Patient.objects.filter(id=patient_id_str).first()
    if not patient:
        print(f"[-] Patient with ID {patient_id_str} NOT FOUND in database.")
        # Check if it might be a User ID
        user_as_patient = User.objects.filter(id=patient_id_str).first()
        if user_as_patient:
            print(f"[!] Found a USER with this ID. Are you using the User ID instead of Patient ID?")
            if hasattr(user_as_patient, 'patient_profile'):
                print(f"    This user's Patient ID is: {user_as_patient.patient_profile.id}")
        return

    print(f"[+] Patient Found: {patient}")
    print(f"    Linked User: {patient.user.email} (ID: {patient.user.id})")

    # 2. Check Caregiver Links
    links = PatientCaregiverLink.objects.filter(patient=patient)
    if not links.exists():
        print(f"[-] No caregivers linked to this patient.")
    else:
        print(f"[+] Found {links.count()} caregiver links:")
        for link in links:
            print(f"    - Caregiver: {link.caregiver.user.email} (Active: {link.is_active})")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        debug_access(sys.argv[1])
    else:
        print("Usage: python debug_permission.py <patient_id>")
