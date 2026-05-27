"""
apps/scheduling/urls/adherence.py
"""
from django.urls import path
from ..views.reminders import ManualDoseView
from ..views.adherence import (
    AdherenceSummaryView, AdherenceTimelineView,
    AdherenceMedicationBreakdownView, DoseHistoryView,
    DoseLogDetailView, AdherenceReportExportView,
)

urlpatterns = [
    path('summary/',              AdherenceSummaryView.as_view(),              name='adherence-summary'),
    path('timeline/',             AdherenceTimelineView.as_view(),             name='adherence-timeline'),
    path('medications/',          AdherenceMedicationBreakdownView.as_view(),  name='adherence-medications'),
    path('history/',              DoseHistoryView.as_view(),                   name='dose-history'),
    path('history/<uuid:log_id>/', DoseLogDetailView.as_view(),               name='dose-log-detail'),
    path('export/',               AdherenceReportExportView.as_view(),         name='adherence-export'),
    path('manual/',               ManualDoseView.as_view(),                    name='dose-manual'),
]
