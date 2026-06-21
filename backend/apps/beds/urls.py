# apps/beds/urls.py
from django.urls import path
from .views import (
    BedTypesListView,
    BedAvailabilityView, DepartmentBedAvailabilityView,
    BedListCreateView, BedDetailView, BulkBedStatusUpdateView,
    AdmitPatientView, DischargePatientView,
    BedAllocationListView, LongOccupancyBedsView,
    EquipmentAvailabilityView,
    EquipmentListCreateView, EquipmentDetailView,
)

urlpatterns = [
    # ── public (no login) ──
    path('types/',                                        BedTypesListView.as_view(),               name='bed-types'),
    path('availability/<uuid:hospital_id>/',              BedAvailabilityView.as_view(),            name='bed-availability'),
    path('availability/<uuid:hospital_id>/dept/<uuid:dept_id>/', DepartmentBedAvailabilityView.as_view(), name='dept-bed-availability'),
    path('equipment/<uuid:hospital_id>/availability/',    EquipmentAvailabilityView.as_view(),       name='equipment-availability'),

    # ── bed CRUD (staff) ──
    path('hospital/<uuid:hospital_id>/',                  BedListCreateView.as_view(),               name='bed-list'),
    path('<uuid:pk>/',                                    BedDetailView.as_view(),                   name='bed-detail'),
    path('hospital/<uuid:hospital_id>/bulk-update/',      BulkBedStatusUpdateView.as_view(),         name='bed-bulk-update'),

    # ── admit / discharge (reception) ──
    path('admit/',                                        AdmitPatientView.as_view(),                name='admit-patient'),
    path('discharge/',                                    DischargePatientView.as_view(),            name='discharge-patient'),

    # ── allocation history ──
    path('hospital/<uuid:hospital_id>/allocations/',      BedAllocationListView.as_view(),           name='bed-allocations'),
    path('hospital/<uuid:hospital_id>/long-occupancy/',   LongOccupancyBedsView.as_view(),           name='long-occupancy'),

    # ── equipment ──
    path('equipment/<uuid:hospital_id>/',                 EquipmentListCreateView.as_view(),         name='equipment-list'),
    path('equipment/item/<uuid:pk>/',                     EquipmentDetailView.as_view(),             name='equipment-detail'),
]