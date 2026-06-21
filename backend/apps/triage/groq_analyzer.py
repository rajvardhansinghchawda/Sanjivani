# apps/triage/groq_analyzer.py
"""
Groq-powered AI Symptom Triage Analyzer
========================================
Follows the same pattern as apps/calls/agent.py
Uses settings.GROQ_API_KEY (loaded via django-environ in config/settings.py)
"""

import json
import re
from groq import Groq
from django.conf import settings

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL  = 'llama-3.3-70b-versatile'   # current Groq model (llama3-70b-8192 decommissioned)

TRIAGE_SYSTEM_PROMPT = """
You are an AI medical triage assistant. A patient describes their symptoms.
Your job is to analyze and return a structured JSON response ONLY — no extra text,
no markdown, no explanation outside the JSON.

Return this exact JSON structure:
{
  "p_level": "P1" | "P2" | "P3" | "P4",
  "severity_label": "Critical" | "Urgent" | "Moderate" | "Low",
  "doctor_category": "<medical specialty>",
  "possible_conditions": ["condition1", "condition2", "condition3"],
  "recommended_action": "<what to do immediately>",
  "requires_ambulance": true | false,
  "requires_icu": true | false,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "<1-2 sentence explanation>",
  "red_flags": ["flag1", "flag2"]
}

Triage levels:
- P1 Critical: immediately life-threatening (heart attack, stroke, severe trauma,
  respiratory failure, anaphylaxis, unconscious)
- P2 Urgent: serious, risk of deterioration within 1 hour (high fever, difficulty
  breathing, vomiting blood, severe pain, altered consciousness)
- P3 Moderate: needs attention within 4 hours, stable (fractures, moderate pain,
  infections, moderate fever)
- P4 Low: non-urgent, can wait (minor cuts, mild cold, routine checkup, skin rashes)

IMPORTANT: Always err on the side of caution. If unsure between P1 and P2, choose P1.
Return ONLY valid JSON. No markdown fences, no prose outside the JSON object.
"""


def analyze_symptoms(
    symptoms_text: str,
    patient_age: int = None,
    patient_gender: str = None,
) -> dict:
    """
    Analyze patient symptoms using Groq LLM.

    Args:
        symptoms_text:  Free text description of symptoms
        patient_age:    Optional patient age for context
        patient_gender: Optional 'male' | 'female' | 'other'

    Returns:
        Parsed dict with p_level, severity_label, doctor_category, etc.

    Raises:
        ValueError  if response cannot be parsed or required fields missing
        Exception   on Groq API failure
    """
    # Build user message with optional context
    context_parts = []
    if patient_age:
        context_parts.append(f"Patient age: {patient_age}")
    if patient_gender:
        context_parts.append(f"Patient gender: {patient_gender}")

    context_str  = "\n".join(context_parts)
    user_message = f"{context_str}\n\nSymptoms: {symptoms_text}".strip()

    # ── Call Groq ──────────────────────────────────────────────
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        temperature=0.1,    # low = consistent, deterministic medical output
        max_tokens=512,
    )

    raw_text = response.choices[0].message.content.strip()

    # ── Parse JSON — strip markdown fences if Groq wraps them ─
    clean = re.sub(r"```json|```", "", raw_text).strip()

    try:
        result = json.loads(clean)
    except json.JSONDecodeError:
        # Fallback: extract first JSON object from text
        match = re.search(r"\{.*\}", clean, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            raise ValueError(f"Could not parse Groq response as JSON: {raw_text[:300]}")

    # ── Validate required fields ───────────────────────────────
    required = [
        "p_level", "severity_label", "doctor_category",
        "recommended_action", "requires_ambulance",
    ]
    missing = [f for f in required if f not in result]
    if missing:
        raise ValueError(f"Groq response missing fields: {missing}")

    # ── Ensure optional array fields exist ────────────────────
    result.setdefault("possible_conditions", [])
    result.setdefault("red_flags", [])
    result.setdefault("requires_icu", False)
    result.setdefault("confidence", "MEDIUM")
    result.setdefault("reasoning", "")

    return result
