"""
apps/clinical/urls/patients.py
"""
from django.urls import path
from ..views.patients import (
    PatientMeView, PatientHospitalizeView, PatientDischargeView,
    PatientConditionListCreateView, PatientConditionDeleteView,
)
from ..views.prescriptions import (
    PrescriptionListCreateView, PrescriptionDetailView,
    ScheduleListCreateView, ScheduleDetailView,
)
from ..views.caregivers import PatientCaregiverListView, PatientCaregiverInviteView, PatientCaregiverUnlinkView, PatientCaregiverPermissionsView

urlpatterns = [
    # Profile
    path('me/',                                          PatientMeView.as_view(),                    name='patient-me'),
    path('me/hospitalize/',                              PatientHospitalizeView.as_view(),            name='patient-hospitalize'),
    path('me/discharge/',                                PatientDischargeView.as_view(),              name='patient-discharge'),

    # Conditions
    path('me/conditions/',                               PatientConditionListCreateView.as_view(),    name='patient-conditions'),
    path('me/conditions/<uuid:condition_id>/',           PatientConditionDeleteView.as_view(),        name='patient-condition-delete'),

    # Caregivers
    path('me/caregivers/',                               PatientCaregiverListView.as_view(),          name='patient-caregivers'),
    path('me/caregivers/invite/',                        PatientCaregiverInviteView.as_view(),        name='patient-caregiver-invite'),
    path('me/caregivers/<uuid:link_id>/',                PatientCaregiverUnlinkView.as_view(),        name='patient-caregiver-unlink'),
    path('me/caregivers/<uuid:link_id>/permissions/',    PatientCaregiverPermissionsView.as_view(),   name='patient-caregiver-permissions'),

    # Prescriptions
    path('me/prescriptions/',                            PrescriptionListCreateView.as_view(),        name='patient-prescriptions'),
    path('me/prescriptions/<uuid:prescription_id>/',     PrescriptionDetailView.as_view(),            name='patient-prescription-detail'),
    path('me/prescriptions/<uuid:prescription_id>/schedules/',             ScheduleListCreateView.as_view(), name='patient-schedules'),
    path('me/prescriptions/<uuid:prescription_id>/schedules/<uuid:schedule_id>/', ScheduleDetailView.as_view(), name='patient-schedule-detail'),
]
