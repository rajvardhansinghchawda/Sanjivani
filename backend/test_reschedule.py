import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from apps.clinical.views.caregivers import CaregiverCompartmentRescheduleView
from apps.identity.models import User
from apps.clinical.models import PatientCaregiverLink

patient_id = 'c5d8b018-809d-4462-901f-2d57852efa61'
device_id = 'e214a30b-c919-4d23-b3f1-80557b756cdd'
compartment_number = 3

# Find a caregiver linked to this patient
link = PatientCaregiverLink.objects.filter(patient__id=patient_id, is_active=True).first()
if not link:
    print("Error: No caregiver link found for patient")
    sys.exit(1)

caregiver_user = link.caregiver.user
print(f"Using caregiver: {caregiver_user.email}")

factory = APIRequestFactory()
request = factory.patch(
    f'/api/v1/caregivers/patients/{patient_id}/devices/{device_id}/compartments/{compartment_number}/reschedule/',
    data={'times': ['09:00', '21:00']},
    format='json'
)
force_authenticate(request, user=caregiver_user)

view = CaregiverCompartmentRescheduleView.as_view()
try:
    response = view(request, patient_id=patient_id, device_id=device_id, compartment_number=compartment_number)
    print("Response status code:", response.status_code)
    print("Response data:", getattr(response, 'data', None))
except Exception as e:
    import traceback
    traceback.print_exc()
