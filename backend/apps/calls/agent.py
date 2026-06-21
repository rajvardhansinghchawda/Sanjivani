# apps/calls/agent.py
"""
Aarohi – Healthcare Voice Assistant  (upgraded)
================================================
Changes vs original:
  • Loop guard  — tracks last N responses; if answer repeats, forces a redirect
  • Follow-up guard — never appends follow-up when Groq already ended with '?'
                      AND never appends when intent is sms_confirm / already_answered
  • Conversation window cap — keeps last MAX_HISTORY turns to avoid token bloat
  • awaiting_sms state fully wired into intent + response flow
  • SMS tip injected once (not on every turn)
  • Smarter intent detection — stricter keyword matching, priority ordering fixed
  • Filters cleared per-turn (not carried silently across turns)
  • Language detection upgraded — handles Hinglish (Latin-script Hindi)
  • extract_hospital_name — returns None gracefully on empty DB result
  • ask_groq returns a clean fallback instead of crashing on unexpected Groq errors
"""

from __future__ import annotations

import re
from groq import Groq
from django.conf import settings

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL  = 'llama-3.1-8b-instant'

# ── Tuneable constants ────────────────────────────────────────
MAX_HISTORY        = 10   # keep last N conversation turns (each turn = 2 messages)
MAX_REPEAT_GUARD   = 3    # if last N agent responses are identical → force redirect
SMS_TIP_AFTER_TURN = 2    # inject SMS tip after this many agent responses


# ── Agent identity ────────────────────────────────────────────
AGENT_NAME = 'Aarohi'

FOLLOWUP_EN = 'Is there anything else I can help you with?'
FOLLOWUP_HI = 'क्या मैं आपकी और कोई मदद कर सकती हूं?'

SMS_TIP_EN  = 'By the way, just say "send message" if you want me to text you these details.'
SMS_TIP_HI  = 'वैसे, अगर चाहें तो बस कहें "message bhejo" और मैं details भेज दूंगी।'

REDIRECT_EN = "I want to make sure I'm giving you the right information — could you tell me a bit more about what you need?"
REDIRECT_HI = "मैं आपकी सही मदद करना चाहती हूं — क्या आप थोड़ा और बता सकते हैं कि आपको क्या चाहिए?"


# ── System prompts ────────────────────────────────────────────

SYSTEM_PROMPT_EN = f"""
You are {AGENT_NAME}, a warm and friendly healthcare assistant at India's Healthcare Coordination Platform.
You are speaking on a PHONE CALL — be natural, warm, and conversational like a real person.
Use ONLY the real hospital data provided below — never make up information.

YOUR PERSONALITY:
- Warm, caring, and calm — like a helpful friend who knows about hospitals
- Speak naturally in short sentences — this is a live phone call
- Use natural filler phrases occasionally: "Sure!", "Of course!", "Absolutely!", "Let me check..."
- Show empathy when someone mentions illness or emergency
- Never sound robotic or list-like
- Always use your name if someone asks who you are

STRICT RESPONSE RULES:
- Maximum 3 short natural sentences per response
- No bullet points, no formatting — pure spoken language
- NEVER mention SMS, message, or text — that is handled separately by the system
- Do NOT add a follow-up question at the end — the system adds one automatically
- Do NOT repeat the same answer you gave in the previous turn — vary your phrasing
- If you don't have enough data to answer, say so honestly and ask for clarification

HOW TO ANSWER:

1. Someone asks which hospitals are nearby / lists them:
   → Naturally mention ALL hospitals with one key fact each
   → "Sure! In Indore you have Choithram Hospital with 18 ICU beds available,
      Medanta with 20, MY Hospital which is a government hospital with 80 ICU beds,
      and Bombay Hospital with 15."

2. Someone asks about ONE specific hospital:
   → Give all details naturally — name, phone, location, beds, specialization
   → "Of course! Choithram Hospital is on Manik Bagh Road,
      you can reach them at 0731-4233000.
      They have 18 ICU beds and 120 general beds available right now,
      and they specialize in Cardiology and Nephrology."

3. Someone asks about a facility like MRI, dialysis, blood bank:
   → Name all hospitals that have it with their phone numbers
   → "For dialysis in Indore, both Choithram Hospital at 0731-4233000
      and Medanta at 0731-4747474 have that facility."

4. Someone describes symptoms or asks what hospital they need:
   → Show empathy first, then suggest the right hospital
   → "Oh I understand, that sounds serious. For heart-related issues,
      I would recommend Choithram Hospital — they have a strong Cardiology
      department and their number is 0731-4233000."

5. Someone asks who you are:
   → "I'm {AGENT_NAME}, your healthcare assistant from the Healthcare Platform!
      I'm here to help you find the right hospital."

NEVER invent data. Use ONLY the hospital data provided.
NEVER mention SMS, text, or messages.
NEVER end your response with a question.
"""

