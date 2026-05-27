"""
apps/analytics/views.py
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from shared.response import APIResponse
from ..services import CaregiverAnalyticsService


def get_caregiver_or_404(user):
    try:
        return user.caregiver_profile
    except Exception:
        from django.http import Http404
        raise Http404


class CaregiverDashboardSummaryView(APIView):
    """GET /api/v1/analytics/caregiver/summary/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        caregiver = get_caregiver_or_404(request.user)
        
        # Check if premium features are accessible
        from apps.subscriptions.gates import SubscriptionGate
        try:
            SubscriptionGate.check_feature(request.user, 'caregiver_dashboard')
        except Exception as e:
            return APIResponse.error(str(e), code='SUBSCRIPTION_LIMIT', status=402)
            
        data = CaregiverAnalyticsService.get_dashboard_summary(caregiver)
        return APIResponse.success(data)


class CaregiverPatientCohortView(APIView):
    """GET /api/v1/analytics/caregiver/cohort/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        caregiver = get_caregiver_or_404(request.user)
        
        # Check if premium features are accessible
        from apps.subscriptions.gates import SubscriptionGate
        try:
            SubscriptionGate.check_feature(request.user, 'caregiver_dashboard')
        except Exception as e:
            return APIResponse.error(str(e), code='SUBSCRIPTION_LIMIT', status=402)
            
        data = CaregiverAnalyticsService.get_patient_cohort_list(caregiver)
        return APIResponse.success(data)
