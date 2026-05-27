import logging
from django.utils import timezone
from .models import DoctorProfile, DoctorPatientLink, DigitalPrescription

logger = logging.getLogger('medadhere.doctor')

class DoctorService:
    @staticmethod
    def link_patient(doctor: DoctorProfile, patient_id: str, can_receive_alerts=True) -> DoctorPatientLink:
        """Link a patient to a doctor."""
        link, created = DoctorPatientLink.objects.get_or_create(
            doctor=doctor,
            patient_id=patient_id,
            defaults={'can_receive_alerts': can_receive_alerts}
        )
        if not created:
            link.can_receive_alerts = can_receive_alerts
            link.save(update_fields=['can_receive_alerts', 'updated_at'])
        return link

    @staticmethod
    def create_digital_prescription(doctor: DoctorProfile, patient_id: str, data: dict) -> DigitalPrescription:
        """Create a digital prescription from a doctor."""
        dp = DigitalPrescription.objects.create(
            doctor=doctor,
            patient_id=patient_id,
            **data
        )
        # Notify patient via Orchestrator (Phase 14)
        try:
            from agenthandover import get_orchestrator
            from medadhere_extensions_handover import DOCTOR_AGENT, ExtAgentEvent, HandoverPayload
            
            payload = HandoverPayload(
                patient_id=patient_id,
                data={'digital_rx_id': str(dp.id), 'medication_name': dp.medication_name},
            )
            get_orchestrator().broadcast(DOCTOR_AGENT, ExtAgentEvent.PRESCRIPTION_CREATED, payload)
        except ImportError:
            logger.warning("Could not broadcast digital prescription creation — orchestrator missing.")
            
        return dp

    @staticmethod
    def verify_doctor(doctor: DoctorProfile):
        """Mark a doctor as verified."""
        doctor.is_verified = True
        doctor.verified_at = timezone.now()
        doctor.save(update_fields=['is_verified', 'verified_at', 'updated_at'])
        return doctor
