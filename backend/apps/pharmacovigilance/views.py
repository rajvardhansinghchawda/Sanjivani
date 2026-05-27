from rest_framework import viewsets, permissions
from .models import SideEffectReport
from .serializers import SideEffectReportSerializer

class SideEffectReportViewSet(viewsets.ModelViewSet):
    """
    Manage side effect reports for the patient.
    """
    serializer_class = SideEffectReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SideEffectReport.objects.filter(patient__user=self.request.user)

    def perform_create(self, serializer):
        report = serializer.save(patient=self.request.user.patient)
        
        # If SEVERE, alert doctor and pharmacovigilance agent
        if report.severity in ['SEVERE', 'LIFE_THREATENING']:
            from agenthandover import get_orchestrator, AgentName, AgentEvent, HandoverPayload
            orchestrator = get_orchestrator()
            payload = HandoverPayload(
                patient_id=str(self.request.user.patient.id),
                data={
                    'report_id': str(report.id),
                    'symptom': report.symptom,
                    'severity': report.severity
                }
            )
            # Alert Doctor
            orchestrator.handover(AgentName.PHARMACOVIGILANCE, AgentName.DOCTOR, AgentEvent.SYSTEM_ALERT, payload)
            # Alert Admin/Safety
            orchestrator.handover(AgentName.PHARMACOVIGILANCE, AgentName.ADMIN, AgentEvent.SYSTEM_ALERT, payload)
