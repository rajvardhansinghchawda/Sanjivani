# backend/apps/patients/triage_engine.py

"""
Triage Engine — maps doctor_category + symptom_flags → P1/P2/P3/P4 severity.
P1 = CRITICAL  (immediate, life-threatening)
P2 = HIGH      (urgent, may deteriorate)
P3 = MEDIUM    (semi-urgent, stable)
P4 = LOW       (non-urgent, walk-in level)
"""

SEVERITY_MAP = {
    # Doctor category → default severity
    "Cardiology":       "P1",
    "Neurology":        "P1",
    "Trauma":           "P1",
    "Emergency":        "P1",
    "Pulmonology":      "P2",
    "Nephrology":       "P2",
    "Gastroenterology": "P2",
    "Oncology":         "P2",
    "Orthopedics":      "P3",
    "General Surgery":  "P3",
    "ENT":              "P3",
    "Pediatrics":       "P3",
    "Dermatology":      "P4",
    "Ophthalmology":    "P4",
    "Psychiatry":       "P4",
    "General Medicine": "P4",
}

SEVERITY_TO_PRIORITY = {
    "P1": "CRITICAL",
    "P2": "HIGH",
    "P3": "MEDIUM",
    "P4": "LOW",
}

PRIORITY_LABELS = {
    "P1": {"label": "Critical", "color": "#E24B4A", "description": "Immediate life-threatening. Requires ICU/emergency care now."},
    "P2": {"label": "Urgent",   "color": "#EF9F27", "description": "High risk. Needs treatment within 1 hour."},
    "P3": {"label": "Moderate", "color": "#378ADD", "description": "Semi-urgent. Stable but needs attention within 4 hours."},
    "P4": {"label": "Low",      "color": "#639922", "description": "Non-urgent. Can be managed in OPD."},
}

# Override flags — if any of these keywords appear in symptoms text, escalate
ESCALATION_KEYWORDS = {
    "P1": [
        "chest pain", "heart attack", "stroke", "unconscious", "not breathing",
        "severe bleeding", "seizure", "anaphylaxis", "respiratory failure",
        "cardiac arrest", "coma", "paralysis", "massive trauma",
    ],
    "P2": [
        "high fever", "difficulty breathing", "vomiting blood", "severe pain",
        "altered consciousness", "fracture", "head injury", "burn",
    ],
}


def compute_severity(doctor_category: str, symptoms_text: str = "") -> dict:
    """
    Returns severity dict with P-level, priority string, label, color, description.

    Args:
        doctor_category: string from existing symptom analysis (e.g. "Cardiology")
        symptoms_text: raw symptom description for keyword escalation check

    Returns:
        {
            "p_level": "P1",
            "priority": "CRITICAL",
            "label": "Critical",
            "color": "#E24B4A",
            "description": "...",
            "escalated": True/False
        }
    """
    symptoms_lower = symptoms_text.lower() if symptoms_text else ""

    # Check P1 escalation keywords first
    for keyword in ESCALATION_KEYWORDS["P1"]:
        if keyword in symptoms_lower:
            return {**PRIORITY_LABELS["P1"], "p_level": "P1",
                    "priority": SEVERITY_TO_PRIORITY["P1"], "escalated": True}

    # Check P2 escalation keywords
    for keyword in ESCALATION_KEYWORDS["P2"]:
        if keyword in symptoms_lower:
            base = SEVERITY_MAP.get(doctor_category, "P3")
            # Only escalate upward, never downward
            p_level = "P2" if base in ("P3", "P4") else base
            return {**PRIORITY_LABELS[p_level], "p_level": p_level,
                    "priority": SEVERITY_TO_PRIORITY[p_level], "escalated": True}

    # Default from category map
    p_level = SEVERITY_MAP.get(doctor_category, "P3")
    return {**PRIORITY_LABELS[p_level], "p_level": p_level,
            "priority": SEVERITY_TO_PRIORITY[p_level], "escalated": False}
