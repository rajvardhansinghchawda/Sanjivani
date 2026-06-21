# apps/triage/urls.py

from django.urls import path
from . import views
from .views import EmergencyCaseDetailView

urlpatterns = [
    # ── Original endpoint (backward compatible) ───────────────────────────────
    path('analyze/', views.symptom_analysis_view, name='triage-analyze'),

    # ── NEW: Full AI pipeline (triage + profile + routing) ───────────────────
    path('unified-analyze/', views.unified_analysis_view, name='triage-unified-analyze'),

    # ── NEW: Create and persist emergency case ────────────────────────────────
    path('create-emergency/', views.create_emergency_case_view, name='triage-create-emergency'),

    # ── NEW: Case management ──────────────────────────────────────────────────
    path('cases/', views.EmergencyCaseListView.as_view(), name='triage-cases-list'),
    path('cases/<str:case_id>/', EmergencyCaseDetailView.as_view(), name='triage-case-detail'),
    path('cases/flagged/', views.FlaggedCaseListView.as_view(), name='triage-cases-flagged'),
    path('cases/<str:case_id>/outcome/', views.CaseOutcomeView.as_view(), name='triage-case-outcome'),
    path('cases/<str:case_id>/driver-event/', views.DriverEventView.as_view(), name='triage-driver-event'),
]
