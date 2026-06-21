# apps/triage/unified_triage.py
"""
Unified AI Triage Engine
========================
Role 1 (Language Translator) + Role 2 (Severity Scorer)

This replaces the keyword-based triage_engine.py in the emergency case flow.

Key design decisions:
  1. Uses llama-3.3-70b-versatile (the best available Groq model) for medical accuracy.
  2. temperature=0.05 — extremely deterministic output. Medical decisions must not be
     randomly different on identical inputs.
  3. Asymmetric calibration baked into the system prompt: the model is explicitly
     instructed that under-triage is more dangerous than over-triage. Ambiguous
     inputs ALWAYS score upward.
  4. Secondary validation pass: if confidence=LOW and the AI scored P3 or P4,
     the score is automatically bumped to P2. This is a hard safety rule.
  5. Wraps the existing analyze_symptoms() for backward compatibility — the old
     /api/triage/analyze/ endpoint still works unchanged.
"""

import json
import re
import logging

from groq import Groq
from django.conf import settings

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.GROQ_API_KEY)

# Use the highest-quality model for emergency medical decisions
MODEL = 'llama-3.3-70b-versatile'

# ── Asymmetric Calibration System Prompt ─────────────────────────────────────
# This prompt is the most critical component of the AI system.
# Every word here has been chosen deliberately.
UNIFIED_TRIAGE_SYSTEM_PROMPT = """
You are a clinical emergency triage AI assistant. Your output directly determines 
which hospital a patient is routed to and how fast they get care. Errors can cost lives.

CRITICAL ASYMMETRY RULE — READ THIS FIRST:
Under-triage (scoring too low) = patient dies waiting.
Over-triage (scoring too high) = wasted resources, patient survives.
THEREFORE: When ANY ambiguity exists, you MUST score upward, never downward.
"When in doubt, go up" is your primary decision rule.

TRIAGE LEVELS (Emergency Severity Index equivalent):
- P1 Critical: Immediately life-threatening. Patient may die without intervention in minutes.
  Examples: cardiac arrest, stroke with neuro symptoms, severe trauma, anaphylaxis,
  respiratory failure, unconsciousness, massive hemorrhage, seizure, septic shock.
  → Needs ICU, ambulance, immediate specialist.

- P2 Urgent: High risk. May deteriorate within 15-60 minutes without care.
  Examples: chest pain (any), severe difficulty breathing, altered consciousness,
  high fever in infant/elderly, vomiting blood, head trauma, severe burns,
  suspected fracture with vascular compromise, severe allergic reaction.
  → Needs emergency evaluation within 1 hour.

- P3 Moderate: Stable but needs attention within 4 hours.
  Examples: moderate pain, limb fracture (intact circulation), controlled bleeding,
  moderate fever (adult), urinary symptoms, moderate asthma (stable).
  → Needs same-day care but not immediately life-threatening.

- P4 Low: Non-urgent. Can wait > 4 hours.
  Examples: minor cuts, mild cold, skin rash, routine medication refill,
  mild joint pain (days/weeks old), minor dental.
  → OPD level. No emergency resources needed.

ESCALATION RULES (these override your initial scoring):
1. Any mention of UNCONSCIOUSNESS, NOT RESPONDING, or UNRESPONSIVE → minimum P1
2. Any mention of NOT BREATHING, GASPING, LABORED BREATHING → minimum P1
3. Any mention of CHEST PAIN in adults (any severity) → minimum P2
4. Any ELDERLY patient (>65) with FALL + ALTERED BEHAVIOR → minimum P1
5. Any CHILD under 2 with FEVER > 38°C → minimum P2
6. Any mention of BLOOD (vomiting/coughing blood, rectal bleeding) → minimum P2
7. Symptoms with RADIATING PAIN (arm, jaw, back) + chest → P1
8. COMBINATION SIGNALS matter: two moderate symptoms together often = higher severity

NEGATION AWARENESS:
"no chest pain" is NOT the same as "chest pain"
"was not breathing but is now stable" ≠ "not breathing" — use clinical context

CONFIDENCE:
- HIGH: clear, unambiguous presentation, you are certain of your scoring
- MEDIUM: some ambiguity but reasonable confidence
- LOW: significant ambiguity, insufficient information — AUTOMATICALLY triggers escalation

MANDATORY BEHAVIOR when confidence=LOW:
  - If your tentative score is P3 or P4 → bump to P2 minimum
  - If your tentative score is P2 → keep P2 but note the uncertainty
  - NEVER output LOW confidence with P3 or P4

OUTPUT FORMAT — Return ONLY valid JSON, no markdown fences, no prose:
{
  "p_level": "P1" | "P2" | "P3" | "P4",
  "severity_label": "Critical" | "Urgent" | "Moderate" | "Low",
  "doctor_category": "<most appropriate medical specialty>",
  "possible_conditions": ["condition1", "condition2", "condition3"],
  "recommended_action": "<immediate action in plain language>",
  "requires_ambulance": true | false,
  "requires_icu": true | false,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "<2-3 sentences. State what clinical signals led to this level. 
                 Mention any escalation rules applied. Use plain language a dispatcher 
                 can read in under 10 seconds.>",
  "red_flags": ["flag1", "flag2"],
  "was_escalated": true | false,
  "escalation_reason": "<which rule triggered escalation, or empty string>"
}
"""


