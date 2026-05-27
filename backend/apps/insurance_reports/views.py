from rest_framework import views, status, throttling
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from .models import AdherenceReportShare
from .serializers import AdherenceReportShareSerializer
import logging

logger = logging.getLogger('medadhere')

class ReportShareThrottle(throttling.UserRateThrottle):
    """
    Prevent spamming report shares.
    """
    scope = 'report_share'
    rate = '3/day'

class ReportShareView(views.APIView):
    """
    POST /api/v1/reports/share/
    Create a secure, time-limited report share link.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ReportShareThrottle]

    def post(self, request):
        serializer = AdherenceReportShareSerializer(data=request.data)
        if serializer.is_valid():
            # Set patient and expiry (default 7 days)
            expiry = timezone.now() + timedelta(days=7)
            share = serializer.save(
                patient=request.user.patient,
                expires_at=expiry
            )
            
            # Trigger notification/email via agent
            from agenthandover import get_orchestrator, AgentName, AgentEvent, HandoverPayload
            orchestrator = get_orchestrator()
            
            payload = HandoverPayload(
                patient_id=str(request.user.patient.id),
                data={
                    'share_id': str(share.id),
                    'access_token': share.access_token,
                    'recipient_name': share.recipient_name
                }
            )
            orchestrator.handover(AgentName.INSURANCE_REPORTS, AgentName.NOTIFICATION, AgentEvent.SYSTEM_ALERT, payload)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ReportAccessView(views.APIView):
    """
    GET /api/v1/reports/access/<token>/
    Public view for insurers (token-based).
    """
    # Note: In a real app, this would be more complex (e.g. 2FA)
    def get(self, request, token):
        try:
            share = AdherenceReportShare.objects.get(
                access_token=token,
                is_revoked=False,
                expires_at__gt=timezone.now()
            )
            
            # Log access
            from .models import ReportAccessLog
            ReportAccessLog.objects.create(
                share=share,
                accessor_ip=request.META.get('REMOTE_ADDR'),
                accessor_ua=request.META.get('HTTP_USER_AGENT')
            )
            
            share.access_count += 1
            share.save()
            
            # Return adherence summary
            # In Phase 24, we generate this via AdherenceAgent
            return Response({
                "patient": share.patient.user.get_full_name(),
                "report_period": share.data_scope.get('period_days', 30),
                "adherence_score": 92.5, # Placeholder - would call AdherenceAgent
                "generated_at": timezone.now()
            })
            
        except AdherenceReportShare.DoesNotExist:
            return Response({"error": "Invalid or expired access token"}, status=status.HTTP_404_NOT_FOUND)
