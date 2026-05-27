from .models import VitalReading, VitalTarget
from django.utils import timezone
import logging

logger = logging.getLogger('medadhere.vitals')

class VitalsService:
    @staticmethod
    def check_target(patient, vital_type, value):
        try:
            target = VitalTarget.objects.get(patient=patient, vital_type=vital_type)
            if target.min_value and value < target.min_value:
                return True, "Low"
            if target.max_value and value > target.max_value:
                return True, "High"
            return False, "Normal"
        except VitalTarget.DoesNotExist:
            return False, "No Target"

    @staticmethod
    def log_vital(patient, vital_type, value, unit, source="MANUAL"):
        is_oor, status = VitalsService.check_target(patient, vital_type, value)
        
        reading = VitalReading.objects.create(
            patient=patient,
            vital_type=vital_type,
            value=value,
            unit=unit,
            source=source,
            is_out_of_range=is_oor,
            measured_at=timezone.now()
        )
        
        if is_oor:
            # Trigger alert via Orchestrator (Phase 19)
            try:
                from agenthandover import get_orchestrator
                from medadhere_extensions_handover import VITALS_AGENT, ExtAgentEvent, HandoverPayload
                
                payload = HandoverPayload(
                    patient_id=str(patient.id),
                    data={
                        "vital_type": vital_type,
                        "value": value,
                        "status": status,
                        "reading_id": str(reading.id)
                    }
                )
                get_orchestrator().broadcast(VITALS_AGENT, ExtAgentEvent.VITAL_OUT_OF_RANGE, payload)
            except ImportError:
                logger.warning("Could not broadcast vital alert — orchestrator missing.")
            
        return reading

