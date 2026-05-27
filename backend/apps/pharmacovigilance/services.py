import logging
from django.utils import timezone
from .models import SideEffectReport

logger = logging.getLogger('medadhere.pharmacovig')

class PharmacovigilanceService:
    @staticmethod
    def report_side_effect(patient_id: str, prescription_id: str, data: dict) -> SideEffectReport:
        """Log a new side effect and broadcast to orchestrator."""
        report = SideEffectReport.objects.create(
            patient_id=patient_id,
            prescription_id=prescription_id,
            **data
        )
        
        # Trigger orchestrator event (Phase 21)
        try:
            from agenthandover import get_orchestrator
            from medadhere_extensions_handover import PHARMACOVIG_AGENT, ExtAgentEvent, HandoverPayload
            
            payload = HandoverPayload(
                patient_id=patient_id,
                data={
                    "report_id": str(report.id),
                    "symptom": report.symptom,
                    "severity": report.severity
                },
            )
            get_orchestrator().broadcast(PHARMACOVIG_AGENT, ExtAgentEvent.SIDE_EFFECT_REPORTED, payload)
            
            if report.severity in ['SEVERE', 'LIFE_THREATENING']:
                get_orchestrator().broadcast(PHARMACOVIG_AGENT, ExtAgentEvent.SEVERE_SIDE_EFFECT_DETECTED, payload)
        except ImportError:
            logger.warning("Could not broadcast side effect report — orchestrator missing.")
            
        return report

    @staticmethod
    def mark_cdsco_reported(report: SideEffectReport, cdsco_id: str):
        """Mark a report as submitted to regulatory authorities."""
        report.reported_to_cdsco = True
        report.cdsco_report_id = cdsco_id
        report.save(update_fields=['reported_to_cdsco', 'cdsco_report_id', 'updated_at'])
        return report
