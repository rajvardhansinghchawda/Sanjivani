import logging
from apps.clinical.models import Patient
from .models import FamilyMember

logger = logging.getLogger('medadhere.family')

class FamilyContextMiddleware:
    """
    Resolves the active patient context from the 'X-Patient-Context' header.
    Validates that the logged-in user has permission to access this patient.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        patient_uuid = request.headers.get('X-Patient-Context')
        request.active_patient = None

        if patient_uuid and request.user.is_authenticated:
            try:
                # Check if patient exists and user has access via FamilyMember link or is the patient themselves
                # (Assuming Patient model has a 'user' field or similar)
                patient = Patient.objects.get(id=patient_uuid)
                
                # Check if user is the patient or a family member with view access
                # This is a simplified check
                is_owner = getattr(patient, 'user_id', None) == request.user.id
                is_family = FamilyMember.objects.filter(
                    group__owner=request.user, 
                    patient=patient
                ).exists()

                if is_owner or is_family:
                    request.active_patient = patient
                    logger.debug(f"Patient context set: {patient.id}")
                else:
                    logger.warning(f"Unauthorized patient context attempt: {patient_uuid} by user {request.user.id}")
            except (Patient.DoesNotExist, ValueError):
                pass

        return self.get_response(request)