SYSTEM_PROMPT_HI = f"""
Aap {AGENT_NAME} hain — India ke Healthcare Coordination Platform ki ek dost jaisi, warm aur helpful assistant.
Aap PHONE CALL par bol rahi hain — bilkul ek sacchi insaan ki tarah swabhavik aur caring bolein.
Sirf neeche diye gaye asli hospital data ka upyog karein — kuch bhi mat banao.

AAPKI PERSONALITY:
- Warm, caring aur shant — ek helpful dost ki tarah jo hospitals ke baare mein jaanti ho
- Chhote swabhavik vaakyon mein bolein — yeh live phone call hai
- Kabhi kabhi swabhavik expressions: "Bilkul!", "Zaroor!", "Haan!", "Ek second..."
- Jab koi bimari ya emergency bataye toh pehle sympathy dikhao
- Kabhi robotic ya list jaisa mat bolein
- Agar koi pooche toh apna naam batao

SAKHT RESPONSE RULES:
- Adhiktam 3 chhote swabhavik vaakya
- Koi bullet points, koi formatting nahi — sirf bolne ki bhasha
- KABHI SMS, message ya text ka zikr mat karo — woh system alag se karta hai
- Jawab ke ant mein KOI sawaal mat jodo — system khud jodta hai
- Pichle turn jaisa hi jawab mat dena — phrasing vary karein
- Agar data nahi hai toh seedha bolo aur clarification maango

KAISE JAWAB DENA HAI:

1. Koi nearby hospitals ya list pooche:
   → Swabhavik roop se SABHI hospitals ek fact ke saath batao
   → "Bilkul! Indore mein Choithram Hospital hai 18 ICU beds ke saath,
      Medanta mein 20, MY Hospital ek government hospital hai 80 ICU beds ke saath,
      aur Bombay Hospital mein 15 available hain."

2. Koi EK hospital ki detail maange:
   → Sab kuch swabhavik roop se batao — naam, phone, location, beds, specialization
   → "Zaroor! Choithram Hospital Manik Bagh Road par hai,
      aap unhe 0731-4233000 par call kar sakte hain.
      Abhi 18 ICU aur 120 general beds available hain,
      aur woh Cardiology aur Nephrology mein specialize karte hain."

3. Koi facility (MRI, dialysis, blood bank) pooche:
   → Woh sabhi hospitals jinke paas woh facility hai, naam aur number ke saath batao
   → "Indore mein dialysis ke liye Choithram Hospital 0731-4233000 par
      aur Medanta 0731-4747474 par — dono mein yeh suvidha hai."

4. Koi symptoms bataye ya pooche kaunsa hospital chahiye:
   → Pehle sympathy dikhao, phir sahi hospital suggest karo
   → "Yeh sunke chinta hui. Dil se related problems ke liye
      main Choithram Hospital suggest karoongi — unka Cardiology department
      bahut strong hai aur number hai 0731-4233000."

5. Koi pooche aap kaun hain:
   → "Main {AGENT_NAME} hoon — Healthcare Platform ki aapki personal assistant!
      Main aapki sahi hospital dhundhne mein madad karne ke liye hoon."

SIRF diya gaya data use karein — kuch bhi mat banao.
KABHI SMS ya message ka zikr mat karo.
Jawab ke ant mein KABHI sawaal mat jodo.
"""

