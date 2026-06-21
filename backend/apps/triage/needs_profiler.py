# apps/triage/needs_profiler.py
"""
Care Needs Profiler
===================
Role 3 — Needs Profiler

Takes the AI triage output (p_level, doctor_category, conditions, red_flags)
and maps it to a specific care resource requirements profile.

Design decisions:
  1. The primary path is a deterministic rule table — for known high-acuity patterns
     (stroke, MI, trauma) we do NOT want LLM latency slowing down emergency routing.
  2. For unknown/ambiguous combinations, we fall back to asking Groq to generate
     the profile. This handles edge cases the rule table doesn't cover.
  3. The output uses real ServiceMaster codes from the database schema
     (IMG_CT, IMG_MRI, BLD_BANK, etc.) so the capability matcher can join
     directly against HospitalService records.
  4. time_sensitivity_minutes is the clinical window — routing should prioritize
     hospitals that can receive the patient within this window.
"""

import json
import re
import logging

from groq import Groq
from django.conf import settings

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL  = 'llama-3.3-70b-versatile'


# ── Deterministic profile table ───────────────────────────────────────────────
# Maps (doctor_category, condition_keywords, red_flag_keywords) → resource profile
# Order matters — matched top-to-bottom, first match wins.
# This covers the most common and highest-stakes presentations.

PROFILE_RULES = [
    # ── STROKE / NEURO EMERGENCY ──────────────────────────────────────────────
    {
        "match_categories":  ["Neurology", "Emergency"],
        "match_keywords":    ["stroke", "unresponsive", "paralysis", "facial droop",
                               "speech", "vision loss", "altered consciousness", "seizure",
                               "not responding", "unconscious"],
        "profile": {
            "required_bed_type":       "icu",
            "required_services":       ["IMG_CT", "IMG_MRI"],   # CT within 20min of arrival
            "required_departments":    ["neurology", "emergency", "icu"],
            "requires_ventilator":     False,
            "requires_blood_bank":     False,
            "requires_pediatric":      False,
            "time_sensitivity_minutes": 60,   # golden hour for stroke
            "profile_reasoning": (
                "Suspected stroke/neuro emergency: CT imaging required within 20 minutes "
                "of arrival to rule out hemorrhagic stroke before thrombolysis. "
                "Neurology consult within the golden hour (60 min from symptom onset). "
                "ICU-level monitoring required."
            ),
        },
    },

    # ── CARDIAC EMERGENCY (MI / ACS) ──────────────────────────────────────────
    {
        "match_categories":  ["Cardiology", "Emergency"],
        "match_keywords":    ["chest pain", "heart attack", "cardiac", "radiating",
                               "left arm", "jaw pain", "sweating", "palpitations",
                               "shortness of breath", "mi ", "acs", "angina"],
        "profile": {
            "required_bed_type":       "icu",
            "required_services":       ["IMG_ECG", "IMG_CT"],   # ECG immediately, CT angio for STEMI
            "required_departments":    ["cardiology", "emergency", "icu"],
            "requires_ventilator":     False,
            "requires_blood_bank":     False,
            "requires_pediatric":      False,
            "time_sensitivity_minutes": 90,   # door-to-balloon time for STEMI
            "profile_reasoning": (
                "Suspected ACS/MI: ECG required within 10 minutes of arrival. "
                "Cardiology on-call needed for cath lab decision. "
                "Door-to-balloon time target is 90 minutes for STEMI. "
                "ICU/CCU bed required post-intervention."
            ),
        },
    },

    # ── RESPIRATORY FAILURE / SEVERE BREATHING ────────────────────────────────
    {
        "match_categories":  ["Pulmonology", "Emergency"],
        "match_keywords":    ["not breathing", "respiratory failure", "severe breathing",
                               "gasping", "cyanosis", "blue lips", "oxygen",
                               "can't breathe", "difficulty breathing"],
        "profile": {
            "required_bed_type":       "icu",
            "required_services":       ["ICU_VENT"],
            "required_departments":    ["emergency", "icu", "pulmonology"],
            "requires_ventilator":     True,
            "requires_blood_bank":     False,
            "requires_pediatric":      False,
            "time_sensitivity_minutes": 15,   # minutes matter for respiratory failure
            "profile_reasoning": (
                "Respiratory failure: ventilator availability is critical. "
                "ICU with mechanical ventilation capability required. "
                "Immediate intervention window is 15 minutes — closest hospital "
                "with ventilators takes priority over capability match."
            ),
        },
    },

    # ── SEVERE TRAUMA / ACCIDENT ──────────────────────────────────────────────
    {
        "match_categories":  ["Trauma", "Surgery", "Emergency", "Orthopedics"],
        "match_keywords":    ["accident", "trauma", "crush injury", "severe bleeding",
                               "massive blood loss", "multiple injuries", "hit by",
                               "fell from", "gun", "stab"],
        "profile": {
            "required_bed_type":       "icu",
            "required_services":       ["IMG_CT", "BLD_BANK"],
            "required_departments":    ["surgery", "emergency", "icu"],
            "requires_ventilator":     True,
            "requires_blood_bank":     True,
            "time_sensitivity_minutes": 60,
            "requires_pediatric":      False,
            "profile_reasoning": (
                "Severe trauma: blood bank availability required for transfusion. "
                "CT trauma protocol needed for internal injury assessment. "
                "Surgical team on-call. ICU post-operative bed required."
            ),
        },
    },

    # ── PEDIATRIC EMERGENCY ───────────────────────────────────────────────────
    {
        "match_categories":  ["Pediatrics"],
        "match_keywords":    ["child", "baby", "infant", "toddler", "newborn",
                               "pediatric", "बच्चे", "bachcha"],
        "profile": {
            "required_bed_type":       "icu",
            "required_services":       [],
            "required_departments":    ["pediatrics", "emergency"],
            "requires_ventilator":     False,
            "requires_blood_bank":     False,
            "requires_pediatric":      True,   # must have dedicated pediatric emergency
            "time_sensitivity_minutes": 60,
            "profile_reasoning": (
                "Pediatric emergency: facility must have dedicated pediatric emergency "
                "capability and pediatric-trained staff. Adult ICUs are NOT appropriate "
                "for children without pediatric intensivist coverage."
            ),
        },
    },

    # ── NICU (Newborn/Obstetric) ──────────────────────────────────────────────
    {
        "match_categories":  ["Obstetrics", "Gynecology"],
        "match_keywords":    ["pregnant", "labor", "delivery", "newborn", "nicu",
                               "obstetric", "preterm", "eclampsia"],
        "profile": {
            "required_bed_type":       "icu",
            "required_services":       [],
            "required_departments":    ["emergency"],
            "requires_ventilator":     False,
            "requires_blood_bank":     True,
            "requires_pediatric":      False,
            "time_sensitivity_minutes": 30,
            "profile_reasoning": (
                "Obstetric emergency: blood bank required for hemorrhage risk. "
                "NICU capability needed if fetal distress is present."
            ),
        },
    },

    # ── KIDNEY / DIALYSIS ─────────────────────────────────────────────────────
    {
        "match_categories":  ["Nephrology"],
        "match_keywords":    ["kidney", "dialysis", "renal failure", "uremia"],
        "profile": {
            "required_bed_type":       "general",
            "required_services":       ["NEP_DIAL"],
            "required_departments":    ["nephrology"],
            "requires_ventilator":     False,
            "requires_blood_bank":     False,
            "requires_pediatric":      False,
            "time_sensitivity_minutes": 240,
            "profile_reasoning": (
                "Renal emergency: dialysis capability required. "
                "Must route to hospital with functional dialysis unit."
            ),
        },
    },

    # ── ANAPHYLAXIS ───────────────────────────────────────────────────────────
    {
        "match_categories":  ["Emergency", "Allergy"],
        "match_keywords":    ["anaphylaxis", "allergic reaction", "swelling throat",
                               "epinephrine", "epipen", "hives and breathing"],
        "profile": {
            "required_bed_type":       "emergency",
            "required_services":       [],
            "required_departments":    ["emergency"],
            "requires_ventilator":     False,
            "requires_blood_bank":     False,
            "requires_pediatric":      False,
            "time_sensitivity_minutes": 10,
            "profile_reasoning": (
                "Anaphylaxis: 10-minute window. Nearest emergency department with "
                "epinephrine and airway management capability. No specific imaging needed."
            ),
        },
    },
]

