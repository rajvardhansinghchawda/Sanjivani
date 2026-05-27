"""
apps/clinical/views/medications.py — Medication catalog + drug interactions.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from shared.response import APIResponse
from shared.permissions import IsAdminUser
from shared.pagination import StandardResultsPagination
from ..models import Medication, DrugInteraction
from ..serializers import MedicationSerializer, DrugInteractionSerializer


class MedicationListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """GET /api/v1/medications/?search=metformin&form=TABLET"""
        qs = Medication.objects.filter(deleted_at__isnull=True)

        # Search
        q = request.query_params.get('search', '').strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(name__icontains=q) | Q(generic_name__icontains=q) |
                Q(brand_name__icontains=q) | Q(barcode__iexact=q)
            )

        form = request.query_params.get('form')
        if form:
            qs = qs.filter(form=form.upper())

        drug_class = request.query_params.get('drug_class')
        if drug_class:
            qs = qs.filter(drug_class__icontains=drug_class)

        paginator = StandardResultsPagination()
        page      = paginator.paginate_queryset(qs.order_by('name'), request)
        return paginator.get_paginated_response(MedicationSerializer(page, many=True).data)


class MedicationDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, medication_id):
        """GET /api/v1/medications/{id}/"""
        try:
            med = Medication.objects.get(id=medication_id, deleted_at__isnull=True)
        except Medication.DoesNotExist:
            return APIResponse.not_found('Medication not found.')

        # Also return known interactions
        interactions = DrugInteraction.objects.filter(
            medication_a=med
        ).select_related('medication_b') | DrugInteraction.objects.filter(
            medication_b=med
        ).select_related('medication_a')

        return APIResponse.success({
            **MedicationSerializer(med).data,
            'interactions': DrugInteractionSerializer(interactions, many=True).data,
        })


class MedicationCreateView(APIView):
    """POST /api/v1/medications/ — admin only."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        s = MedicationSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)
        med = s.save()
        return APIResponse.created(MedicationSerializer(med).data)


class DrugInteractionCheckView(APIView):
    """
    POST /api/v1/medications/interactions/check/
    Check interactions for a list of medications using local DB + OpenFDA.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..services import OpenFDAInteractionService
        from ..models import Medication, DrugInteractionCheckLog, Patient
        
        med_ids = request.data.get('medication_ids', [])
        if not med_ids or not isinstance(med_ids, list):
            return APIResponse.error('Provide a list of medication_ids.')

        meds = Medication.objects.filter(id__in=med_ids, deleted_at__isnull=True)
        if meds.count() < 2:
             return APIResponse.success({
                'has_severe': False,
                'interactions': [],
                'message': 'At least 2 medications are required for interaction check.'
            })

        results = []
        has_severe = False
        
        # Check pairs
        med_list = list(meds)
        for i in range(len(med_list)):
            for j in range(i + 1, len(med_list)):
                # 1. Local Check (Mocking or using DrugInteraction model)
                # 2. OpenFDA Check
                res = OpenFDAInteractionService.check(med_list[i], med_list[j])
                if res:
                    results.append(res)
                    if res['severity'] == 'SEVERE':
                        has_severe = True

        # Log check if patient profile exists
        try:
            patient = request.user.patient_profile
            DrugInteractionCheckLog.objects.create(
                patient=patient,
                medications_checked=[m.name for m in med_list],
                interactions_found=results,
                has_severe=has_severe,
                api_source='OPENFDA'
            )
        except (AttributeError, Patient.DoesNotExist):
            pass

        return APIResponse.success({
            'has_severe': has_severe,
            'interactions': results,
            'checked_meds': [m.name for m in med_list]
        })
