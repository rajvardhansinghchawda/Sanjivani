"""
AI Engine Celery Tasks
=======================
All async AI operations. Triggered by:
  - Backend agents (via orchestrator.broadcast)
  - Celery Beat (scheduled batch jobs)
  - Direct API calls (POST /ai/retrain)

All tasks:
  - Are idempotent
  - Handle failures gracefully
  - Never block core reminder/adherence functionality
"""

import logging

from celery import shared_task

logger = logging.getLogger("medadhere.ai_engine.tasks")

def _get_patient_language(patient_id: str) -> str:
    """Fetch patient's preferred language, safely defaulting to 'en'."""
    try:
        from apps.clinical.models import Patient
        p = Patient.objects.get(id=patient_id)
        if p.user and hasattr(p.user, "preferred_language"):
            return p.user.preferred_language
        return "en"
    except Exception:
        return "en"


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="ai_engine.compute_risk_score",
)
def compute_risk_score(self, patient_id: str, trigger: str = "DOSE_EVENT", trace_id: str = None):
    """
    Compute and store risk score for a single patient.

    Triggered by:
      - AdherenceAgent on DOSE_LOGGED / DOSE_MISSED (PREMIUM only)
      - Celery Beat nightly batch (FREEMIUM + PREMIUM)
      - Direct API call

    Args:
        patient_id: Patient UUID
        trigger: Why this was triggered (DOSE_EVENT | NIGHTLY_BATCH | MANUAL | SCHEDULE_CHANGE)
        trace_id: Optional trace ID for distributed tracing
    """
    logger.info(f"[{trace_id}] Computing risk score: patient={patient_id} trigger={trigger}")
    try:
        from apps.ai_engine.services.risk_engine import RiskEngine, _compute_and_store
        result = _compute_and_store(patient_id)

        # Broadcast HIGH/CRITICAL risk to backend agents
        if result.get("risk_level") in ("high", "critical"):
            _notify_agents_high_risk.delay(patient_id, result, trace_id)

        logger.info(
            f"[{trace_id}] Risk computed: {patient_id} → {result.get('risk_level')} ({result.get('risk_score')})"
        )
        return result

    except Exception as exc:
        logger.error(f"[{trace_id}] Risk computation failed for {patient_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    name="ai_engine.batch_risk_score_all",
    soft_time_limit=3600,  # 1 hour
)
def batch_risk_score_all_patients(self):
    """
    Nightly batch: score all FREEMIUM + PREMIUM patients.
    Queues individual compute_risk_score tasks (fan-out pattern).
    Scheduled: 02:00 AM UTC daily (see MEDADHERE_CELERY_BEAT_SCHEDULE).
    """
    try:
        from apps.clinical.models import Patient
        patients = Patient.objects.filter(
            user__subscription__plan__slug__in=["freemium", "premium"],
            user__subscription__status="ACTIVE",
            deleted_at__isnull=True,
        ).values_list("id", flat=True)

        count = 0
        for pid in patients:
            compute_risk_score.delay(str(pid), trigger="NIGHTLY_BATCH")
            count += 1

        logger.info(f"Batch risk scoring queued for {count} patients")
        return {"patients_queued": count}

    except Exception as exc:
        logger.error(f"Batch risk scoring failed: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    name="ai_engine.generate_insights_for_patient",
    max_retries=2,
)
def generate_insights_for_patient(self, patient_id: str):
    """
    Generate and persist AI insights for a single patient.
    Called after risk score computation for HIGH/CRITICAL patients.
    """
    try:
        from apps.ai_engine.services.risk_engine import RiskEngine
        from apps.ai_engine.models import AIInsight
        from datetime import datetime, timedelta, timezone

        insights = RiskEngine.generate_insights(patient_id)
        if not insights:
            return {"insights_generated": 0}

        # Expire old unread insights
        AIInsight.objects.filter(
            patient_id=patient_id,
            is_read=False,
        ).update(expires_at=datetime.now(timezone.utc))

        # Persist new insights
        records = []
        for ins in insights:
            records.append(
                AIInsight(
                    patient_id=patient_id,
                    insight_type=ins["type"],
                    title=ins["title"],
                    body=ins["body"],
                    data=ins.get("action_data", {}),
                    expires_at=datetime.now(timezone.utc) + timedelta(days=7),
                )
            )
        AIInsight.objects.bulk_create(records)

        logger.info(f"Generated {len(records)} insights for patient {patient_id}")
        return {"insights_generated": len(records)}

    except Exception as exc:
        logger.error(f"Insight generation task failed for {patient_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    name="ai_engine.generate_recommendations_for_patient",
    max_retries=2,
)
def generate_recommendations_for_patient(self, patient_id: str):
    """Generate and persist AI recommendations for a patient."""
    try:
        from apps.ai_engine.services.risk_engine import RiskEngine
        from apps.ai_engine.models import AIRecommendation
        from datetime import datetime, timedelta, timezone

        recs = RiskEngine.generate_recommendations(patient_id)
        if not recs:
            return {"recommendations_generated": 0}

        records = []
        for r in recs:
            records.append(
                AIRecommendation(
                    patient_id=patient_id,
                    recommendation_type=r["type"],
                    priority=r["priority"],
                    title=r["title"],
                    message=r["message"],
                    action_data=r.get("action_data"),
                    target_audience=r.get("target_audience", "patient"),
                    evidence=r.get("evidence"),
                    expires_at=datetime.now(timezone.utc) + timedelta(days=14),
                )
            )
        AIRecommendation.objects.bulk_create(records)

        logger.info(f"Generated {len(records)} recommendations for patient {patient_id}")
        return {"recommendations_generated": len(records)}

    except Exception as exc:
        logger.error(f"Recommendation task failed for {patient_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(
    name="ai_engine.retrain_model",
    soft_time_limit=7200,  # 2 hours
)
def retrain_model(model_version: str, triggered_by_user_id: str = None):
    """
    Retrain the ML model with latest data.
    Triggered by POST /ai/retrain (admin only).
    """
    logger.info(f"Model retraining triggered: v{model_version} by user {triggered_by_user_id}")
    try:
        from apps.ai_engine.services.training import TrainingConfig, train_model
        from apps.ai_engine.services.training import load_model

        config = TrainingConfig(model_version=model_version)
        result = train_model(config=config)

        # Reload model in memory
        from apps.ai_engine.services.inference import InferenceService
        InferenceService._model_payload = load_model(version=result.model_version)
        InferenceService._model_version = result.model_version

        logger.info(f"Model v{model_version} trained and deployed. AUC={result.auc_roc}")
        return {
            "model_version": result.model_version,
            "auc_roc": result.auc_roc,
            "f1_score": result.f1_score,
            "trained_at": result.trained_at,
        }

    except Exception as exc:
        logger.error(f"Model retraining failed: {exc}")
        return {"error": str(exc), "model_version": model_version}


