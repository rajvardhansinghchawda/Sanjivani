# apps/beds/views.py
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsReception, IsStaffMember, IsSameHospitalStaff
from .models import Bed, BedAllocation, MedicalEquipment
from .serializers import (
    BedSerializer, BedStatusUpdateSerializer,
    BedAllocationSerializer,
    AdmitPatientSerializer, DischargePatientSerializer,
    MedicalEquipmentSerializer,
)
from .cache import (
    get_hospital_bed_summary,
    get_department_bed_summary,
    get_hospital_equipment_summary,
    invalidate_bed_cache,
    invalidate_equipment_cache,
)


class BedTypesListView(APIView):
    """
    GET /api/beds/types/
    Returns the valid BedType choices.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        return Response([
            {'id': choice[0], 'label': choice[1]}
            for choice in Bed.BedType.choices
        ])


# ── Public: Bed availability summary (cached) ─────────────────
class BedAvailabilityView(APIView):
    """
    GET /api/beds/availability/<hospital_id>/
    Returns cached bed counts — used by patient portal.
    No login required.
    """
    permission_classes = [AllowAny]

    def get(self, request, hospital_id):
        summary = get_hospital_bed_summary(hospital_id)
        return Response(summary)


class DepartmentBedAvailabilityView(APIView):
    """
    GET /api/beds/availability/<hospital_id>/dept/<dept_id>/
    Per-department bed counts.
    """
    permission_classes = [AllowAny]

    def get(self, request, hospital_id, dept_id):
        summary = get_department_bed_summary(hospital_id, dept_id)
        return Response(summary)


# ── Staff: Bed CRUD ───────────────────────────────────────────
class BedListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/beds/hospital/<hospital_id>/
    POST /api/beds/hospital/<hospital_id>/
    """
    serializer_class = BedSerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['bed_type', 'ward_type', 'status', 'department', 'is_active']
    ordering_fields  = ['bed_number', 'last_updated']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_queryset(self):
        return Bed.objects.filter(
            hospital_id=self.kwargs['hospital_id'],
            is_active=True
        ).select_related('department')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        from apps.hospitals.models import Hospital
        ctx['hospital'] = get_object_or_404(Hospital, pk=self.kwargs['hospital_id'])
        return ctx

    def perform_create(self, serializer):
        hospital_id = self.kwargs['hospital_id']
        serializer.save(hospital_id=hospital_id)
        # new bed added — invalidate hospital cache
        invalidate_bed_cache(hospital_id)


class BedDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/beds/<id>/
    PATCH  /api/beds/<id>/
    DELETE /api/beds/<id>/
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return BedStatusUpdateSerializer
        return BedSerializer

    def get_queryset(self):
        return Bed.objects.select_related('hospital', 'department')

    def perform_update(self, serializer):
        bed = serializer.save()
        # ← invalidate cache after every status change
        invalidate_bed_cache(
            bed.hospital_id,
            bed.department_id
        )

    def perform_destroy(self, instance):
        # soft delete — never hard delete beds
        instance.is_active = False
        instance.save()
        invalidate_bed_cache(instance.hospital_id, instance.department_id)


