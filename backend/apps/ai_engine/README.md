# 🧠 MedAdhere — AI Engine (`apps/ai_engine`)

Production-grade AI/ML module for medication adherence risk prediction, behavioral pattern detection, insight generation, and personalized recommendations.

---

## Architecture Overview

```
apps/ai_engine/
├── models/
│   └── __init__.py          # ORM models: PatientRiskScore, AIInsight, AIRecommendation, AIModelRegistry
├── services/
│   ├── __init__.py          # Public interface: from apps.ai_engine.services import RiskEngine
│   ├── risk_engine.py       # PUBLIC API — all agents call this
│   ├── feature_engineering.py  # Feature computation (training + inference shared)
│   ├── inference.py         # ML inference + circuit breaker
│   ├── training.py          # XGBoost training pipeline
│   ├── fallback.py          # Rule-based fallback (always available)
│   ├── insight_engine.py    # Human-readable insight generation
│   └── recommendation_engine.py  # (inside insight_engine.py)
├── datasets/
│   └── generator.py         # Synthetic data generator (10k patients, 90 days)
├── tasks/
│   └── __init__.py          # Celery tasks (async inference, batch scoring, retrain)
├── api/
│   ├── __init__.py          # URL routes
│   ├── views.py             # DRF views
│   └── serializers.py       # DRF serializers
├── configs/
│   └── __init__.py          # Environment-sourced config
├── migrations/
│   ├── __init__.py
│   └── 0001_initial.py      # DB migration
├── tests/
│   └── __init__.py          # Unit tests
├── pipelines/
│   └── management/
│       └── __init__.py      # ai_train management command
├── apps.py                  # AppConfig + warmup
├── __init__.py
├── requirements.txt
└── README.md
```

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r apps/ai_engine/requirements.txt
```

### 2. Add to Django settings

```python
# config/settings/base.py

INSTALLED_APPS = [
    ...
    "apps.ai_engine",
]
```

### 3. Add to URL router

```python
# config/urls.py

urlpatterns = [
    ...
    path("api/v1/ai/", include("apps.ai_engine.api", namespace="ai_engine")),
]
```

### 4. Run migrations

```bash
python manage.py migrate ai_engine
```

### 5. Generate synthetic training data + train model

```bash
# Option A: Management command (recommended)
python manage.py ai_train --model-version 1.0.0 --generate-data

# Option B: Standalone script
python -m apps.ai_engine.datasets.generator --patients 10000 --days 90
python -m apps.ai_engine.services.training 1.0.0
```

---

## Integration — How Other Agents Use the AI Engine

The only import other modules need:

```python
from apps.ai_engine.services import RiskEngine

# Get risk score (always returns a result, never raises)
result = RiskEngine.get_risk_score(patient_id="<uuid>")
# Returns:
# {
#   "patient_id": "...",
#   "risk_score": 0.7234,
#   "risk_level": "high",
#   "confidence": 0.82,
#   "reasons": ["Missed 4 doses this week", "Evening adherence is low"],
#   "source": "ML_MODEL",
#   "is_advisory_only": true,
#   "model_version": "1.0.0",
#   "computed_at": "2024-01-15T02:30:00Z"
# }

# Quick risk level check (ultra-fast, no ML needed)
level = RiskEngine.get_risk_level(patient_id)  # "low" | "medium" | "high" | "critical"

# Check if high risk (convenience predicate for escalation)
if RiskEngine.is_high_risk(patient_id):
    # Trigger caregiver alert
    ...

# Get insights
insights = RiskEngine.generate_insights(patient_id)

# Get recommendations
recs = RiskEngine.generate_recommendations(patient_id)
```

### Integration with AgentHandover

```python
# In AdherenceAgent, after dose logged (PREMIUM tier):
from apps.ai_engine.tasks import compute_risk_score

def trigger_realtime_risk_update(self, payload: HandoverPayload) -> dict:
    compute_risk_score.delay(
        patient_id=payload.patient_id,
        trigger="DOSE_EVENT",
        trace_id=payload.trace_id,
    )
    return {"queued": True}
```

---

## API Endpoints

| Method | Endpoint | Auth | Plan |
|--------|----------|------|------|
| GET | `/api/v1/ai/risk-score/{patient_id}/` | JWT | FREEMIUM+ |
| GET | `/api/v1/ai/insights/{patient_id}/` | JWT | FREEMIUM+ |
| GET | `/api/v1/ai/recommendations/{patient_id}/` | JWT | PREMIUM |
| POST | `/api/v1/ai/retrain/` | JWT (ADMIN) | ADMIN |
| GET | `/api/v1/ai/models/` | JWT (ADMIN) | ADMIN |
| GET | `/api/v1/ai/health/` | None | All |

### Example API Responses

**GET /api/v1/ai/risk-score/{patient_id}/**
```json
{
  "success": true,
  "data": {
    "patient_id": "3f4a8b21-...",
    "risk_score": 0.7234,
    "risk_level": "high",
    "confidence": 0.82,
    "reasons": [
      "7-day adherence rate is increasing risk",
      "Recent missed doses are increasing risk",
      "Evening dose timing is increasing risk"
    ],
    "source": "ML_MODEL",
    "is_advisory_only": true,
    "model_version": "1.0.0",
    "computed_at": "2024-01-15T02:30:00Z"
  }
}
```

**GET /api/v1/ai/insights/{patient_id}/**
```json
{
  "success": true,
  "data": [
    {
      "type": "WEEKEND_PATTERN",
      "title": "Weekend Adherence Pattern Detected",
      "body": "You miss 62% of your doses on weekends. Consider setting extra reminders on Saturday and Sunday.",
      "priority": "medium"
    },
    {
      "type": "RISK_WARNING",
      "title": "Low Weekly Adherence",
      "body": "You've only taken 58% of your scheduled doses this week. Please reach out to your care team.",
      "priority": "high"
    }
  ],
  "count": 2
}
```

**POST /api/v1/ai/retrain/**
```json
// Request
{ "model_version": "1.1.0" }