@shared_task(name="ai_engine._notify_agents_high_risk")
def _notify_agents_high_risk(patient_id: str, risk_result: dict, trace_id: str = None):
    """
    Internal task: notify backend agents when high/critical risk detected.
    Uses the orchestrator broadcast pattern.

    NOTE: agenthandover is part of the main backend repo, not this standalone
    module. The import is guarded so this task degrades gracefully when running
    the ai_engine in isolation (e.g. during standalone training or testing).
    """
    try:
        from agenthandover import (  # noqa: PLC0415 — intentional conditional import
            AgentName,
            AgentEvent,
            HandoverPayload,
            orchestrator,
        )

        lang = _get_patient_language(patient_id)
        payload = HandoverPayload(
            patient_id=patient_id,
            data={
                "risk_level": risk_result.get("risk_level"),
                "risk_score": risk_result.get("risk_score"),
                "reasons": risk_result.get("reasons", []),
                "language_preference": lang,
            },
        )
        orchestrator.broadcast(AgentName.AI, AgentEvent.HIGH_RISK_DETECTED, payload)
        logger.info(f"[{trace_id}] High risk broadcast sent for patient {patient_id}")

    except ImportError:
        # agenthandover is not installed — expected when running ai_engine standalone
        logger.warning(
            f"[{trace_id}] agenthandover not available — HIGH_RISK_DETECTED broadcast "
            f"skipped for patient {patient_id}. This is normal in standalone/test mode."
        )
    except Exception as e:
        # Never fail silently on agent notification — but also never crash
        logger.error(f"Agent notification failed for {patient_id}: {e}")
