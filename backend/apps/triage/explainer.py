# apps/triage/explainer.py
"""
AI Explainer
============
Role 5 — Explainer

Generates two types of human-readable explanations:

1. Severity explanation — why was this severity level assigned?
   Already partially done by unified_triage.py's `reasoning` field.
   The explainer enriches this with more context when needed.

2. Hospital routing explanation — why was this hospital ranked #1?
   This is the most important missing piece from the original system.
   Dispatchers and doctors MUST be able to read this in < 10 seconds
   and either confirm or override the recommendation.

Design decisions:
  - The explanation is generated AFTER all scoring is done, so the LLM
    is explaining a decision that was already made by the capability matcher.
    It is NOT making the routing decision — it is narrating it.
  - We pass the full hospital ranking data to Groq, not just the top result,
    so the explanation can compare and contrast (why #1 over #2).
  - We cap hospital list at top 3 in the prompt to keep token count low.
  - If Groq fails, we fall back to a template-filled explanation using
    the structured data from the capability matcher.
"""

import logging
import re

from groq import Groq
from django.conf import settings

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL  = 'llama-3.3-70b-versatile'

_EXPLAINER_SYSTEM_PROMPT = """
You are a medical dispatch coordinator explaining an AI decision to a human dispatcher.

Your explanations must be:
- Readable in under 10 seconds
- Written in plain English — no medical jargon unless unavoidable
- Specific: reference actual data (distances, beds, services matched)
- Honest about limitations: mention if any required service was unavailable

Format your response as plain text (NO markdown, NO bullet points, NO headers).
Write 3-5 sentences maximum. The dispatcher needs to read this while managing an emergency.

Do NOT say "I recommend" — you are explaining what the AI decided and why.
Do NOT repeat the hospital name more than once.
"""


def generate_routing_explanation(
    patient_severity: str,
    needs_profile: dict,
    ranked_hospitals: list,
    patient_description: str = "",
) -> str:
    """
    Generates a human-readable explanation for the hospital routing decision.

    Args:
        patient_severity:    'P1' | 'P2' | 'P3' | 'P4'
        needs_profile:       Output from needs_profiler.profile_care_needs()
        ranked_hospitals:    Output from routing.rank_hospitals_for_case() — top 5
        patient_description: Short patient context (e.g., "72F, unresponsive after fall")

    Returns:
        str — A 3-5 sentence explanation suitable for dispatcher display.
    """
    if not ranked_hospitals:
        return "No nearby hospitals found within the search radius. Please expand the search area or contact emergency services directly."

    top = ranked_hospitals[0]
    top_name = top.get("name", "Unknown Hospital")

    # Build the context for Groq
    services_needed = needs_profile.get("required_services", [])
    depts_needed    = needs_profile.get("required_departments", [])
    time_window     = needs_profile.get("time_sensitivity_minutes", 60)

    # Build compact hospital summary (top 3 only to keep prompt small)
    hospital_summaries = []
    for i, h in enumerate(ranked_hospitals[:3], 1):
        cap = h.get("capability_match", {})
        avail  = cap.get("required_services_available", [])
        miss   = cap.get("required_services_missing", [])
        depts_ok   = cap.get("required_depts_available", [])
        depts_miss = cap.get("required_depts_missing", [])

        summary = (
            f"#{i} {h.get('name')} — "
            f"{h.get('distance_km', '?')}km ({h.get('travel_minutes', '?')} min ETA) — "
            f"{h.get('available_beds', 0)} beds available — "
            f"Services matched: {', '.join(avail) if avail else 'none required'} — "
            f"Services missing: {', '.join(miss) if miss else 'none'} — "
            f"Depts matched: {', '.join(depts_ok) if depts_ok else 'none required'} — "
            f"Depts missing: {', '.join(depts_miss) if depts_miss else 'none'} — "
            f"Load: {int(h.get('load_factor', 0.5) * 100)}% capacity"
        )
        hospital_summaries.append(summary)

    user_msg = (
        f"Patient: {patient_description or 'Unknown'}\n"
        f"Severity: {patient_severity}\n"
        f"Required services: {', '.join(services_needed) if services_needed else 'none specific'}\n"
        f"Required departments: {', '.join(depts_needed) if depts_needed else 'none specific'}\n"
        f"Time window: {time_window} minutes\n\n"
        f"Hospital rankings:\n" + "\n".join(hospital_summaries)
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _EXPLAINER_SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
            temperature=0.2,    # slightly more expressive than triage, but still consistent
            max_tokens=200,
        )
        explanation = response.choices[0].message.content.strip()
        # Remove any stray markdown that crept in
        explanation = re.sub(r"\*\*|##|__", "", explanation).strip()
        logger.info(f"[explainer] Generated routing explanation for {top_name}")
        return explanation

    except Exception as exc:
        logger.error(f"[explainer] Groq failed: {exc} — using template fallback")
        return _template_routing_explanation(ranked_hospitals, needs_profile, time_window)


