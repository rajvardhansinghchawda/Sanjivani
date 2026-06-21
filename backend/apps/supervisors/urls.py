# apps/supervisors/urls.py
from django.urls import path
from .views import (
    SupervisorDashboardView, AlertSummaryView,
    AlertListCreateView, AlertDetailView,
    ResolveAlertView, HospitalAlertsView,
    LongOccupancyMonitorView,
    ResourceAvailabilityListView, LatestResourceStatusView,
    PendingVerificationsView, TriggerChecksView,
      SupervisorBedCorrectionView,
    SupervisorPatientCorrectionView,
    SupervisorAllocationCorrectionView,
)

urlpatterns = [

    # ── dashboard ─────────────────────────────────────────────
    path('dashboard/',                               SupervisorDashboardView.as_view(),      name='supervisor-dashboard'),
    path('alerts/summary/',                          AlertSummaryView.as_view(),              name='alert-summary'),

    # ── alerts ────────────────────────────────────────────────
    path('alerts/',                                  AlertListCreateView.as_view(),           name='alert-list'),
    path('alerts/<uuid:pk>/',                        AlertDetailView.as_view(),               name='alert-detail'),
    path('alerts/<uuid:pk>/resolve/',                ResolveAlertView.as_view(),              name='alert-resolve'),
    path('alerts/hospital/<uuid:hospital_id>/',      HospitalAlertsView.as_view(),            name='hospital-alerts'),

    # ── monitoring ────────────────────────────────────────────
    path('long-occupancy/',                          LongOccupancyMonitorView.as_view(),      name='long-occupancy-monitor'),

    # ── resource availability ─────────────────────────────────
    path('resources/',                               ResourceAvailabilityListView.as_view(),  name='resource-availability'),
    path('resources/latest/<uuid:hospital_id>/',     LatestResourceStatusView.as_view(),      name='resource-latest'),

    # ── verification ──────────────────────────────────────────
    path('verifications/pending/',                   PendingVerificationsView.as_view(),      name='pending-verifications'),

    # ── manual task trigger ───────────────────────────────────
    path('run-checks/',                              TriggerChecksView.as_view(),             name='trigger-checks'),

path('correct/bed/<uuid:bed_id>/',               SupervisorBedCorrectionView.as_view(),        name='supervisor-correct-bed'),
path('correct/patient/<uuid:patient_id>/',        SupervisorPatientCorrectionView.as_view(),    name='supervisor-correct-patient'),
path('correct/allocation/<uuid:allocation_id>/',  SupervisorAllocationCorrectionView.as_view(), name='supervisor-correct-allocation'),
]