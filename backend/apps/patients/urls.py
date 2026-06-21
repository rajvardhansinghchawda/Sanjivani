# apps/patients/urls.py
from django.urls import path
from .views import (
    PatientMeView,
    PatientRegisterView,
    PatientSearchView,
    PatientDetailView,
    PatientAdmissionHistoryView,
    HospitalHistoryView,
    HospitalHistoryDetailView,
    HospitalPatientListView,
    CreateTransferRequestView,
    IncomingTransferListView,
    OutgoingTransferListView,
    RespondToTransferView,
    CompleteTransferView,
    TransferRequestDetailView,
    AllTransfersView,
    triage_severity_view,
    create_emergency_case_view,
)

urlpatterns = [

    # ── patient ──────────────────────────────────────────────
    path('me/',                                     PatientMeView.as_view(),               name='patient-me'),
    path('register/',                               PatientRegisterView.as_view(),         name='patient-register'),
    path('search/',                                 PatientSearchView.as_view(),            name='patient-search'),
    path('<uuid:pk>/',                              PatientDetailView.as_view(),            name='patient-detail'),
    path('<uuid:pk>/admission-history/',            PatientAdmissionHistoryView.as_view(),  name='patient-history'),
    path('hospital/<uuid:hospital_id>/',            HospitalPatientListView.as_view(),      name='hospital-patients'),
    path('history/',                                HospitalHistoryView.as_view(),          name='hospital-history'),
    path('history/detail/',                         HospitalHistoryDetailView.as_view(),    name='hospital-history-detail'),

    # ── transfers ─────────────────────────────────────────────
    path('transfers/create/',                       CreateTransferRequestView.as_view(),    name='transfer-create'),
    path('transfers/incoming/',                     IncomingTransferListView.as_view(),     name='transfer-incoming'),
    path('transfers/outgoing/',                     OutgoingTransferListView.as_view(),     name='transfer-outgoing'),
    path('transfers/all/',                          AllTransfersView.as_view(),             name='transfer-all'),
    path('transfers/<uuid:pk>/',                    TransferRequestDetailView.as_view(),    name='transfer-detail'),
    path('transfers/<uuid:pk>/respond/',            RespondToTransferView.as_view(),        name='transfer-respond'),
    path('transfers/<uuid:pk>/complete/',           CompleteTransferView.as_view(),         name='transfer-complete'),

    # ── triage (Phase 1) ──────────────────────────────────────
    path('triage/severity/',                        triage_severity_view,                   name='triage-severity'),
    path('triage/create-case/',                     create_emergency_case_view,             name='create-emergency-case'),
]