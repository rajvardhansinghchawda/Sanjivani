from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import logging
from agenthandover import get_orchestrator

logger = logging.getLogger('medadhere')

class WhatsAppWebhookView(APIView):
    """
    POST /api/v1/whatsapp/webhook/
    Twilio Webhook for inbound WhatsApp messages.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # Extract data from Twilio's form-encoded POST
        data   = request.data
        phone  = data.get('From', '').replace('whatsapp:', '')
        body   = data.get('Body', '')
        msg_id = data.get('SmsMessageSid', '')

        if not phone or not body:
             return Response({"status": "invalid_data"}, status=400)

        logger.info(f"WhatsApp Inbound from {phone}: {body[:50]}...")

        # Handover to WhatsAppBotAgent via Orchestrator
        orchestrator = get_orchestrator()
        wa_agent = orchestrator.get_agent('WhatsAppBotAgent')
        
        if wa_agent:
            # We call the agent's logic method directly or via broadcast
            # The agent is designed to handle this specifically
            try:
                res = wa_agent.handle_inbound_message(phone, body, msg_id)
                return Response(res)
            except Exception as e:
                logger.error(f"WhatsApp Agent Error: {e}")
                return Response({"status": "agent_error", "detail": str(e)}, status=500)
        
        return Response({"status": "agent_not_ready"}, status=503)