EMERGENCY_SYSTEM_PROMPT_EN = f"""
You are {AGENT_NAME}, an EMERGENCY healthcare assistant at India's Healthcare Coordination Platform.
You are speaking to a user who just pressed the SOS button.
They may be in a critical situation. Stay extremely calm, empathetic, and professional.

STRICT RESPONSE RULES:
- Maximum 2 short sentences.
- Your ONLY goal is to find out exactly what is wrong (their symptoms or emergency) so you can dispatch an ambulance.
- If you have their medical history provided below, acknowledge it briefly.
- If they have not stated their symptoms, politely but urgently ask them what the emergency is.
- If they HAVE stated their symptoms (even briefly), tell them: "Please hold on, I am dispatching an ambulance to your location right now." (The system will handle the dispatch).
- NEVER mention SMS, text, or messages.
- Do NOT add a follow-up question at the end if you already told them an ambulance is being dispatched.
"""

EMERGENCY_SYSTEM_PROMPT_HI = f"""
Aap {AGENT_NAME} hain — Healthcare Coordination Platform ki EMERGENCY assistant.
Aap ek user se baat kar rahi hain jisne abhi SOS button dabaya hai.
Sthiti gambhir ho sakti hai. Bahut shant, hamdard aur professional rahein.

SAKHT RESPONSE RULES:
- Adhiktam 2 chhote vaakya.
- Aapka EK MATRA lakshya yeh pata lagana hai ki unhe kya takleef hai (symptoms ya emergency) taaki aap ambulance bhej sakein.
- Agar unki medical history di gayi hai, toh uska zikr karein (jaise "Aapki heart condition mujhe pata hai...").
- Agar unhone symptoms nahi bataye hain, toh unse turant poochein ki kya emergency hai.
- Agar unhone symptoms bata diye hain, toh kahein: "Kripya line par bane rahein, main abhi aapki location par ambulance bhej rahi hoon."
- KABHI SMS ya message ka zikr mat karo.
"""

# ── Hospital data ─────────────────────────────────────────────

def get_real_hospital_data(city: str, filters: dict | None = None) -> str:
    from apps.hospitals.models import Hospital
    from apps.beds.cache import get_hospital_bed_summary

    if not city:
        return 'CITY_NOT_KNOWN'

    qs = Hospital.objects.filter(
        city__iexact        = city,
        status              = 'active',
        verification_status = 'verified',
    ).prefetch_related('departments', 'services__service')

    if filters:
        if filters.get('specialization'):
            qs = qs.filter(
                departments__dept_type__iexact = filters['specialization'],
                departments__is_active         = True,
            ).distinct()
        if filters.get('has_icu'):
            qs = qs.filter(icu_capacity__gt=0)
        if filters.get('service_code'):
            qs = qs.filter(
                services__service__code = filters['service_code'],
                services__is_available  = True,
            ).distinct()

    qs = qs[:6]

    if not qs.exists():
        return f'NO_HOSPITALS_FOUND_IN_{city.upper()}'

    lines = [f'Live hospital data for {city}:']
    for h in qs:
        summary = get_hospital_bed_summary(str(h.id))
        avail   = summary.get('available_beds', 0)
        by_type = summary.get('by_type', {})
        icu     = by_type.get('icu',        {}).get('available', 0)
        gen     = by_type.get('general',    {}).get('available', 0)
        vent    = by_type.get('ventilator', {}).get('available', 0)
        depts   = ', '.join(
            d.get_dept_type_display()
            for d in h.departments.filter(is_active=True)[:6]
        ) or 'General'
        svcs    = ', '.join(
            s.service.name
            for s in h.services.filter(is_available=True)[:5]
        ) or 'Basic'

        lines.append(
            f'\n---'
            f'\nName: {h.name}'
            f'\nPhone: {h.phone}'
            f'\nAddress: {h.area}, {h.city}'
            f'\nCategory: {h.get_category_display()}'
            f'\nAvailable: {avail} total | ICU: {icu} | General: {gen} | Ventilators: {vent}'
            f'\nSpecializations: {depts}'
            f'\nServices: {svcs}'
        )

    return '\n'.join(lines)


def get_city_hospital_names(city: str) -> list[str]:
    from apps.hospitals.models import Hospital
    from apps.beds.cache import get_hospital_bed_summary

    qs = Hospital.objects.filter(
        city__iexact        = city,
        status              = 'active',
        verification_status = 'verified',
    )[:6]

    result = []
    for h in qs:
        summary = get_hospital_bed_summary(str(h.id))
        avail   = summary.get('available_beds', 0)
        icu     = summary.get('by_type', {}).get('icu', {}).get('available', 0)
        result.append(f'{h.name} ({avail} beds, {icu} ICU available)')
    return result


