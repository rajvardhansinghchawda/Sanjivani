"""
AI Engine API Views
====================
REST endpoints for AI features.

All endpoints:
  - Require authentication (JWT)
  - Are subscription-gated where applicable
  - Return structured JSON (never raise unhandled errors)
  - Are read-only for patients; admin can trigger retraining

Endpoints:
  GET  /api/v1/ai/risk-score/{patient_id}/
  GET  /api/v1/ai/insights/{patient_id}/
  GET  /api/v1/ai/recommendations/{patient_id}/
  POST /api/v1/ai/retrain/                     (ADMIN only)
  GET  /api/v1/ai/models/                      (ADMIN only)
  GET  /api/v1/ai/health/                      (internal health check)
"""

import logging

from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger("medadhere.ai_engine.api")


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------


class HasPatientAccess(BasePermission):
    """
    Custom permission: user can only access AI data for themselves,
    or patients they are linked to as an active caregiver, or if admin.
    """
    message = "Access denied — not authorized for this patient's AI data."

    def has_permission(self, request, view):
        patient_id = view.kwargs.get("patient_id")
        if not patient_id:
            return True

        try:
            user = request.user
            if patient_id == "me":
                if hasattr(user, "patient_profile"):
                    patient_id = str(user.patient_profile.id)
                    view.kwargs["patient_id"] = patient_id
                else:
                    logger.warning(f"[PERMISSION] User {user.id} requested 'me' but has no patient_profile")
                    return False

            logger.warning(f"[PERMISSION] Checking access for user={user.id}, patient_id={patient_id}")
            logger.warning(f"[PERMISSION] user.is_authenticated={user.is_authenticated}")

            # Resolve patient by URL id and validate ownership via user FK.
            from apps.clinical.models import Patient
            patient = Patient.objects.filter(id=patient_id, deleted_at__isnull=True).only("id", "user_id").first()
            if patient and str(patient.user_id) == str(user.id):
                logger.warning("[PERMISSION] ALLOWED - patient owns this profile")
                return True

            # Fallback: some relations/managers may expose patient via user.patient_profile
            if hasattr(user, 'patient_profile'):
                try:
                    profile_id = str(user.patient_profile.id)
                    logger.warning(f"[PERMISSION] fallback user.patient_profile.id={profile_id}")
                    if profile_id == str(patient_id):
                        logger.warning("[PERMISSION] ALLOWED - fallback patient_profile matches")
                        return True
                except Exception:
                    logger.warning("[PERMISSION] fallback patient_profile access failed")
            
            is_admin = _is_admin(user)
            logger.warning(f"[PERMISSION] is_admin={is_admin}")
            if is_admin:
                logger.warning("[PERMISSION] ALLOWED - user is admin")
                return True

            from apps.clinical.models import PatientCaregiverLink
            caregiver_match = PatientCaregiverLink.objects.filter(
                patient_id=patient_id,
                caregiver__user=user,
                is_active=True,
                deleted_at__isnull=True,
            ).exists()
            logger.warning(f"[PERMISSION] caregiver_match={caregiver_match}")
            if caregiver_match:
                logger.warning("[PERMISSION] ALLOWED - caregiver link exists")
            else:
                logger.warning("[PERMISSION] DENIED - no valid access")
            return caregiver_match
        except Exception as e:
            logger.error(f"[PERMISSION] Exception: {e}", exc_info=True)
            return False


# ---------------------------------------------------------------------------
# Risk Score
# ---------------------------------------------------------------------------


