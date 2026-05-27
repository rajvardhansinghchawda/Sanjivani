"""
apps/clinical/views/patients.py — Patient profile, conditions, hospitalization.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from shared.response import APIResponse
from shared.permissions import IsPatient
from ..models import Patient, PatientCondition
from ..serializers import (
    PatientSerializer, PatientUpdateSerializer,
    PatientConditionSerializer, HospitalizationSerializer,
)


def get_patient_or_404(user):
    try:
        return user.patient_profile
    except Patient.DoesNotExist:
        from django.http import Http404
        raise Http404('Patient profile not found.')


# ─── Patient Profile ──────────────────────────────────────────────────────────

class PatientMeView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def get(self, request):
        """GET /api/v1/patients/me/"""
        patient = get_patient_or_404(request.user)
        return APIResponse.success(PatientSerializer(patient).data)

    def put(self, request):
        """PUT /api/v1/patients/me/"""
        patient = get_patient_or_404(request.user)
        old_tz  = patient.timezone
        s = PatientUpdateSerializer(patient, data=request.data, partial=True)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)
        s.save()

        # Timezone changed → regenerate all reminders
        new_tz = s.validated_data.get('timezone')
        if new_tz and new_tz != old_tz:
            from apps.scheduling.services import ScheduleGenerationService
            ScheduleGenerationService.on_timezone_change(patient, new_tz)

        return APIResponse.success(PatientSerializer(patient).data, message='Profile updated.')


class PatientHospitalizeView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def patch(self, request):
        """PATCH /api/v1/patients/me/hospitalize/"""
        patient = get_patient_or_404(request.user)
        s = HospitalizationSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)

        patient.is_hospitalized       = True
        patient.hospitalized_since    = s.validated_data.get('hospitalized_since', timezone.now())
        patient.discharge_expected_at = s.validated_data.get('discharge_expected_at')
        patient.hospital_name         = s.validated_data.get('hospital_name', '')
        patient.save(update_fields=['is_hospitalized', 'hospitalized_since', 'discharge_expected_at', 'hospital_name', 'updated_at'])
        return APIResponse.success(PatientSerializer(patient).data, message='Marked as hospitalized.')


class PatientDischargeView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def patch(self, request):
        """PATCH /api/v1/patients/me/discharge/"""
        patient = get_patient_or_404(request.user)
        patient.is_hospitalized       = False
        patient.hospitalized_since    = None
        patient.discharge_expected_at = None
        patient.hospital_name         = None
        patient.save(update_fields=['is_hospitalized', 'hospitalized_since', 'discharge_expected_at', 'hospital_name', 'updated_at'])
        return APIResponse.success(message='Marked as discharged.')


# ─── Conditions ───────────────────────────────────────────────────────────────

class PatientConditionListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def get(self, request):
        """GET /api/v1/patients/me/conditions/"""
        patient    = get_patient_or_404(request.user)
        conditions = PatientCondition.objects.filter(patient=patient, deleted_at__isnull=True)
        return APIResponse.success(PatientConditionSerializer(conditions, many=True).data)

    def post(self, request):
        """POST /api/v1/patients/me/conditions/"""
        patient = get_patient_or_404(request.user)
        s = PatientConditionSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)
        condition = s.save(patient=patient)
        return APIResponse.created(PatientConditionSerializer(condition).data)


class PatientConditionDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def delete(self, request, condition_id):
        """DELETE /api/v1/patients/me/conditions/{id}/"""
        patient = get_patient_or_404(request.user)
        try:
            condition = PatientCondition.objects.get(id=condition_id, patient=patient, deleted_at__isnull=True)
            condition.soft_delete()
            return APIResponse.no_content('Condition removed.')
        except PatientCondition.DoesNotExist:
            return APIResponse.not_found('Condition not found.')
