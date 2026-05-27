"""
apps/analytics/urls.py
"""
from django.urls import path
from ..views import (
    CaregiverDashboardSummaryView, CaregiverPatientCohortView
)

urlpatterns = [
    path('caregiver/summary/', CaregiverDashboardSummaryView.as_view(), name='analytics-caregiver-summary'),
    path('caregiver/cohort/',  CaregiverPatientCohortView.as_view(),    name='analytics-caregiver-cohort'),
]
