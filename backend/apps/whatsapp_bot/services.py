import logging
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
import requests
from apps.identity.models import User
from apps.telemetry.models import AdherenceEvent

logger = logging.getLogger('medadhere')

class TwilioWhatsAppService:
    """
    Wrapper for Twilio WhatsApp API.
    """
    @staticmethod
    def send_message(to_phone: str, body: str):
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        auth_token  = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        from_phone  = getattr(settings, 'TWILIO_WHATSAPP_FROM', '+14155238886')

        if not account_sid or not auth_token:
            logger.warning(f"[MOCK] WhatsApp to {to_phone}: {body}")
            return {"status": "mocked"}

        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        payload = {
            "From": f"whatsapp:{from_phone}",
            "To": f"whatsapp:{to_phone}",
            "Body": body
        }
        
        try:
            response = requests.post(url, data=payload, auth=(account_sid, auth_token), timeout=10)
            return response.json()
        except Exception as e:
            logger.error(f"Twilio WhatsApp Error: {e}")
            return {"error": str(e)}

class WhatsAppMessageService:
    @staticmethod
    def send(phone_number: str, text: str):
        return TwilioWhatsAppService.send_message(phone_number, text)

class WhatsAppLinkingService:
    @staticmethod
    def verify_code(code: str):
        """
        Linking codes are stored in cache as wa_link_code:{code} -> user_id
        Generated in the mobile app.
        """
        user_id = cache.get(f"wa_link_code:{code}")
        if user_id:
            try:
                return User.objects.get(id=user_id)
            except User.DoesNotExist:
                return None
        return None

class WhatsAppStatusService:
    @staticmethod
    def get_today_summary(user_id: str):
        from apps.clinical.models import Patient
        try:
            patient = Patient.objects.get(user_id=user_id)
            today = timezone.localdate()
            events = AdherenceEvent.objects.filter(
                patient=patient,
                scheduled_at__date=today
            ).select_related('schedule__prescription__medication')
            
            if not events.exists():
                return "Aaj ke liye koi dava schedule nahi hai. 😊"
            
            lines = ["📋 Aaj ki Medications:"]
            for e in events:
                status_icon = "✅" if e.status == 'TAKEN' else "❌" if e.status == 'MISSED' else "⏳"
                med_name = e.schedule.prescription.medication.name
                time_str = e.scheduled_at.strftime("%I:%M %p")
                lines.append(f"{status_icon} {med_name} - {time_str}")
            
            return "\n".join(lines)
        except Patient.DoesNotExist:
            return "Patient profile nahi mila."
        except Exception as e:
            logger.error(f"WhatsApp Status Error: {e}")
            return "Maafi chahte hain, status fetch karne mein problem hui."
