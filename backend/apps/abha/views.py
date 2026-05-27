from rest_framework import views, status, throttling
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import ABHAConnection
import logging

logger = logging.getLogger('medadhere')

class ABHASyncThrottle(throttling.UserRateThrottle):
    """
    Strict rate limit for ABHA sync as it involves external ABDM gateway calls.
    """
    scope = 'abha_sync'
    rate = '5/day'

class ABHASyncView(views.APIView):
    """
    POST /api/v1/abha/sync/
    Manually trigger sync from ABHA.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ABHASyncThrottle]

    def post(self, request):
        try:
            conn = ABHAConnection.objects.get(patient__user=request.user)
            
            # Handover to ABHAAgent
            from agenthandover import get_orchestrator, AgentName, AgentEvent, HandoverPayload
            orchestrator = get_orchestrator()
            
            payload = HandoverPayload(
                patient_id=str(conn.patient.id),
                user_id=str(request.user.id),
                data={'abha_id': conn.abha_id, 'manual_trigger': True}
            )
            
            # Using broadcast or direct handover
            # Usually ABHA sync might be a background task
            orchestrator.handover(AgentName.PATIENT, AgentName.ABHA, AgentEvent.SYSTEM_ALERT, payload)
            
            return Response({"status": "sync_requested", "abha_id": conn.abha_id})
            
        except ABHAConnection.DoesNotExist:
            return Response({"error": "ABHA connection not found for this user."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"ABHA Sync Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