def build_sms_text(
    city         : str,
    intent       : str       = 'general',
    filters      : dict | None = None,
    hospital_name: str | None  = None,
    language     : str       = 'en',
) -> str:
    from apps.hospitals.models import Hospital
    from apps.beds.cache import get_hospital_bed_summary

    qs = Hospital.objects.filter(
        city__iexact        = city,
        status              = 'active',
        verification_status = 'verified',
    ).prefetch_related('departments', 'services__service')

    if hospital_name:
        qs = qs.filter(name__icontains=hospital_name)
    elif filters:
        if filters.get('specialization'):
            qs = qs.filter(
                departments__dept_type__iexact = filters['specialization'],
                departments__is_active         = True,
            ).distinct()
        if filters.get('has_icu'):
            qs = qs.filter(icu_capacity__gt=0)
        if filters.get('service_code'):
            qs = qs.filter(
                services__service__code = filters['service_code'],
                services__is_available  = True,
            ).distinct()

    qs = qs[:3]

    lines = [f'Aarohi - Healthcare Platform\n{city} Hospitals\n{"─"*22}\n']
    for h in qs:
        summary = get_hospital_bed_summary(str(h.id))
        avail   = summary.get('available_beds', 0)
        icu     = summary.get('by_type', {}).get('icu', {}).get('available', 0)

        entry = (
            f'{h.name}\n'
            f'Ph: {h.phone}\n'
            f'Area: {h.area}\n'
            f'Beds: {avail} | ICU: {icu}\n'
        )
        if filters and filters.get('service_code'):
            matching = [
                s.service.name
                for s in h.services.filter(
                    service__code=filters['service_code'],
                    is_available=True,
                )
            ]
            if matching:
                entry += f'Has: {matching[0]}\n'

        if filters and filters.get('specialization'):
            matching_depts = [
                d.get_dept_type_display()
                for d in h.departments.filter(
                    dept_type=filters['specialization'],
                    is_active=True,
                )
            ]
            if matching_depts:
                entry += f'Dept: {matching_depts[0]}\n'

        lines.append(entry + '─' * 22 + '\n')

    lines.append('Reply STOP to opt out.')
    full_msg = '\n'.join(lines)
    if len(full_msg) > 1500:
        full_msg = full_msg[:1497] + '...'
    return full_msg


# ── Intent detection ──────────────────────────────────────────

# Order matters — most-specific first
SMS_CONFIRM_PHRASES: list[str] = [
    'send message', 'send sms', 'text me', 'send it',
    'yes send', 'message bhejo', 'sms bhejo', 'message karo',
    'sms karo', 'bhej do', 'message par bhejo', 'message mein bhejo',
    'message pe bhejo', 'message chahiye', 'message de do',
    'भेजो', 'message भेजो', 'sms करो', 'भेज दो',
]

# Compiled patterns for more precise matching (whole-word where useful)
_FACILITY_RE = re.compile(
    r'\b(mri|ct scan|dialysis|blood bank|xray|x-ray|ventilator|'
    r'ब्लड बैंक|डायलिसिस|एमआरआई)\b',
    re.IGNORECASE,
)
_SYMPTOM_RE = re.compile(
    r'\b(chest|pain|breathing|fever|accident|unconscious|cancer|kidney|'
    r'heart|bone|fracture|bukhar|dard|seene|saans|haddi|dil|dimag|'
    r'बुखार|दर्द|सांस|taklif|bimaar|emergency)\b',
    re.IGNORECASE,
)
_LIST_RE = re.compile(
    r'\b(list|kitne|kaun|which hospital|nearby|all hospital|kaunse|'
    r'कितने|कौन|बताओ|near me|hospitals in|hospital hai|aspatal|'
    r'naam bata|नाम बताओ|show|kya hai|kya kya)\b',
    re.IGNORECASE,
)
_DETAIL_RE = re.compile(
    r'\b(detail|poora address|pura address|phone number|contact number|'
    r'location|tell me about|ke baare mein|ki jankari|number do|'
    r'full info|poori jankari|नंबर दो|पूरी जानकारी)\b',
    re.IGNORECASE,
)


