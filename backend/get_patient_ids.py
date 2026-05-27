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

from apps.clinical.models import Patient

def list_patients():
    patients = Patient.objects.all()
    print(f"--- Listing All Patients ({patients.count()}) ---")
    for p in patients:
        print(f"ID: {p.id} | Name: {p.user.full_name} | Email: {p.user.email}")

if __name__ == '__main__':
    list_patients()
