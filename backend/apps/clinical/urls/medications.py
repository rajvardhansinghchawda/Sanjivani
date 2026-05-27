"""
apps/clinical/urls/medications.py
"""
from django.urls import path
from ..views.medications import (
    MedicationListView, MedicationDetailView, MedicationCreateView,
    DrugInteractionCheckView
)

urlpatterns = [
    path('',           MedicationListView.as_view(),   name='medication-list'),
    path('add/',       MedicationCreateView.as_view(),  name='medication-create'),
    path('interactions/check/', DrugInteractionCheckView.as_view(), name='interaction-check'),
    path('<uuid:medication_id>/', MedicationDetailView.as_view(), name='medication-detail'),
]