# ── Default profiles by p_level (fallback if no rule matches) ─────────────────
DEFAULT_PROFILES = {
    "P1": {
        "required_bed_type":       "icu",
        "required_services":       [],
        "required_departments":    ["emergency", "icu"],
        "requires_ventilator":     False,
        "requires_blood_bank":     False,
        "requires_pediatric":      False,
        "time_sensitivity_minutes": 30,
        "profile_reasoning":       "Critical emergency. ICU and emergency department required. Specific resource requirements determined by clinical evaluation on arrival.",
    },
    "P2": {
        "required_bed_type":       "emergency",
        "required_services":       [],
        "required_departments":    ["emergency"],
        "requires_ventilator":     False,
        "requires_blood_bank":     False,
        "requires_pediatric":      False,
        "time_sensitivity_minutes": 60,
        "profile_reasoning":       "Urgent emergency. Emergency department evaluation within 1 hour required.",
    },
    "P3": {
        "required_bed_type":       "general",
        "required_services":       [],
        "required_departments":    [],
        "requires_ventilator":     False,
        "requires_blood_bank":     False,
        "requires_pediatric":      False,
        "time_sensitivity_minutes": 240,
        "profile_reasoning":       "Moderate urgency. General ward. Can wait up to 4 hours.",
    },
    "P4": {
        "required_bed_type":       "general",
        "required_services":       [],
        "required_departments":    [],
        "requires_ventilator":     False,
        "requires_blood_bank":     False,
        "requires_pediatric":      False,
        "time_sensitivity_minutes": 480,
        "profile_reasoning":       "Non-urgent. OPD or general ward. No emergency resources required.",
    },
}