# ── Reception: Bulk status update ────────────────────────────
class BulkBedStatusUpdateView(APIView):
    """
    PATCH /api/beds/hospital/<hospital_id>/bulk-update/
    Reception can update multiple beds in one request.
    Body: { "beds": [{"id": "...", "status": "available"}, ...] }
    """
    permission_classes = [IsReception, IsSameHospitalStaff]

    def patch(self, request, hospital_id):
        beds_data = request.data.get('beds', [])

        if not beds_data:
            return Response(
                {'error': 'No beds provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        updated = []
        errors  = []

        for item in beds_data:
            try:
                bed = Bed.objects.get(
                    pk=item['id'],
                    hospital_id=hospital_id
                )
                bed.status = item['status']
                if 'notes' in item:
                    bed.notes = item['notes']
                bed.save(update_fields=['status', 'notes', 'last_updated'])
                updated.append(str(bed.id))
            except Bed.DoesNotExist:
                errors.append({'id': item.get('id'), 'error': 'Not found'})
            except Exception as e:
                errors.append({'id': item.get('id'), 'error': str(e)})

        # one cache invalidation for the whole batch
        invalidate_bed_cache(hospital_id)

        return Response({
            'updated': len(updated),
            'errors' : errors,
        })


# ── Admit patient to bed ──────────────────────────────────────
class AdmitPatientView(APIView):
    """
    POST /api/beds/admit/
    Reception staff admits a patient to a bed.
    Body: { "bed_id": "...", "patient_id": "...", "notes": "..." }
    """
    permission_classes = [IsReception]

    def post(self, request):
        serializer = AdmitPatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bed_id     = serializer.validated_data['bed_id']
        patient_id = serializer.validated_data['patient_id']
        notes      = serializer.validated_data.get('notes', '')

        bed = Bed.objects.select_related('hospital').get(pk=bed_id)

        # create allocation record
        allocation = BedAllocation.objects.create(
            bed_id       = bed_id,
            patient_id   = patient_id,
            allocated_by = request.user,
            notes        = notes,
        )

        # mark bed as occupied
        bed.status = Bed.BedStatus.OCCUPIED
        bed.save(update_fields=['status', 'last_updated'])

        # invalidate cache immediately
        invalidate_bed_cache(bed.hospital_id, bed.department_id)

        return Response({
            'message'   : 'Patient admitted successfully',
            'allocation': BedAllocationSerializer(allocation).data,
        }, status=status.HTTP_201_CREATED)


# ── Discharge patient ─────────────────────────────────────────
class DischargePatientView(APIView):
    """
    POST /api/beds/discharge/
    Reception staff discharges a patient — frees the bed.
    Body: { "allocation_id": "...", "notes": "..." }
    """
    permission_classes = [IsReception]

    def post(self, request):
        serializer = DischargePatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        allocation_id = serializer.validated_data['allocation_id']
        notes         = serializer.validated_data.get('notes', '')

        allocation = BedAllocation.objects.select_related(
            'bed__hospital', 'bed__department'
        ).get(pk=allocation_id, discharged_at__isnull=True)

        # record discharge time
        allocation.discharged_at = timezone.now()
        if notes:
            allocation.notes = notes
        allocation.save(update_fields=['discharged_at', 'notes'])

        # free the bed
        bed = allocation.bed
        bed.status = Bed.BedStatus.AVAILABLE
        bed.save(update_fields=['status', 'last_updated'])

        # invalidate cache immediately
        invalidate_bed_cache(bed.hospital_id, bed.department_id)

        return Response({
            'message'      : 'Patient discharged successfully',
            'bed_number'   : bed.bed_number,
            'duration_days': allocation.duration_days,
        })


# ── Allocation history ────────────────────────────────────────
class BedAllocationListView(generics.ListAPIView):
    """
    GET /api/beds/hospital/<hospital_id>/allocations/
    Staff views full allocation history for their hospital.
    Supports: ?is_active=true  to see only current admissions.
    """
    permission_classes = [IsStaffMember, IsSameHospitalStaff]
    serializer_class   = BedAllocationSerializer
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['bed__bed_type', 'bed__department']
    ordering_fields    = ['admitted_at', 'discharged_at']

    def get_queryset(self):
        qs = BedAllocation.objects.filter(
            bed__hospital_id=self.kwargs['hospital_id']
        ).select_related('bed', 'patient', 'allocated_by')

        is_active = self.request.query_params.get('is_active')
        if is_active == 'true':
            qs = qs.filter(discharged_at__isnull=True)

        return qs


# ── Long-duration beds (supervisor use) ──────────────────────
class LongOccupancyBedsView(generics.ListAPIView):
    """
    GET /api/beds/hospital/<hospital_id>/long-occupancy/
    Returns beds occupied more than N days.
    Supervisor uses this to flag suspicious occupancy.
    Default: ?days=20
    """
    permission_classes = [IsStaffMember]
    serializer_class   = BedAllocationSerializer

    def get_queryset(self):
        days = int(self.request.query_params.get('days', 20))
        cutoff = timezone.now() - timezone.timedelta(days=days)
        return BedAllocation.objects.filter(
            bed__hospital_id=self.kwargs['hospital_id'],
            discharged_at__isnull=True,
            admitted_at__lte=cutoff
        ).select_related('bed', 'patient', 'allocated_by')


# ── Equipment ─────────────────────────────────────────────────
class EquipmentAvailabilityView(APIView):
    """
    GET /api/beds/equipment/<hospital_id>/availability/
    Returns cached equipment counts — used by patient portal.
    No login required.
    """
    permission_classes = [AllowAny]

    def get(self, request, hospital_id):
        summary = get_hospital_equipment_summary(hospital_id)
        return Response(summary)


class EquipmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/beds/equipment/<hospital_id>/
    POST /api/beds/equipment/<hospital_id>/
    """
    serializer_class = MedicalEquipmentSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['equipment_type', 'status', 'department']
    search_fields    = ['name', 'equipment_type', 'manufacturer']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_queryset(self):
        return MedicalEquipment.objects.filter(
            hospital_id=self.kwargs['hospital_id']
        ).select_related('department')

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.kwargs['hospital_id'])
        invalidate_equipment_cache(self.kwargs['hospital_id'])


class EquipmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/beds/equipment/item/<id>/
    PATCH  /api/beds/equipment/item/<id>/
    """
    serializer_class   = MedicalEquipmentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_queryset(self):
        return MedicalEquipment.objects.select_related('hospital', 'department')

    def perform_update(self, serializer):
        equipment = serializer.save()
        invalidate_equipment_cache(equipment.hospital_id)