def _template_routing_explanation(
    ranked_hospitals: list,
    needs_profile: dict,
    time_window: int,
) -> str:
    """
    Template fallback used when Groq is unavailable.
    Generates a structured but not AI-narrated explanation from the scoring data.
    """
    if not ranked_hospitals:
        return "No hospitals found. Manual routing required."

    top = ranked_hospitals[0]
    top_name   = top.get("name", "Hospital")
    distance   = top.get("distance_km", "?")
    eta        = top.get("travel_minutes", "?")
    beds       = top.get("available_beds", 0)

    cap         = top.get("capability_match", {})
    svc_matched = cap.get("required_services_available", [])
    svc_missing = cap.get("required_services_missing",  [])

    parts = [
        f"{top_name} ranked #1: {distance}km away, ~{eta} min ambulance ETA, {beds} beds available."
    ]

    if svc_matched:
        parts.append(f"Required services confirmed available: {', '.join(svc_matched)}.")

    if svc_missing:
        parts.append(
            f"WARNING: The following required services are NOT confirmed available: "
            f"{', '.join(svc_missing)}. Verify before dispatch."
        )

    if len(ranked_hospitals) > 1:
        alt = ranked_hospitals[1]
        parts.append(
            f"Alternative: {alt.get('name')} at {alt.get('distance_km', '?')}km "
            f"({alt.get('available_beds', 0)} beds)."
        )

    if time_window <= 30:
        parts.append(f"Time-critical: patient needs care within {time_window} minutes — minimize delays.")

    return " ".join(parts)


def enrich_severity_reasoning(
    ai_reasoning: str,
    p_level: str,
    red_flags: list,
    was_escalated: bool,
    escalation_reason: str = "",
    patient_age: int = None,
    patient_gender: str = None,
) -> str:
    """
    Enriches the AI's raw reasoning text with structured context.
    This does NOT call Groq — it adds deterministic context to existing reasoning.
    Used to build the final dispatcher-facing severity explanation.
    """
    parts = [ai_reasoning] if ai_reasoning else []

    # Add demographic context
    demo_parts = []
    if patient_age:
        demo_parts.append(f"{patient_age}yo")
    if patient_gender:
        demo_parts.append(patient_gender)
    if demo_parts:
        parts.append(f"Patient: {' '.join(demo_parts)}.")

    # Add escalation notice
    if was_escalated and escalation_reason:
        parts.append(f"⚠️ {escalation_reason}")

    # Add critical action time hint based on p_level
    action_hints = {
        "P1": "Immediate intervention required — every minute counts.",
        "P2": "Emergency evaluation needed within 60 minutes.",
        "P3": "Clinical assessment required within 4 hours.",
        "P4": "Non-urgent — can wait for scheduled care.",
    }
    hint = action_hints.get(p_level, "")
    if hint:
        parts.append(hint)

    # Add red flag summary if present
    if red_flags:
        flags_str = ", ".join(f'"{f}"' for f in red_flags[:4])
        parts.append(f"Key indicators: {flags_str}.")

    return " ".join(parts)
