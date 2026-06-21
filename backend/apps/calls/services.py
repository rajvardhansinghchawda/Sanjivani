# apps/calls/services.py
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather, Say
from django.conf import settings

client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
BASE   = settings.BASE_WEBHOOK_URL

# ── Voice config ──────────────────────────────────────────────
# Changed to Google Neural voices — much more natural sounding
# Free on Twilio trial credit
VOICE_EN = 'Google.en-IN-Neural2-D'   # Indian English female — natural
VOICE_HI = 'Google.hi-IN-Neural2-A'   # Hindi female — clear and natural
LANG_EN  = 'en-IN'
LANG_HI  = 'hi-IN'


def say_in_language(node, text: str, language: str):
    """Speaks text using correct neural voice for language."""
    if language == 'hi':
        node.say(text, voice=VOICE_HI, language=LANG_HI)
    else:
        node.say(text, voice=VOICE_EN, language=LANG_EN)


# ── Feature 1: Transfer notification ─────────────────────────

def make_transfer_notification_call(to_number: str, transfer_request_id: str) -> str:
    call = client.calls.create(
        to    = to_number,
        from_ = settings.TWILIO_PHONE_NUMBER,
        url   = f'{BASE}/api/calls/webhook/transfer/{transfer_request_id}/',
        status_callback       = f'{BASE}/api/calls/webhook/status/',
        status_callback_event = ['completed', 'failed', 'no-answer'],
    )
    return call.sid


def build_transfer_twiml(transfer_request) -> str:
    response = VoiceResponse()
    patient  = transfer_request.patient
    from_h   = transfer_request.from_hospital
    priority = transfer_request.priority.upper()

    msg_en = (
        f'Hello. This is an automated alert from the Healthcare Coordination Platform. '
        f'{from_h.name} hospital has initiated a {priority} priority patient transfer. '
        f'Patient name is {patient.full_name}. '
        f'Reason: {transfer_request.reason}. '
        f'Required bed type: {transfer_request.required_bed_type or "not specified"}. '
        f'Press 1 to acknowledge this transfer.'
    )
    msg_hi = (
        f'नमस्ते। यह Healthcare Coordination Platform का स्वचालित संदेश है। '
        f'{from_h.name} अस्पताल ने एक {priority} प्राथमिकता का मरीज ट्रांसफर शुरू किया है। '
        f'मरीज का नाम {patient.full_name} है। '
        f'कारण: {transfer_request.reason}। '
        f'पुष्टि के लिए 1 दबाएं।'
    )

    response.say(msg_en, voice=VOICE_EN, language=LANG_EN)
    response.say(msg_hi, voice=VOICE_HI, language=LANG_HI)

    gather = Gather(
        num_digits = 1,
        action     = f'{BASE}/api/calls/webhook/transfer/{str(transfer_request.id)}/acknowledge/',
        timeout    = 15,
    )
    gather.say(
        'Press 1 to acknowledge. 1 dabane ke liye tayaar rahein.',
        voice=VOICE_EN, language=LANG_EN
    )
    response.append(gather)
    response.say('No response received. Please check your transfer portal. Goodbye.', voice=VOICE_EN)
    response.hangup()
    return str(response)


# ── Feature 1b: Transfer Alert (on Creation) ───────────────────

def make_transfer_alert_call(to_number: str, transfer_request_id: str) -> str:
    """Triggers when a hospital initiates a transfer TO another hospital."""
    call = client.calls.create(
        to    = to_number,
        from_ = settings.TWILIO_PHONE_NUMBER,
        url   = f'{BASE}/api/calls/webhook/transfer/{transfer_request_id}/alert/',
        status_callback       = f'{BASE}/api/calls/webhook/status/',
        status_callback_event = ['completed', 'failed', 'no-answer'],
    )
    return call.sid

def build_transfer_alert_twiml(transfer_request) -> str:
    response = VoiceResponse()
    patient  = transfer_request.patient
    from_h   = transfer_request.from_hospital
    priority = transfer_request.priority.upper()
    
    # Adding patient condition (reason) and bed type as requested by the user
    condition = transfer_request.reason or "Unknown condition"
    bed_type = transfer_request.required_bed_type or "General"

    msg_en = (
        f'Emergency alert from MedGrid. A {priority} priority patient is being transferred to your hospital from {from_h.name}. '
        f'The patient\'s name is {patient.full_name}. '
        f'They are suffering from: {condition}. '
        f'They require a {bed_type} bed immediately. '
        f'Please check the MedGrid reception portal right now to accept or reject this transfer. '
        f'I repeat, check the portal for a transfer from {from_h.name}. Goodbye.'
    )
    
    msg_hi = (
        f'मेडग्रिड से आपातकालीन अलर्ट। {from_h.name} से एक {priority} प्राथमिकता वाले मरीज को आपके अस्पताल में स्थानांतरित किया जा रहा है। '
        f'मरीज का नाम {patient.full_name} है। '
        f'उन्हें {condition} की समस्या है और तुरंत एक {bed_type} बेड की आवश्यकता है। '
        f'कृपया इस ट्रांसफर को स्वीकार या अस्वीकार करने के लिए तुरंत मेडग्रिड पोर्टल की जांच करें। धन्यवाद।'
    )

    response.say(msg_en, voice=VOICE_EN, language=LANG_EN)
    response.say(msg_hi, voice=VOICE_HI, language=LANG_HI)
    response.hangup()
    return str(response)

