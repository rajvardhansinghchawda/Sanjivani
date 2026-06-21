# apps/ambulances/urls.py
from django.urls import path
from .views import (
    AvailableAmbulancesView, BookAmbulanceView,
    TrackAmbulanceView, RateAmbulanceView,
    DriverDashboardView, DriverSetAvailabilityView,
    DriverUpdateLocationView, DriverTripActionView,
    DriverTripHistoryView,
    AmbulanceListCreateView, AmbulanceDetailView,
    AllRequestsView,ReceptionAmbulanceStatusView,
)

urlpatterns = [

    # ── public (no login) ─────────────────────────────────────
    path('available/',                          AvailableAmbulancesView.as_view(),    name='ambulance-available'),
    path('book/',                               BookAmbulanceView.as_view(),          name='ambulance-book'),
    path('track/<uuid:pk>/',                    TrackAmbulanceView.as_view(),         name='ambulance-track'),
    path('rate/<uuid:pk>/',                     RateAmbulanceView.as_view(),          name='ambulance-rate'),

    # ── driver portal ─────────────────────────────────────────
    path('driver/dashboard/',                   DriverDashboardView.as_view(),        name='driver-dashboard'),
    path('driver/availability/',                DriverSetAvailabilityView.as_view(),  name='driver-availability'),
    path('driver/location/',                    DriverUpdateLocationView.as_view(),   name='driver-location'),
    path('driver/trip/<uuid:pk>/action/',       DriverTripActionView.as_view(),       name='driver-trip-action'),
    path('driver/trips/',                       DriverTripHistoryView.as_view(),      name='driver-trips'),

    # ── admin / staff ─────────────────────────────────────────
    path('manage/',                             AmbulanceListCreateView.as_view(),    name='ambulance-manage'),
    path('manage/<uuid:pk>/',                   AmbulanceDetailView.as_view(),        name='ambulance-detail'),
    path('requests/',                           AllRequestsView.as_view(),            name='ambulance-requests'),
    path('<uuid:pk>/status/', ReceptionAmbulanceStatusView.as_view(), name='ambulance-status-update'),

]