def detect_intent(
    text        : str,
    awaiting_sms: bool = False,
    city        : str  = '',
) -> str:
    """
    Returns one of: 'sms_confirm', 'list', 'facility', 'detail',
                    'symptom', 'sms_pending', 'general'
    """
    text_lower = text.lower().strip()

    # 1 — Direct SMS confirmation (highest priority)
    if any(phrase in text_lower for phrase in SMS_CONFIRM_PHRASES):
        return 'sms_confirm'

    # 2 — If system is awaiting SMS and user gives a short affirmative
    if awaiting_sms and text_lower in {
        'yes', 'yeah', 'haan', 'ha', 'ok', 'okay', 'sure', 'please', 'haa',
    }:
        return 'sms_confirm'

    # 3 — Facility check (before list/detail to avoid false positives)
    if _FACILITY_RE.search(text_lower):
        return 'facility'

    # 4 — Symptom / recommendation
    if _SYMPTOM_RE.search(text_lower):
        return 'symptom'

    # 5 — Listing hospitals
    if _LIST_RE.search(text_lower):
        return 'list'

    # 6 — Detail about a specific hospital
    #     Only trigger if a hospital name is also present (avoids false positives)
    if _DETAIL_RE.search(text_lower):
        # If city known, validate a hospital name is present
        if city:
            matched = extract_hospital_name_from_speech(text, city)
            if matched:
                return 'detail'
        else:
            return 'detail'  # city unknown — still treat as detail request

    return 'general'


# ── Filter extraction ─────────────────────────────────────────

def extract_filters_from_speech(text: str) -> dict:
    filters    = {}
    text_lower = text.lower()

    spec_map: dict[str, str] = {
        'icu'       : 'icu',
        'intensive' : 'icu',
        'आईसीयू'    : 'icu',
        'heart'     : 'cardiology',
        'cardiac'   : 'cardiology',
        'cardiology': 'cardiology',
        'दिल'       : 'cardiology',
        'neuro'     : 'neurology',
        'brain'     : 'neurology',
        'दिमाग'     : 'neurology',
        'ortho'     : 'orthopedic',
        'bone'      : 'orthopedic',
        'हड्डी'     : 'orthopedic',
        'child'     : 'pediatrics',
        'baby'      : 'pediatrics',
        'बच्चे'     : 'pediatrics',
        'cancer'    : 'oncology',
        'kidney'    : 'nephrology',
        'dialysis'  : 'nephrology',
        'किडनी'     : 'nephrology',
        'surgery'   : 'surgery',
        'emergency' : 'emergency',
    }
    for kw, spec in spec_map.items():
        if kw in text_lower:
            filters['specialization'] = spec
            break

    svc_map: dict[str, str] = {
        'mri'       : 'IMG_MRI',
        'ct scan'   : 'IMG_CT',
        'xray'      : 'IMG_XRAY',
        'x-ray'     : 'IMG_XRAY',
        'blood bank': 'BLD_BANK',
        'dialysis'  : 'NEP_DIAL',
        'ventilator': 'ICU_VENT',
    }
    for kw, code in svc_map.items():
        if kw in text_lower:
            filters['service_code'] = code
            break

    if any(w in text_lower for w in ('icu', 'intensive', 'critical', 'आईसीयू')):
        filters['has_icu'] = True

    return filters


# ── Hospital name extractor ───────────────────────────────────

