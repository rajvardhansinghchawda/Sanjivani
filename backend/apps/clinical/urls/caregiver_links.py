"""
apps/clinical/urls/caregiver_links.py — Accept invite (token-based, no auth context).
"""
from django.urls import path
from ..views.caregivers import CaregiverInviteAcceptView

urlpatterns = [
    path('<str:token>/accept/', CaregiverInviteAcceptView.as_view(), name='caregiver-invite-accept'),
]
