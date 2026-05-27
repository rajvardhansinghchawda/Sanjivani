"""
AI Engine URL Configuration
"""
from django.urls import path
from apps.ai_engine.api.views import (
    RiskScoreView,
    InsightsView,
    RecommendationsView,
    RetrainView,
    ModelRegistryView,
    AIHealthView,
)

app_name = "ai_engine"

urlpatterns = [
    # Patient/caregiver-facing
    path("risk-score/<str:patient_id>/", RiskScoreView.as_view(), name="risk_score"),
    path("insights/<str:patient_id>/", InsightsView.as_view(), name="insights"),
    path("recommendations/<str:patient_id>/", RecommendationsView.as_view(), name="recommendations"),

    # Admin
    path("retrain/", RetrainView.as_view(), name="retrain"),
    path("models/", ModelRegistryView.as_view(), name="model_registry"),

    # Internal
    path("health/", AIHealthView.as_view(), name="health"),
]