// Response
{
  "success": true,
  "data": {
    "task_id": "abc123-celery-task-id",
    "model_version": "1.1.0",
    "status": "queued"
  }
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MODEL_DIR` | `apps/ai_engine/models/artifacts` | Model artifact storage path |
| `AI_DATA_DIR` | `apps/ai_engine/datasets/raw` | Training data path |
| `AI_INFERENCE_TIMEOUT` | `30` | Max inference seconds |
| `AI_CIRCUIT_BREAKER_THRESHOLD` | `5` | Failures before circuit opens |
| `AI_CIRCUIT_RECOVERY_TIMEOUT` | `120` | Seconds before half-open retry |
| `AI_RISK_SCORE_TTL_HOURS` | `24` | Risk score cache validity |
| `AI_SYNTHETIC_PATIENTS` | `10000` | Default synthetic dataset size |
| `AI_REALTIME_ENABLED` | `true` | Enable real-time inference for PREMIUM |
| `AI_SHAP_ENABLED` | `true` | Enable SHAP explainability |

---

## Model Versioning & Rollback

Models are saved with semantic version tags:

```
apps/ai_engine/models/artifacts/
├── adherence_risk_xgb_v1.0.0.pkl
├── adherence_risk_xgb_v1.0.0_meta.json
├── adherence_risk_xgb_v1.1.0.pkl
└── adherence_risk_xgb_v1.1.0_meta.json
```

**To rollback to a previous version:**

```python
# 1. Update DB record
from apps.ai_engine.models import AIModelRegistry
AIModelRegistry.objects.filter(is_active=True).update(is_active=False)
AIModelRegistry.objects.filter(model_version="1.0.0").update(is_active=True)

# 2. Reset in-memory model
from apps.ai_engine.services.inference import InferenceService
InferenceService._model_payload = None
InferenceService.warmup()
```

---

## Running Tests

```bash
# Django test runner
python manage.py test apps.ai_engine.tests -v 2

# pytest (if configured)
pytest apps/ai_engine/tests/ -v --tb=short

# Run only fallback tests
pytest apps/ai_engine/tests/ -v -k "Fallback"
```

---

## Celery Beat Schedule

Add to your `CELERYBEAT_SCHEDULE`:

```python
from apps.ai_engine.configs import AI_CELERY_BEAT_SCHEDULE
CELERYBEAT_SCHEDULE.update(AI_CELERY_BEAT_SCHEDULE)
```

This registers: **nightly batch scoring** at 02:00 UTC.

---

## Design Principles

1. **AI never blocks core functionality** — reminders and dose logging work without AI
2. **Circuit breaker pattern** — automatic fallback to rules when ML fails
3. **Always advisory** — `is_advisory_only = True` is hardcoded and non-editable
4. **Explainable outputs** — SHAP values for every ML prediction
5. **Subscription-gated** — FREE uses rules, FREEMIUM uses weekly batch, PREMIUM uses real-time
6. **Plug-and-play** — remove `apps.ai_engine` from `INSTALLED_APPS` and nothing breaks

---

## Feature Engineering Reference

| Feature | Description | Risk Impact |
|---------|-------------|-------------|
| `adherence_rate_7d` | % doses taken in last 7 days | ↑ rate = ↓ risk |
| `adherence_rate_30d` | % doses taken in last 30 days | Baseline context |
| `missed_count_7d` | Raw miss count this week | Direct risk signal |
| `consecutive_miss_streak` | Current run of consecutive misses | Strong escalation signal |
| `weekend_miss_ratio` | Miss rate on Sat/Sun | Schedule optimization signal |
| `evening_miss_ratio` | Miss rate for doses ≥18:00 | Time optimization signal |
| `avg_delay_minutes` | Average minutes late when taken | Timing precision signal |
| `current_streak_days` | Days since last miss (positive) | Protective factor |
| `doses_per_day` | Total daily dose count | Complexity risk factor |
| `is_cognitively_impaired` | Patient has cognitive impairment | High-weight risk factor |
| `adherence_trend_delta` | 7d rate minus 30d rate | Trend direction |
| `refill_days_late` | Days late on last pharmacy refill | Supply continuity risk |

---

*MedAdhere AI Engine — Production Ready*
*Stack: XGBoost · scikit-learn · SHAP · Django · Celery*