class RiskScoreView(APIView):
    """
    GET /api/v1/ai/risk-score/{patient_id}/

    Returns current risk score for a patient.
    - PREMIUM: real-time (may trigger fresh inference)
    - FREEMIUM: cached weekly score
    - FREE: rule-based fallback only
    - CAREGIVER: can view scores for linked patients
    """

    permission_classes = [IsAuthenticated, HasPatientAccess]

    def get(self, request, patient_id: str):
        # Subscription check
        plan = _get_user_plan(request.user)
        force_refresh = request.query_params.get("refresh", "false").lower() == "true"
        lang = getattr(request.user, "preferred_language", "en")

        # FREE users get rule-based only
        if plan == "free":
            return self._rule_based_response(patient_id, lang)

        # PREMIUM: allow force refresh
        if plan != "premium":
            force_refresh = False

        try:
            from apps.ai_engine.services.risk_engine import RiskEngine
            from apps.ai_engine.services.translation import TranslationService
            
            result = RiskEngine.get_risk_score(patient_id, force_refresh=force_refresh)
            
            if lang != "en" and result.get("reasons"):
                result["reasons"] = TranslationService.batch_translate(result["reasons"], lang)

            return Response(
                {
                    "success": True,
                    "data": {
                        **result,
                        "plan_note": _plan_note(plan),
                    },
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"RiskScoreView failed: {e}")
            return Response(
                {"success": False, "error": "Risk assessment temporarily unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def _rule_based_response(self, patient_id: str, lang: str):
        """Rule-based response for FREE tier."""
        try:
            from apps.ai_engine.services.risk_engine import _get_quick_stats
            from apps.ai_engine.services.fallback import quick_assess

            missed_7d, adherence_7d = _get_quick_stats(patient_id)
            level = quick_assess(missed_7d=missed_7d, missed_30d=0, adherence_7d=adherence_7d)

            return Response(
                {
                    "success": True,
                    "data": {
                        "patient_id": patient_id,
                        "risk_level": level,
                        "risk_score": None,
                        "source": "RULE_BASED",
                        "is_advisory_only": True,
                        "plan_note": "Upgrade to Freemium or Premium for AI-powered risk scores with explanations.",
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Rule-based fallback in view failed: {e}")
            from apps.ai_engine.services.translation import TranslationService
            reasons = ["Risk assessment temporarily unavailable"]
            if lang != "en":
                reasons = TranslationService.batch_translate(reasons, lang)
            return Response(
                {"success": True, "data": {"patient_id": patient_id, "risk_level": "medium", "reasons": reasons, "source": "UNAVAILABLE"}},
                status=status.HTTP_200_OK,
            )


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------


class InsightsView(APIView):
    """
    GET /api/v1/ai/insights/{patient_id}/

    Returns AI-generated insights for a patient.
    FREEMIUM: up to 3 insights (latest)
    PREMIUM: up to 10 insights
    FREE: no insights (upgrade prompt)
    """

    permission_classes = [IsAuthenticated, HasPatientAccess]

    def get(self, request, patient_id: str):
        plan = _get_user_plan(request.user)
        lang = getattr(request.user, "preferred_language", "en")

        if plan == "free":
            return Response(
                {
                    "success": True,
                    "data": [],
                    "plan_note": "AI insights are available on Freemium and Premium plans.",
                    "upgrade_url": "/api/v1/subscriptions/upgrade/",
                },
                status=status.HTTP_200_OK,
            )

        limit = 3 if plan == "freemium" else 10

        try:
            # First try DB (persisted insights)
            from apps.ai_engine.models import AIInsight
            from django.utils import timezone

            db_insights = AIInsight.objects.filter(
                patient_id=patient_id,
                expires_at__gt=timezone.now(),
            ).order_by("-generated_at")[:limit]

            if db_insights.exists():
                from apps.ai_engine.services.translation import TranslationService
                
                titles = [i.title for i in db_insights]
                bodies = [i.body for i in db_insights]
                
                if lang != "en":
                    titles = TranslationService.batch_translate(titles, lang)
                    bodies = TranslationService.batch_translate(bodies, lang)
                    
                data = [
                    {
                        "id": str(db_insights[idx].id),
                        "type": db_insights[idx].insight_type,
                        "title": titles[idx],
                        "body": bodies[idx],
                        "generated_at": db_insights[idx].generated_at.isoformat(),
                        "is_read": db_insights[idx].is_read,
                    }
                    for idx in range(len(db_insights))
                ]
            else:
                # Generate fresh
                from apps.ai_engine.services.risk_engine import RiskEngine
                fresh = RiskEngine.generate_insights(patient_id, lang)
                data = fresh[:limit]

            return Response(
                {"success": True, "data": data, "count": len(data)},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"InsightsView failed for {patient_id}: {e}")
            return Response(
                {"success": False, "error": "Insights temporarily unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------


class RecommendationsView(APIView):
    """
    GET /api/v1/ai/recommendations/{patient_id}/

    Returns actionable AI recommendations.
    PREMIUM only (basic recommendations for FREEMIUM).
    """

    permission_classes = [IsAuthenticated, HasPatientAccess]

    def get(self, request, patient_id: str):
        plan = _get_user_plan(request.user)
        lang = getattr(request.user, "preferred_language", "en")

        try:
            from apps.ai_engine.services.risk_engine import RiskEngine
            recs = RiskEngine.generate_recommendations(patient_id, lang)

            # FREEMIUM gets lower-priority recs only
            if plan == "freemium":
                recs = [r for r in recs if r.get("priority") != "high"][:2]
            elif plan == "free":
                recs = []

            return Response(
                {
                    "success": True,
                    "data": recs,
                    "count": len(recs),
                    "plan_note": _plan_note(plan) if plan != "premium" else None,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"RecommendationsView failed for {patient_id}: {e}")
            return Response({"success": True, "data": [], "count": 0}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Admin: Retrain
# ---------------------------------------------------------------------------


class RetrainView(APIView):
    """
    POST /api/v1/ai/retrain/

    Triggers async model retraining. ADMIN only.
    Body: { "model_version": "1.1.0" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Admin check
        if not _is_admin(request.user):
            return Response(
                {"success": False, "error": "Admin access required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        model_version = request.data.get("model_version")
        if not model_version:
            return Response(
                {"success": False, "error": "model_version is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.ai_engine.tasks import retrain_model
            task = retrain_model.delay(
                model_version=model_version,
                triggered_by_user_id=str(request.user.id),
            )
            return Response(
                {
                    "success": True,
                    "data": {
                        "task_id": task.id,
                        "model_version": model_version,
                        "status": "queued",
                        "message": f"Model v{model_version} training started. Check task status via Celery.",
                    },
                },
                status=status.HTTP_202_ACCEPTED,
            )
        except Exception as e:
            logger.error(f"Retrain trigger failed: {e}")
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ---------------------------------------------------------------------------
# Admin: Model Registry
# ---------------------------------------------------------------------------


class ModelRegistryView(APIView):
    """
    GET /api/v1/ai/models/
    Returns list of trained model versions. ADMIN only.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_admin(request.user):
            return Response({"success": False, "error": "Admin access required"}, status=403)

        try:
            from apps.ai_engine.models import AIModelRegistry
            models = AIModelRegistry.objects.all().order_by("-created_at")[:20]
            data = [
                {
                    "id": str(m.id),
                    "model_name": m.model_name,
                    "model_version": m.model_version,
                    "algorithm_type": m.algorithm_type,
                    "is_active": m.is_active,
                    "auc_roc": float(m.auc_roc) if m.auc_roc else None,
                    "f1_score": float(m.f1_score) if m.f1_score else None,
                    "training_dataset_size": m.training_dataset_size,
                    "deployed_at": m.deployed_at.isoformat() if m.deployed_at else None,
                }
                for m in models
            ]
            return Response({"success": True, "data": data}, status=200)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=500)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class AIHealthView(APIView):
    """
    GET /api/v1/ai/health/
    Internal health check. No auth required.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from apps.ai_engine.services.inference import InferenceService

        circuit_state = InferenceService._circuit_breaker.state
        model_loaded = InferenceService._model_payload is not None

        return Response(
            {
                "status": "ok",
                "model_loaded": model_loaded,
                "model_version": InferenceService._model_version,
                "circuit_breaker": circuit_state,
                "inference_available": circuit_state in ("CLOSED", "HALF_OPEN"),
                "fallback_available": True,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------





def _get_user_plan(user) -> str:
    """Returns plan slug: free | freemium | premium. Safe default: free."""
    try:
        return user.subscription.plan.slug
    except Exception:
        return "free"


def _is_admin(user) -> bool:
    try:
        return user.role in ("ADMIN", "SUPER_ADMIN")
    except Exception:
        return False


def _plan_note(plan: str) -> str:
    if plan == "freemium":
        return "Upgrade to Premium for real-time AI scoring and full explanations."
    if plan == "free":
        return "Upgrade to Freemium or Premium to unlock AI features."
    return None
