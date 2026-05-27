"""
AI Engine Configuration
========================
All config values sourced from environment variables.
No hardcoded values — safe for production deployment.
"""

import os


class AIEngineConfig:
    # Model artifacts location
    MODEL_DIR = os.environ.get("AI_MODEL_DIR", "apps/ai_engine/models/artifacts")

    # Training data location
    DATA_DIR = os.environ.get("AI_DATA_DIR", "apps/ai_engine/datasets/raw")

    # Inference settings
    INFERENCE_TIMEOUT_SECONDS = int(os.environ.get("AI_INFERENCE_TIMEOUT", "30"))
    CIRCUIT_BREAKER_THRESHOLD = int(os.environ.get("AI_CIRCUIT_BREAKER_THRESHOLD", "5"))
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT = int(os.environ.get("AI_CIRCUIT_RECOVERY_TIMEOUT", "120"))

    # Risk score cache TTL (hours)
    RISK_SCORE_TTL_HOURS = int(os.environ.get("AI_RISK_SCORE_TTL_HOURS", "24"))

    # Batch job settings
    BATCH_CHUNK_SIZE = int(os.environ.get("AI_BATCH_CHUNK_SIZE", "500"))

    # Model training defaults
    DEFAULT_MODEL_VERSION = os.environ.get("AI_DEFAULT_MODEL_VERSION", "1.0.0")
    SYNTHETIC_PATIENTS = int(os.environ.get("AI_SYNTHETIC_PATIENTS", "10000"))
    SYNTHETIC_DAYS = int(os.environ.get("AI_SYNTHETIC_DAYS", "90"))

    # Subscription-based feature limits
    INSIGHTS_LIMIT_FREE = 0
    INSIGHTS_LIMIT_FREEMIUM = 3
    INSIGHTS_LIMIT_PREMIUM = 10

    # Risk thresholds (for rule-based fallback)
    RISK_THRESHOLD_HIGH = float(os.environ.get("AI_RISK_THRESHOLD_HIGH", "0.55"))
    RISK_THRESHOLD_CRITICAL = float(os.environ.get("AI_RISK_THRESHOLD_CRITICAL", "0.75"))

    # Feature flags
    REALTIME_INFERENCE_ENABLED = os.environ.get("AI_REALTIME_ENABLED", "true").lower() == "true"
    SHAP_ENABLED = os.environ.get("AI_SHAP_ENABLED", "true").lower() == "true"


# Celery Beat schedule for AI jobs
AI_CELERY_BEAT_SCHEDULE = {
    "ai-nightly-batch-scoring": {
        "task": "ai_engine.batch_risk_score_all",
        "schedule": "0 2 * * *",  # 02:00 UTC daily
    },
}