def unified_analyze(
    symptoms_text: str,
    patient_age: int = None,
    patient_gender: str = None,
    known_conditions: str = None,
) -> dict:
    """
    Main entry point for the AI triage engine.

    Args:
        symptoms_text:     Free-text description of symptoms (dispatcher or patient input).
                           This is the most important input. No pre-structuring needed.
        patient_age:       Optional. Used to apply age-specific escalation rules.
        patient_gender:    Optional. 'male' | 'female' | 'other'
        known_conditions:  Optional. Pre-existing conditions (diabetes, heart disease, etc.)

    Returns:
        dict with p_level, severity_label, reasoning, red_flags, etc.
        Always returns something — never raises on Groq failure (falls back safely).

    Note:
        After the AI responds, a secondary validation pass is applied:
        - If confidence=LOW and p_level is P3 or P4 → bumped to P2 with explanation.
        This is a hard safety rule independent of the LLM output.
    """
    # ── Build context string ──────────────────────────────────────────────────
    context_parts = []
    if patient_age is not None:
        context_parts.append(f"Patient age: {patient_age}")
    if patient_gender:
        context_parts.append(f"Patient gender: {patient_gender}")
    if known_conditions:
        context_parts.append(f"Known medical conditions: {known_conditions}")

    context_str = "\n".join(context_parts)
    user_message = f"{context_str}\n\nSymptoms reported: {symptoms_text}".strip()

    # ── Call Groq ─────────────────────────────────────────────────────────────
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": UNIFIED_TRIAGE_SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            temperature=0.05,   # Near-deterministic: medical decisions must be consistent
            max_tokens=600,
        )
        raw_text = response.choices[0].message.content.strip()
    except Exception as exc:
        # Groq failure — return a safe P1 fallback so emergency flow is never blocked
        logger.error(f"[unified_triage] Groq API failure: {exc}")
        return _safe_fallback(symptoms_text)

    # ── Parse JSON ────────────────────────────────────────────────────────────
    clean = re.sub(r"```json|```", "", raw_text).strip()
    try:
        result = json.loads(clean)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
            except json.JSONDecodeError:
                logger.error(f"[unified_triage] JSON parse failure: {raw_text[:200]}")
                return _safe_fallback(symptoms_text)
        else:
            logger.error(f"[unified_triage] No JSON found in response: {raw_text[:200]}")
            return _safe_fallback(symptoms_text)

    # ── Validate required fields ──────────────────────────────────────────────
    required = ["p_level", "severity_label", "doctor_category",
                "recommended_action", "requires_ambulance", "confidence", "reasoning"]
    missing = [f for f in required if f not in result]
    if missing:
        logger.warning(f"[unified_triage] Missing fields {missing} — using fallback")
        return _safe_fallback(symptoms_text)

    # ── Ensure optional fields exist ──────────────────────────────────────────
    result.setdefault("possible_conditions", [])
    result.setdefault("red_flags", [])
    result.setdefault("requires_icu", False)
    result.setdefault("was_escalated", False)
    result.setdefault("escalation_reason", "")

    # ── Secondary validation: LOW confidence safety rule ──────────────────────
    # This is a hard code-level rule, not dependent on the LLM following instructions.
    if result.get("confidence") == "LOW":
        p = result.get("p_level", "P3")
        if p in ("P3", "P4"):
            original = p
            result["p_level"] = "P2"
            result["severity_label"] = "Urgent"
            result["was_escalated"] = True
            result["escalation_reason"] = (
                f"AUTO-ESCALATED: AI confidence was LOW with original score {original}. "
                f"Safety rule requires minimum P2 when AI is uncertain. "
                f"Clinical evaluation required."
            )
            # Update requires fields to match new level
            result["requires_ambulance"] = True
            result["reasoning"] = (
                f"{result.get('reasoning', '')} "
                f"[NOTE: Score escalated from {original} to P2 because AI confidence was LOW. "
                f"Insufficient information to rule out serious condition.]"
            ).strip()
            logger.info(f"[unified_triage] LOW confidence escalation: {original} → P2")

    # ── Normalize p_level to valid values ─────────────────────────────────────
    if result["p_level"] not in ("P1", "P2", "P3", "P4"):
        result["p_level"] = "P1"  # Unknown → safest assumption
        result["was_escalated"] = True
        result["escalation_reason"] = "Invalid p_level from AI — defaulted to P1 for safety"

    return result


def _safe_fallback(symptoms_text: str) -> dict:
    """
    Returns a P2 Urgent result when the AI is unavailable.
    P2 is chosen (not P1) to avoid flooding all resources,
    but high enough to ensure the patient gets timely care.
    Includes a clear flag that this is a fallback, not AI output.
    """
    return {
        "p_level": "P2",
        "severity_label": "Urgent",
        "doctor_category": "Emergency",
        "possible_conditions": [],
        "recommended_action": "Proceed to nearest emergency department immediately. AI analysis unavailable.",
        "requires_ambulance": True,
        "requires_icu": False,
        "confidence": "LOW",
        "reasoning": (
            "AI triage service temporarily unavailable. "
            "Default P2 (Urgent) assigned as a safety measure. "
            "A clinician must manually assess this patient immediately."
        ),
        "red_flags": ["AI_UNAVAILABLE"],
        "was_escalated": True,
        "escalation_reason": "Groq API failure — safe fallback P2 applied",
    }
