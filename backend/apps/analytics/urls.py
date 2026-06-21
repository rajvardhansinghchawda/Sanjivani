# apps/analytics/urls.py
from django.urls import path
from .views import (
    PlatformDashboardView,
    BedUtilisationView, BedOccupancyTrendView,
    AdmissionReportView,
    TransferAnalysisView,
    HospitalPerformanceView,
    AmbulanceAnalyticsView,
    ServiceUtilisationView,
    AlertAnalyticsView,
    MyHospitalReportView,
)

urlpatterns = [

    # ── admin platform-wide ───────────────────────────────────
    path('dashboard/',                 PlatformDashboardView.as_view(),    name='platform-dashboard'),
    path('beds/utilisation/',          BedUtilisationView.as_view(),       name='bed-utilisation'),
    path('beds/trend/',                BedOccupancyTrendView.as_view(),    name='bed-trend'),
    path('admissions/',                AdmissionReportView.as_view(),      name='admission-report'),
    path('transfers/',                 TransferAnalysisView.as_view(),     name='transfer-analysis'),
    path('hospitals/performance/',     HospitalPerformanceView.as_view(),  name='hospital-performance'),
    path('ambulances/',                AmbulanceAnalyticsView.as_view(),   name='ambulance-analytics'),
    path('services/',                  ServiceUtilisationView.as_view(),   name='service-utilisation'),
    path('alerts/',                    AlertAnalyticsView.as_view(),       name='alert-analytics'),

    # ── staff — their own hospital only ──────────────────────
    path('my-hospital/',               MyHospitalReportView.as_view(),     name='my-hospital-report'),
]