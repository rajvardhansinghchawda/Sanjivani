"""
Fallback Rule Engine
====================
Always-available rule-based risk assessment.
Activated when:
  - ML model is unavailable (not trained, file missing, exception)
  - Circuit breaker is open
  - Patient is on FREE plan (no ML access)
  - Model returns null/invalid output

Rules are intentionally conservative — prefer false positives over false negatives
in a healthcare context (better to alert unnecessarily than miss a high-risk patient).

This is the safety net. It must NEVER raise an exception.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger("medadhere.ai_engine.fallback")


@dataclass
class FallbackRiskResult:
    patient_id: str
    risk_score: float
    risk_level: str
    confidence: float
    reasons: List[str]
    source: str = "RULE_BASED_FALLBACK"
    is_advisory_only: bool = True


# ---------------------------------------------------------------------------
# Rule definitions
# ---------------------------------------------------------------------------

RULES = [
    # (weight, condition_fn, reason_template)
    # Higher weight = stronger indicator of non-adherence
    {
        "id": "missed_count_7d_critical",
        "weight": 0.40,
        "threshold_fn": lambda f: f.get("missed_count_7d", 0) >= 5,
        "reason": "Missed 5 or more doses in the last 7 days",
    },
    {
        "id": "missed_count_7d_high",
        "weight": 0.25,
        "threshold_fn": lambda f: f.get("missed_count_7d", 0) >= 3,
        "reason": "Missed 3 or more doses in the last 7 days",
    },
    {
        "id": "missed_count_7d_medium",
        "weight": 0.15,
        "threshold_fn": lambda f: f.get("missed_count_7d", 0) >= 1,
        "reason": "At least one missed dose in the last 7 days",
    },
    {
        "id": "low_adherence_7d",
        "weight": 0.30,
        "threshold_fn": lambda f: f.get("adherence_rate_7d", 1.0) < 0.60,
        "reason": "7-day adherence rate below 60%",
    },
    {
        "id": "low_adherence_30d",
        "weight": 0.20,
        "threshold_fn": lambda f: f.get("adherence_rate_30d", 1.0) < 0.70,
        "reason": "30-day adherence rate below 70%",
    },
    {
        "id": "consecutive_misses",
        "weight": 0.35,
        "threshold_fn": lambda f: f.get("consecutive_miss_streak", 0) >= 3,
        "reason": "3 or more consecutive missed doses",
    },
    {
        "id": "high_regimen_complexity",
        "weight": 0.10,
        "threshold_fn": lambda f: f.get("doses_per_day", 1) >= 5,
        "reason": "Complex regimen with 5 or more daily doses",
    },
    {
        "id": "cognitive_impairment",
        "weight": 0.15,
        "threshold_fn": lambda f: bool(f.get("is_cognitively_impaired", 0)),
        "reason": "Patient has cognitive impairment — higher supervision needed",
    },
    {
        "id": "elderly_complex",
        "weight": 0.10,
        "threshold_fn": lambda f: f.get("patient_age_group", 0) == 2 and f.get("medication_count", 1) >= 3,
        "reason": "Elderly patient with multiple medications",
    },
    {
        "id": "worsening_trend",
        "weight": 0.15,
        "threshold_fn": lambda f: f.get("adherence_trend_delta", 0.0) < -0.15,
        "reason": "Adherence declining — 7-day rate significantly lower than 30-day average",
    },
    {
        "id": "long_miss_gap",
        "weight": 0.12,
        "threshold_fn": lambda f: f.get("days_since_last_miss", 999) < 2,
        "reason": "Missed a dose within the last 48 hours",
    },
    {
        "id": "high_weekend_miss",
        "weight": 0.08,
        "threshold_fn": lambda f: f.get("weekend_miss_ratio", 0.0) > 0.40,
        "reason": "Frequently misses doses on weekends (>40% miss rate)",
    },
    {
        "id": "high_evening_miss",
        "weight": 0.08,
        "threshold_fn": lambda f: f.get("evening_miss_ratio", 0.0) > 0.35,
        "reason": "Frequently misses evening doses",
    },
    {
        "id": "zero_streak",
        "weight": 0.10,
        "threshold_fn": lambda f: f.get("current_streak_days", 0) == 0,
        "reason": "No current adherence streak",
    },
    {
        "id": "has_high_alert_med",
        "weight": 0.20,
        "threshold_fn": lambda f: bool(f.get("has_high_alert_med", 0)),
        "reason": "On high-alert medication (anticoagulant, insulin, antiepileptic)",
    },
]


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def _classify_risk_level(score: float) -> str:
    """Map continuous score to risk level bucket."""
    if score >= 0.75:
        return "critical"
    elif score >= 0.55:
        return "high"
    elif score >= 0.30:
        return "medium"
    else:
        return "low"


def assess_risk(
    patient_id: str,
    features: Dict,
) -> FallbackRiskResult:
    """
    Rule-based risk assessment. Always returns a result — never raises.

    Args:
        patient_id: Patient UUID string
        features: Feature dict from FeatureVector.features

    Returns:
        FallbackRiskResult — safe, structured output
    """
    try:
        triggered_reasons = []
        total_weight = 0.0
        max_possible_weight = 1.8  # Use a practical max instead of sum(RULES) to allow reaching 'critical'

        for rule in RULES:
            try:
                if rule["threshold_fn"](features):
                    triggered_reasons.append(rule["reason"])
                    total_weight += rule["weight"]
            except Exception as e:
                # Individual rule failures should never stop the overall assessment
                logger.debug(f"Rule {rule['id']} evaluation failed: {e}")
                continue

        # Normalize to [0, 1]
        risk_score = min(1.0, total_weight / max_possible_weight)

        # Apply a floor — even zero-miss patients get a small base score
        risk_score = max(0.02, risk_score)

        risk_level = _classify_risk_level(risk_score)

        # Confidence is lower when fewer rules fired (less evidence)
        confidence = min(0.85, 0.40 + (len(triggered_reasons) / len(RULES)) * 0.5)

        # Default reason if nothing fired
        if not triggered_reasons:
            triggered_reasons = ["No significant risk factors detected — adherence appears stable"]

        return FallbackRiskResult(
            patient_id=patient_id,
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            confidence=round(confidence, 4),
            reasons=triggered_reasons[:3],  # Top 3 reasons
        )

    except Exception as e:
        logger.error(f"Fallback risk assessment failed for {patient_id}: {e}")
        # Last-resort safe default — MEDIUM risk so system errs on side of caution
        return FallbackRiskResult(
            patient_id=patient_id,
            risk_score=0.35,
            risk_level="medium",
            confidence=0.10,
            reasons=["Risk assessment temporarily unavailable — medium risk assigned as precaution"],
            source="RULE_BASED_FALLBACK_ERROR",
        )


def quick_assess(missed_7d: int, missed_30d: int, adherence_7d: float = 1.0) -> str:
    """
    Ultra-minimal rule check for use when only miss counts are available.
    Used in escalation decisions when full feature vector is not ready.
    Returns risk_level string only.
    """
    if missed_7d >= 5 or adherence_7d < 0.40:
        return "critical"
    if missed_7d >= 3 or adherence_7d < 0.60:
        return "high"
    if missed_7d >= 1 or adherence_7d < 0.80:
        return "medium"
    return "low"
