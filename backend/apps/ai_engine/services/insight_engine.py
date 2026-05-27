"""
Insight Engine & Recommendation Engine
=======================================
Converts behavioral patterns into human-readable insights and actionable recommendations.
Both engines are subscription-aware but fail gracefully.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger("medadhere.ai_engine.insight_engine")


class InsightEngine:
    """
    Generates personalized, human-readable insights from patient adherence patterns.
    Output is shown directly in the patient app and caregiver dashboard.
    """

    @staticmethod
    def generate(patient_id: str, lang: str = "en") -> List[dict]:
        """
        Generate insights for a patient. Returns empty list on failure.
        """
        try:
            from apps.ai_engine.services.translation import TranslationService
            
            features = _get_features_for_patient(patient_id)
            if features is None:
                return []

            insights = []

            # Pattern: weekend miss
            if features.get("weekend_miss_ratio", 0) > 0.30:
                pct = int(features["weekend_miss_ratio"] * 100)
                insights.append({
                    "type": "WEEKEND_PATTERN",
                    "title": "Weekend Adherence Pattern Detected",
                    "body": f"You miss {pct}% of your doses on weekends. Consider setting extra reminders on Saturday and Sunday.",
                    "priority": "medium",
                })

            # Pattern: evening miss
            if features.get("evening_miss_ratio", 0) > 0.30:
                pct = int(features["evening_miss_ratio"] * 100)
                insights.append({
                    "type": "TIMING_OPTIMIZATION",
                    "title": "Evening Dose Timing Issue",
                    "body": f"You miss {pct}% of evening doses. Moving your evening dose to an earlier time may help.",
                    "priority": "medium",
                })

            # Pattern: worsening trend
            delta = features.get("adherence_trend_delta", 0)
            if delta < -0.15:
                insights.append({
                    "type": "RISK_WARNING",
                    "title": "Adherence Declining This Week",
                    "body": "Your adherence this week is notably lower than your 30-day average. Review your schedule with your caregiver.",
                    "priority": "high",
                })
            elif delta > 0.10:
                insights.append({
                    "type": "POSITIVE_REINFORCEMENT",
                    "title": "Great Improvement This Week!",
                    "body": "Your adherence this week is better than your recent average. Keep it up!",
                    "priority": "low",
                })

            # Streak milestone
            streak = features.get("current_streak_days", 0)
            if streak >= 7:
                insights.append({
                    "type": "STREAK_UPDATE",
                    "title": f"{streak}-Day Adherence Streak! 🎉",
                    "body": f"You've taken your medications as scheduled for {streak} consecutive days. Excellent consistency!",
                    "priority": "low",
                })

            # Risk warning
            rate_7d = features.get("adherence_rate_7d", 1.0)
            if rate_7d < 0.70:
                insights.append({
                    "type": "RISK_WARNING",
                    "title": "Low Weekly Adherence",
                    "body": f"You've only taken {int(rate_7d * 100)}% of your scheduled doses this week. Please reach out to your care team.",
                    "priority": "high",
                })

            # Late dose pattern
            avg_delay = features.get("avg_delay_minutes", 0)
            if avg_delay > 45:
                insights.append({
                    "type": "TIMING_OPTIMIZATION",
                    "title": "Consistently Late Doses",
                    "body": f"Your doses are typically taken about {int(avg_delay)} minutes late. Consider adjusting your reminder time to better fit your routine.",
                    "priority": "medium",
                })

            # Refill reminder
            if features.get("refill_days_late", 0) > 3:
                insights.append({
                    "type": "REFILL_REMINDER",
                    "title": "Medication Refill Overdue",
                    "body": f"Your last refill was {features['refill_days_late']} days late. Running out of medication is a common cause of missed doses.",
                    "priority": "high",
                })

            # Limit to 5 most relevant insights
            insights.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}[x["priority"]])
            insights = insights[:5]

            if lang != "en":
                # Extract texts to translate
                titles = [ins["title"] for ins in insights]
                bodies = [ins["body"] for ins in insights]
                
                translated_titles = TranslationService.batch_translate(titles, lang)
                translated_bodies = TranslationService.batch_translate(bodies, lang)
                
                for i in range(len(insights)):
                    insights[i]["title"] = translated_titles[i]
                    insights[i]["body"] = translated_bodies[i]

            return insights

        except Exception as e:
            logger.error(f"InsightEngine failed for {patient_id}: {e}")
            return []


class RecommendationEngine:
    """
    Generates actionable, evidence-based recommendations.
    Each recommendation includes title, message, action_data, and evidence.
    """

    @staticmethod
    def generate(patient_id: str, lang: str = "en") -> List[dict]:
        """
        Generate recommendations. Returns empty list on failure.
        """
        try:
            from apps.ai_engine.services.translation import TranslationService
            
            features = _get_features_for_patient(patient_id)
            if features is None:
                return []

            recommendations = []

            # Reschedule evening dose
            if features.get("evening_miss_ratio", 0) > 0.35:
                recommendations.append({
                    "type": "RESCHEDULE_DOSE",
                    "priority": "high",
                    "title": "Shift Evening Dose to Earlier Time",
                    "message": "You frequently miss your evening doses. Consider moving them to 6 PM or 7 PM when you may be more likely to remember.",
                    "action_data": {"suggested_shift": "evening", "suggested_hour": 18},
                    "evidence": f"Evening miss rate: {int(features['evening_miss_ratio'] * 100)}%. Studies show earlier evening timing improves adherence by 20-30%.",
                    "target_audience": "patient",
                })

            # Simplify regimen
            if features.get("doses_per_day", 1) >= 5 and features.get("adherence_rate_30d", 1) < 0.75:
                recommendations.append({
                    "type": "SIMPLIFY_REGIMEN",
                    "priority": "high",
                    "title": "Consider Simplifying Your Medication Schedule",
                    "message": "You take many doses each day, which can be hard to manage. Ask your doctor if any medications can be combined or reduced.",
                    "action_data": {"current_doses_per_day": features["doses_per_day"]},
                    "evidence": "Regimens with 5+ daily doses have 40% lower adherence than 1-2 dose regimens.",
                    "target_audience": "caregiver",
                })

            # Add caregiver
            if features.get("consecutive_miss_streak", 0) >= 3:
                recommendations.append({
                    "type": "CAREGIVER_INVOLVEMENT",
                    "priority": "high",
                    "title": "Consider Involving a Caregiver",
                    "message": "You've missed several consecutive doses. A family member or caregiver checking in daily could help maintain your routine.",
                    "action_data": {"feature": "caregiver_linking"},
                    "evidence": "Patients with active caregiver monitoring have 35% higher adherence rates.",
                    "target_audience": "patient",
                })

            # Weekend reminder boost
            if features.get("weekend_miss_ratio", 0) > 0.40:
                recommendations.append({
                    "type": "CHANGE_CHANNEL",
                    "priority": "medium",
                    "title": "Enable Weekend SMS Reminders",
                    "message": "You often miss weekend doses. Enabling SMS reminders on weekends may help you stay on track.",
                    "action_data": {"suggested_channels": ["sms"], "days": ["SAT", "SUN"]},
                    "evidence": f"Weekend miss rate: {int(features['weekend_miss_ratio'] * 100)}%.",
                    "target_audience": "patient",
                })

            # Education
            if features.get("skip_count_7d", 0) >= 3:
                recommendations.append({
                    "type": "EDUCATION",
                    "priority": "medium",
                    "title": "Learn Why Your Medications Matter",
                    "message": "You've skipped several doses recently. Understanding how each medication helps you can increase motivation to take them consistently.",
                    "action_data": {"action": "open_education"},
                    "evidence": "Medication education improves adherence by up to 25% in chronic disease patients.",
                    "target_audience": "patient",
                })

            # Contact doctor
            if features.get("adherence_rate_30d", 1) < 0.50:
                recommendations.append({
                    "type": "CONTACT_DOCTOR",
                    "priority": "high",
                    "title": "Schedule a Medication Review",
                    "message": "Your 30-day adherence is low. This may indicate side effects, cost concerns, or other barriers. Your doctor can help.",
                    "action_data": {"action": "contact_doctor"},
                    "evidence": "Medication reviews reduce non-adherence by 40% when barriers are identified early.",
                    "target_audience": "patient",
                })

            # Sort by priority, return top 3
            priority_order = {"high": 0, "medium": 1, "low": 2}
            recommendations.sort(key=lambda x: priority_order.get(x["priority"], 1))
            recommendations = recommendations[:3]

            if lang != "en":
                # Extract texts to translate
                titles = [rec["title"] for rec in recommendations]
                messages = [rec["message"] for rec in recommendations]
                
                translated_titles = TranslationService.batch_translate(titles, lang)
                translated_messages = TranslationService.batch_translate(messages, lang)
                
                for i in range(len(recommendations)):
                    recommendations[i]["title"] = translated_titles[i]
                    recommendations[i]["message"] = translated_messages[i]

            return recommendations

        except Exception as e:
            logger.error(f"RecommendationEngine failed for {patient_id}: {e}")
            return []


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_features_for_patient(patient_id: str) -> Optional[Dict]:
    """
    Get feature dict from cached risk score or compute fresh.
    Returns None if both fail.
    """
    try:
        from apps.ai_engine.models import PatientRiskScore
        score = (
            PatientRiskScore.objects.filter(
                patient_id=patient_id,
                expires_at__gt=datetime.now(timezone.utc),
            )
            .order_by("-generated_at")
            .first()
        )
        if score:
            return {
                "adherence_rate_7d": float(score.feature_adherence_7d or 1.0),
                "adherence_rate_30d": float(score.feature_adherence_30d or 1.0),
                "avg_delay_minutes": float(score.feature_avg_delay_min or 0),
                "skip_count_7d": score.feature_skip_count_7d or 0,
                "missed_count_7d": score.feature_missed_count_7d or 0,
                "doses_per_day": score.feature_regimen_complexity or 1,
                "weekend_miss_ratio": float(score.feature_weekend_miss_ratio or 0),
                "evening_miss_ratio": 0.0,
                "current_streak_days": 0,
                "adherence_trend_delta": 0.0,
                "consecutive_miss_streak": 0,
                "refill_days_late": score.feature_refill_days_late or 0,
            }
    except Exception:
        pass

    # Fresh compute via risk engine (may trigger inference)
    try:
        from apps.ai_engine.services.risk_engine import _fetch_patient_data
        from apps.ai_engine.services.feature_engineering import build_feature_vector

        events_df, prescriptions_data, patient_data = _fetch_patient_data(patient_id)
        fv = build_feature_vector(
            patient_id=patient_id,
            events_df=events_df,
            prescriptions_data=prescriptions_data,
            patient_data=patient_data,
        )
        return fv.features
    except Exception as e:
        logger.warning(f"Could not get features for insights ({patient_id}): {e}")
        return None
