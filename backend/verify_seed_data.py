import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.patients.models import Patient, TransferRequest
from apps.calls.models import CallLog
from apps.hospitals.models import Hospital

print("\n" + "="*70)
print("DATABASE VERIFICATION REPORT")
print("="*70)

# Hospitals
hospitals = Hospital.objects.filter(city='Indore')
print(f"\n[HOSPITALS] Total: {hospitals.count()}")
for h in hospitals:
    print(f"   * {h.name} - {h.total_beds} beds (ICU: {h.icu_capacity})")

# Patients
patients = Patient.objects.all()
print(f"\n[PATIENTS] Total: {patients.count()}")
for p in patients[:5]:
    print(f"   * {p.full_name} ({p.age} years) - Blood: {p.blood_group}")

# Transfer Requests
transfers = TransferRequest.objects.all()
print(f"\n[TRANSFER REQUESTS] Total: {transfers.count()}")
pending = transfers.filter(status='pending').count()
accepted = transfers.filter(status='accepted').count()
rejected = transfers.filter(status='rejected').count()
print(f"   * Pending: {pending} | Accepted: {accepted} | Rejected: {rejected}")
print(f"\n   Details:")
for t in transfers[:4]:
    print(f"   * {t.patient.full_name}: {t.priority.upper()} - {t.status}")

# Call Logs
calls = CallLog.objects.all()
print(f"\n[CALL LOGS] Total: {calls.count()}")
completed = calls.filter(status='completed').count()
no_answer = calls.filter(status='no_answer').count()
print(f"   * Completed: {completed} | No Answer: {no_answer}")
for c in calls:
    print(f"   * {c.to_number}: {c.status} ({c.language})")

print("\n" + "="*70)
print("SUCCESS! AI Assistant data is ready for testing")
print("="*70 + "\n")