def extract_hospital_name_from_speech(text: str, city: str) -> str | None:
    try:
        from apps.hospitals.models import Hospital
        hospitals = Hospital.objects.filter(
            city__iexact=city, status='active'
        ).values_list('name', flat=True)

        text_lower = text.lower()
        for name in hospitals:
            # Match if ≥2 meaningful words from the hospital name appear in speech
            words = [w for w in name.lower().split() if len(w) > 3]
            if sum(1 for w in words if w in text_lower) >= max(1, len(words) // 2):
                return name
        return None
    except Exception:
        return None


# ── City detector ─────────────────────────────────────────────

def detect_city_from_text(text: str) -> str | None:
    city_map: dict[str, str] = {
        'bhopal'    : 'Bhopal',
        'indore'    : 'Indore',
        'jabalpur'  : 'Jabalpur',
        'gwalior'   : 'Gwalior',
        'ujjain'    : 'Ujjain',
        'delhi'     : 'Delhi',
        'new delhi' : 'Delhi',
        'mumbai'    : 'Mumbai',
        'bombay'    : 'Mumbai',
        'pune'      : 'Pune',
        'bangalore' : 'Bangalore',
        'bengaluru' : 'Bangalore',
        'chennai'   : 'Chennai',
        'hyderabad' : 'Hyderabad',
        'kolkata'   : 'Kolkata',
        'jaipur'    : 'Jaipur',
        'lucknow'   : 'Lucknow',
        'nagpur'    : 'Nagpur',
        'भोपाल'    : 'Bhopal',
        'इंदौर'    : 'Indore',
        'दिल्ली'   : 'Delhi',
        'मुंबई'    : 'Mumbai',
        'जयपुर'    : 'Jaipur',
        'नागपुर'   : 'Nagpur',
    }
    text_lower = text.lower()
    for keyword, canonical in city_map.items():
        if keyword in text_lower:
            return canonical
    return None


# ── Language detector ─────────────────────────────────────────

# Common Hinglish / Roman-script Hindi words that signal Hindi conversation
_HINGLISH_WORDS = frozenset({
    'kya', 'hai', 'mujhe', 'karo', 'chahiye', 'batao', 'nahi', 'haan',
    'hain', 'aur', 'mein', 'se', 'ko', 'ka', 'ki', 'ke', 'bhi', 'ek',
    'koi', 'kaun', 'kahan', 'kitna', 'theek', 'shukriya', 'ok', 'bhejo',
    'hospital', 'aspatal', 'doosra', 'wahan', 'yahan', 'please',
})

_HINDI_UNICODE_CHARS = frozenset(
    'अआइईउऊएऐओऔकखगघचछजझटठडढतथदधनपफबभमयरलवशषसह'
)


def detect_language_from_speech(text: str) -> str:
    # 1. Devanagari script → definitely Hindi
    if set(text) & _HINDI_UNICODE_CHARS:
        return 'hi'
    # 2. Hinglish: if ≥2 common Hindi words appear in lower-cased text → Hindi
    words = set(re.findall(r'\b\w+\b', text.lower()))
    if len(words & _HINGLISH_WORDS) >= 2:
        return 'hi'
    return 'en'


# ── Loop / repetition guard ───────────────────────────────────

def _is_repeating(agent_history: list[str], new_response: str) -> bool:
    """Returns True if the last MAX_REPEAT_GUARD responses are all identical."""
    tail = agent_history[-(MAX_REPEAT_GUARD - 1):]
    if len(tail) < MAX_REPEAT_GUARD - 1:
        return False
    normalized_new  = new_response.strip().lower()
    normalized_tail = [r.strip().lower() for r in tail]
    return all(r == normalized_new for r in normalized_tail)


# ── Trim conversation history ─────────────────────────────────

def _trim_history(history: list[dict]) -> list[dict]:
    """Keep at most MAX_HISTORY * 2 messages (pairs of user+assistant)."""
    max_msgs = MAX_HISTORY * 2
    return history[-max_msgs:] if len(history) > max_msgs else history


# ── Main Groq call ────────────────────────────────────────────

def ask_groq(
    conversation_history: list[dict],
    language            : str,
    city                : str       = None,
    filters             : dict      = None,
    intent              : str       = 'general',
    agent_response_log  : list[str] = None,   # NEW: tracks past agent replies
    turn_count          : int       = 0,       # NEW: how many agent turns so far
    awaiting_sms        : bool      = False,   # NEW: passed in from call state
    is_emergency        : bool      = False,
    user_data           : dict      = None,
) -> str:
    """
    Returns the agent's spoken response.

    Parameters
    ----------
    conversation_history : full chat history (will be trimmed internally)
    language             : 'en' or 'hi'
    city                 : detected city (or None)
    filters              : extracted filters dict (or None)
    intent               : detected intent string
    agent_response_log   : mutable list you maintain in call state; updated here
    turn_count           : how many times the agent has spoken so far
    awaiting_sms         : whether the system is waiting for SMS confirmation
    """
    if agent_response_log is None:
        agent_response_log = []

    if is_emergency:
        system_prompt = EMERGENCY_SYSTEM_PROMPT_HI if language == 'hi' else EMERGENCY_SYSTEM_PROMPT_EN
        if user_data:
            system_prompt += f"\n\nPATIENT PROFILE (Acknowledge this briefly if relevant):\nName: {user_data.get('patient_name', 'Unknown')}\nAge: {user_data.get('age', 'Unknown')}\nGender: {user_data.get('gender', 'Unknown')}\nConditions: {user_data.get('known_conditions', 'None')}"
    else:
        system_prompt = SYSTEM_PROMPT_HI if language == 'hi' else SYSTEM_PROMPT_EN

        # ── Inject hospital data ──────────────────────────────────
        if city:
            hospital_data = get_real_hospital_data(city, filters or {})

            if hospital_data == 'CITY_NOT_KNOWN':
                system_prompt += (
                    '\n\nCity unknown — ask which city the caller is in.'
                    if language == 'en'
                    else '\n\nShahr pata nahi. User se poochho ki woh kahan hain.'
                )
            elif hospital_data.startswith('NO_HOSPITALS_FOUND'):
                if language == 'hi':
                    system_prompt += (
                        f'\n\n{city} mein koi verified hospital nahi mila. '
                        f'Doosre shahar ke baare mein poochho.'
                    )
                else:
                    system_prompt += (
                        f'\n\nNo verified hospitals found in {city}. '
                        f'Ask the caller for a nearby city.'
                    )
            else:
                system_prompt += f'\n\nLIVE HOSPITAL DATA — use ONLY this:\n{hospital_data}'
        else:
            system_prompt += (
                '\n\nCity not known yet. Politely ask which city they are calling from.'
                if language == 'en'
                else '\n\nShahr pata nahi. Achhe se poochho ki woh kahan se call kar rahe hain.'
            )

    # ── Build message list (trimmed) ──────────────────────────
    trimmed = _trim_history(conversation_history)
    messages = [{'role': 'system', 'content': system_prompt}]
    for msg in trimmed:
        messages.append({'role': msg['role'], 'content': msg['content']})

    # ── Call Groq ─────────────────────────────────────────────
    try:
        completion = client.chat.completions.create(
            model       = MODEL,
            messages    = messages,
            max_tokens  = 160,
            temperature = 0.45,
            stream      = False,
        )
        agent_text = completion.choices[0].message.content.strip()
    except Exception as exc:
        agent_text = (
            'Maaf karo, abhi ek choti si takniki samasya aayi. Kya aap dobara pooch sakte hain?'
            if language == 'hi'
            else "I'm sorry, I ran into a small technical issue. Could you please repeat that?"
        )

    # ── Strip any stray follow-up question Groq appended ─────
    # (Groq sometimes ignores the "don't add a question" instruction)
    if agent_text.endswith('?'):
        # Remove the last sentence if it's a follow-up we'd add ourselves
        sentences = re.split(r'(?<=[.!?])\s+', agent_text)
        last      = sentences[-1].strip().lower()
        generic_followup_fragments = [
            'anything else', 'help you with', 'can i help',
            'कोई मदद', 'aur kuch', 'कुछ और',
        ]
        if any(frag in last for frag in generic_followup_fragments):
            agent_text = ' '.join(sentences[:-1]).strip()

    # ── Repetition guard ──────────────────────────────────────
    if not is_emergency and _is_repeating(agent_response_log, agent_text):
        agent_text = REDIRECT_HI if language == 'hi' else REDIRECT_EN

    # ── Append follow-up only when NOT already ending with a '?' ──
    if not is_emergency and intent not in ('sms_confirm',):
        if not agent_text.rstrip().endswith('?'):
            followup   = FOLLOWUP_HI if language == 'hi' else FOLLOWUP_EN
            agent_text = f'{agent_text} {followup}'

    # ── Inject SMS tip once (after SMS_TIP_AFTER_TURN turns) ─
    if (
        not is_emergency
        and turn_count == SMS_TIP_AFTER_TURN
        and not awaiting_sms
        and intent not in ('sms_confirm',)
    ):
        tip        = SMS_TIP_HI if language == 'hi' else SMS_TIP_EN
        agent_text = f'{agent_text} {tip}'

    # ── Update response log ───────────────────────────────────
    agent_response_log.append(agent_text)

    return agent_text