def profile_care_needs(
    p_level: str,
    doctor_category: str,
    possible_conditions: list,
    red_flags: list,
    patient_age: int = None,
    symptoms_text: str = "",
) -> dict:
    """
    Maps triage output to a concrete care resource requirements profile.

    Args:
        p_level:             'P1' | 'P2' | 'P3' | 'P4'
        doctor_category:     e.g. 'Cardiology', 'Neurology'
        possible_conditions: list of condition strings from AI triage
        red_flags:           list of red flag strings from AI triage
        patient_age:         optional, used for pediatric detection
        symptoms_text:       original raw symptoms text, used for keyword matching

    Returns:
        dict with required_bed_type, required_services, required_departments, etc.
    """
    # Build a combined text blob for keyword matching
    search_text = " ".join([
        symptoms_text,
        " ".join(possible_conditions),
        " ".join(red_flags),
        doctor_category,
    ]).lower()

    # ── Step 1: Try deterministic rule table ──────────────────────────────────
    for rule in PROFILE_RULES:
        # Check if the doctor category is in this rule's categories
        cat_match = any(
            cat.lower() == doctor_category.lower()
            for cat in rule["match_categories"]
        )
        # Check if any keyword from this rule appears in the search text
        kw_match = any(kw in search_text for kw in rule["match_keywords"])

        if cat_match or kw_match:
            profile = dict(rule["profile"])

            # Age-based override: if patient is under 16, flag pediatric requirement
            if patient_age and patient_age < 16:
                profile["requires_pediatric"] = True
                if "pediatrics" not in profile["required_departments"]:
                    profile["required_departments"] = ["pediatrics"] + profile["required_departments"]

            logger.info(f"[needs_profiler] Rule match: {doctor_category} → {profile['required_bed_type']}")
            return profile

    # ── Step 2: AI fallback for unmatched cases ───────────────────────────────
    # Only used when the rule table doesn't cover the presentation.
    # This handles rare/unusual combinations.
    try:
        profile = _ai_generate_profile(
            p_level, doctor_category, possible_conditions, red_flags, patient_age
        )
        logger.info(f"[needs_profiler] AI generated profile for {doctor_category}")
        return profile
    except Exception as exc:
        logger.error(f"[needs_profiler] AI profile generation failed: {exc}")
        # Fall through to severity-based default

    # ── Step 3: Default by severity (always succeeds) ─────────────────────────
    default = dict(DEFAULT_PROFILES.get(p_level, DEFAULT_PROFILES["P1"]))
    logger.info(f"[needs_profiler] Using default profile for {p_level}")
    return default


# ── Groq-based fallback profiler ──────────────────────────────────────────────

_AI_PROFILE_PROMPT = """
You are a clinical resource coordinator. Given an emergency triage result, 
determine the specific hospital resources this patient requires.

Return ONLY valid JSON (no markdown, no prose):
{
  "required_bed_type": "icu" | "emergency" | "general" | "ventilator",
  "required_services": ["IMG_CT", "IMG_MRI", "IMG_ECG", "IMG_XRAY", "BLD_BANK", "NEP_DIAL", "ICU_VENT"],
  "required_departments": ["cardiology", "neurology", "surgery", "emergency", "icu", "pediatrics", "orthopedic", "nephrology"],
  "requires_ventilator": true | false,
  "requires_blood_bank": true | false,
  "requires_pediatric": true | false,
  "time_sensitivity_minutes": <integer — how many minutes until care must start>,
  "profile_reasoning": "<1-2 sentence explanation a dispatcher can read in 5 seconds>"
}

Service codes: IMG_CT=CT Scan, IMG_MRI=MRI, IMG_ECG=ECG, IMG_XRAY=X-Ray, 
BLD_BANK=Blood Bank, NEP_DIAL=Dialysis, ICU_VENT=Ventilator

Only include services and departments that are ACTUALLY needed. Empty arrays are valid.
"""


def _ai_generate_profile(
    p_level: str,
    doctor_category: str,
    possible_conditions: list,
    red_flags: list,
    patient_age: int = None,
) -> dict:
    """Calls Groq to generate a care needs profile for unusual presentations."""
    user_msg = (
        f"Triage level: {p_level}\n"
        f"Specialty: {doctor_category}\n"
        f"Possible conditions: {', '.join(possible_conditions)}\n"
        f"Red flags: {', '.join(red_flags)}\n"
    )
    if patient_age:
        user_msg += f"Patient age: {patient_age}\n"

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _AI_PROFILE_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.05,
        max_tokens=300,
    )

    raw = re.sub(r"```json|```", "", response.choices[0].message.content.strip()).strip()
    profile = json.loads(raw)

    # Ensure required fields exist
    profile.setdefault("required_bed_type",       "general")
    profile.setdefault("required_services",       [])
    profile.setdefault("required_departments",    [])
    profile.setdefault("requires_ventilator",     False)
    profile.setdefault("requires_blood_bank",     False)
    profile.setdefault("requires_pediatric",      False)
    profile.setdefault("time_sensitivity_minutes", 60 if p_level in ("P1", "P2") else 240)
    profile.setdefault("profile_reasoning",       "")

    return profile