# ── Feature 2: User AI agent ──────────────────────────────────

def make_user_agent_call(to_number: str, session_id: str) -> str:
    call = client.calls.create(
        to    = to_number,
        from_ = settings.TWILIO_PHONE_NUMBER,
        url   = f'{BASE}/api/calls/webhook/agent/greet/{session_id}/',
        status_callback       = f'{BASE}/api/calls/webhook/status/',
        status_callback_event = ['completed', 'failed', 'no-answer'],
    )
    return call.sid


def build_language_select_twiml(session_id: str) -> str:
    """
    Language selection — plays ONCE when call connects.
    Key fix: uses <Gather> with numDigits=1 and proper timeout.
    """
    response = VoiceResponse()

    gather = Gather(
        num_digits = 1,
        action     = f'{BASE}/api/calls/webhook/agent/language/{session_id}/',
        timeout    = 10,
        method     = 'POST',
    )
    gather.say(
        'Welcome to Healthcare Assistant. Press 1 for English.',
        voice=VOICE_EN, language=LANG_EN
    )
    gather.say(
        'हेल्थकेयर सहायक में आपका स्वागत है। हिंदी के लिए 2 दबाएं।',
        voice=VOICE_HI, language=LANG_HI
    )
    response.append(gather)

    # if no key pressed — default to English
    response.redirect(
        f'{BASE}/api/calls/webhook/agent/language/{session_id}/?default=1',
        method='POST'
    )
    return str(response)


def build_agent_listen_twiml(
    session_id: str,
    prompt_text: str,
    language: str
) -> str:
    """
    KEY FIX — This is what was broken before.

    Correct <Gather> setup for capturing speech:
    - input must be 'speech'
    - speechTimeout='auto' lets Twilio decide when user stopped speaking
    - timeout=8 waits 8 seconds for user to start speaking
    - enhanced=True uses better speech recognition model
    - profanityFilter=False prevents filtering medical terms
    - action must be POST to the process endpoint
    """
    response = VoiceResponse()

    gather = Gather(
        input           = 'speech',
        action          = f'{BASE}/api/calls/webhook/agent/process/{session_id}/',
        method          = 'POST',
        timeout         = 8,
        speech_timeout  = 'auto',
        language        = LANG_HI if language == 'hi' else LANG_EN,
        enhanced        = True,
        profanity_filter= False,
        hints           = (
            'hospital,bed,ICU,doctor,ambulance,emergency,nearby,'
            'bhopal,indore,jabalpur,delhi,mumbai,ventilator,blood,'
            'अस्पताल,बेड,आईसीयू,डॉक्टर,एम्बुलेंस,आपातकाल,भोपाल,'
            'नजदीकी,वेंटिलेटर,खून,इंदौर,दिल्ली,मुंबई'
        ),
    )

    # speak the agent's message inside the gather
    # user can start speaking while agent is still talking
    say_in_language(gather, prompt_text, language)

    response.append(gather)

    # fallback if no speech detected after full timeout
    if language == 'hi':
        fallback = 'मैं आपकी आवाज़ नहीं सुन सका। कृपया फिर से बोलें।'
    else:
        fallback = "I didn't catch that. Please speak after the tone."

    say_in_language(response, fallback, language)

    # retry — redirect back to same process endpoint
    response.redirect(
        f'{BASE}/api/calls/webhook/agent/process/{session_id}/?retry=1',
        method='POST'
    )

    return str(response)


def build_agent_end_twiml(language: str) -> str:
    response = VoiceResponse()
    if language == 'hi':
        response.say(
             'Shukriya! Main Aarohi thi, aapki Healthcare Assistant. '
            'धन्यवाद। आपकी मदद करके अच्छा लगा। अपना ख्याल रखें। नमस्ते।',
            voice=VOICE_HI, language=LANG_HI
        )
    else:
        response.say(
            'Thank you for using the Healthcare Assistant.',
            ' I am Aarohi, your Healthcare Assistant. '
            'Take good care of yourself. '
            'Goodbye!',
            voice=VOICE_EN, language=LANG_EN
        )
    response.hangup()
    return str(response)