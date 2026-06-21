# apps/hospitals/views.py
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import     APIView
from core.permissions import IsAdminUser, IsSupervisor, IsStaffMember, IsSameHospitalStaff,IsReception
from .filters import HospitalFilter, get_nearby_hospitals
from .models import *
from .serializers import (
    HospitalPublicSerializer, HospitalStaffSerializer,
    HospitalCreateSerializer, DepartmentSerializer,
    ServiceCategorySerializer, ServiceMasterSerializer,
    HospitalServiceSerializer, HospitalRegistrationSerializer
)


# ── Public: Hospital search (patients, no login) ──────────────
class HospitalSearchView(generics.ListAPIView):
    """
    GET /api/hospitals/search/
    Public endpoint — patients use this to find hospitals.
    Supports: ?city=Bhopal &service=IMG_MRI &lat=23.2 &lng=77.4 &radius=10
    """
    permission_classes = [AllowAny]
    serializer_class   = HospitalPublicSerializer
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class    = HospitalFilter
    search_fields      = ['name', 'city', 'area']
    ordering_fields    = ['name', 'total_beds', 'icu_capacity']

    def get_queryset(self):
        qs = Hospital.objects.filter(
            status=Hospital.Status.ACTIVE,
            verification_status=Hospital.VerificationStatus.VERIFIED
        ).prefetch_related('services__service__category', 'departments')

        # distance filter
        lat    = self.request.query_params.get('lat')
        lng    = self.request.query_params.get('lng')
        radius = self.request.query_params.get('radius', 10)

        if lat and lng:
            qs = get_nearby_hospitals(qs, lat, lng, float(radius))

        return qs


# ── Public: Single hospital detail ───────────────────────────
class HospitalDetailPublicView(generics.RetrieveAPIView):
    """
    GET /api/hospitals/<id>/
    Public hospital profile page.
    """
    permission_classes = [AllowAny]
    serializer_class   = HospitalPublicSerializer
    queryset           = Hospital.objects.filter(
        status=Hospital.Status.ACTIVE
    ).prefetch_related('services__service__category', 'departments')


# ── Admin: Full hospital CRUD ─────────────────────────────────
class HospitalViewSet(ModelViewSet):
    """
    Admin and supervisor full access to hospitals.
    GET    /api/hospitals/manage/          → list all
    POST   /api/hospitals/manage/          → register new hospital
    GET    /api/hospitals/manage/<id>/     → detail
    PUT    /api/hospitals/manage/<id>/     → full update
    PATCH  /api/hospitals/manage/<id>/     → partial update
    DELETE /api/hospitals/manage/<id>/     → deactivate
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_class = HospitalFilter
    search_fields   = ['name', 'city', 'license_number']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsStaffMember()]
        if self.action == 'create':
            return [IsAdminUser()]
        if self.action in ['update', 'partial_update']:
            # Platform admin or Hospital Admin (IsSameHospitalStaff)
            return [(IsAdminUser | (IsStaffMember & IsSameHospitalStaff))()]
        return [IsAdminUser()]

    def get_serializer_class(self):
        if self.action == 'create':
            return HospitalCreateSerializer
        return HospitalStaffSerializer

    def get_queryset(self):
        return Hospital.objects.all().prefetch_related(
            'services__service__category', 'departments'
        )

    @action(detail=True, methods=['patch'], permission_classes=[IsSupervisor])
    def verify(self, request, pk=None):
        """
        PATCH /api/hospitals/manage/<id>/verify/
        Supervisor approves or rejects a hospital.
        Body: { "status": "approved" | "rejected", "rejection_reason": "..." }
        """
        hospital = self.get_object()
        reg_status = request.data.get('status')
        reason     = request.data.get('rejection_reason', '')

        if reg_status not in ['approved', 'rejected']:
            return Response(
                {'error': 'Status must be approved or rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        registration = hospital.registration
        registration.status           = reg_status
        registration.verified_by      = request.user
        registration.verification_date = timezone.now()
        if reg_status == 'rejected':
            registration.rejection_reason = reason
        registration.save()

        # sync hospital verification status
        hospital.verification_status = (
            Hospital.VerificationStatus.VERIFIED if reg_status == 'approved'
            else Hospital.VerificationStatus.REJECTED
        )
        hospital.save()

        return Response({'message': f'Hospital {reg_status} successfully'})


# ── Department views ──────────────────────────────────────────
class DepartmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/hospitals/<hospital_id>/departments/
    POST /api/hospitals/<hospital_id>/departments/
    """
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsStaffMember(), IsSameHospitalStaff()]

    def get_queryset(self):
        return Department.objects.filter(
            hospital_id=self.kwargs['hospital_id'],
            is_active=True
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['hospital'] = Hospital.objects.get(pk=self.kwargs['hospital_id'])
        return ctx

    def perform_create(self, serializer):
        hospital = Hospital.objects.get(pk=self.kwargs['hospital_id'])
        serializer.save(hospital=hospital)


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/hospitals/<hospital_id>/departments/<id>/
    PATCH  /api/hospitals/<hospital_id>/departments/<id>/
    DELETE /api/hospitals/<hospital_id>/departments/<id>/
    """
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsStaffMember(), IsSameHospitalStaff()]

    def get_queryset(self):
        return Department.objects.filter(hospital_id=self.kwargs['hospital_id'])

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['hospital'] = Hospital.objects.get(pk=self.kwargs['hospital_id'])
        return ctx


# ── Service Category & Master (Admin manages) ─────────────────
class ServiceCategoryListView(generics.ListCreateAPIView):
    """
    GET  /api/hospitals/service-categories/  → public (used in registration form)
    POST /api/hospitals/service-categories/  → admin only
    """
    queryset         = ServiceCategory.objects.filter(is_active=True)
    serializer_class = ServiceCategorySerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]


class ServiceMasterListView(generics.ListCreateAPIView):
    """
    GET  /api/hospitals/services/            → public
    POST /api/hospitals/services/            → admin only
    GET  /api/hospitals/services/?category=<id>
    """
    serializer_class = ServiceMasterSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]

    def get_queryset(self):
        qs = ServiceMaster.objects.filter(is_active=True).select_related('category')
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)
        return qs


# ── Hospital Services (what a hospital offers) ────────────────
class HospitalServiceView(generics.ListCreateAPIView):
    """
    GET  /api/hospitals/<hospital_id>/services/  → public
    POST /api/hospitals/<hospital_id>/services/  → reception/admin adds a service
    """
    serializer_class = HospitalServiceSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsStaffMember(), IsSameHospitalStaff()]

    def get_queryset(self):
        return HospitalService.objects.filter(
            hospital_id=self.kwargs['hospital_id']
        ).select_related('service', 'service__category')

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.kwargs['hospital_id'])


class HospitalServiceUpdateView(generics.RetrieveUpdateDestroyAPIView):
    """
    PATCH  /api/hospitals/<hospital_id>/services/<id>/  → toggle availability
    DELETE /api/hospitals/<hospital_id>/services/<id>/  → remove service
    """
    permission_classes = [IsStaffMember, IsSameHospitalStaff]
    serializer_class   = HospitalServiceSerializer

    def get_queryset(self):
        return HospitalService.objects.filter(hospital_id=self.kwargs['hospital_id'])

# apps/hospitals/views.py — add at the bottom

from .models import Doctor, DutySchedule
from .serializers import DoctorSerializer, DutyScheduleSerializer, OnDutyDoctorSerializer
from django.utils import timezone


class DoctorListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/hospitals/<hospital_id>/doctors/
    POST /api/hospitals/<hospital_id>/doctors/
    Reception registers a doctor. Public can see who is available.
    Supports: ?specialization=cardiology &status=active
    """
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['specialization', 'status', 'department']
    search_fields    = ['full_name', 'registration_no', 'qualification']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_serializer_class(self):
        return DoctorSerializer

    def get_queryset(self):
        return Doctor.objects.filter(
            hospital_id=self.kwargs['hospital_id']
        ).select_related('department')

    def perform_create(self, serializer):
        serializer.save(hospital_id=self.kwargs['hospital_id'])


class DoctorDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/hospitals/doctors/<id>/
    PATCH  /api/hospitals/doctors/<id>/
    DELETE /api/hospitals/doctors/<id>/
    """
    serializer_class = DoctorSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_queryset(self):
        return Doctor.objects.select_related('hospital', 'department')

    def perform_destroy(self, instance):
        # soft delete
        instance.status = Doctor.Status.INACTIVE
        instance.save()


class DutyScheduleListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/hospitals/<hospital_id>/duty-schedules/
    POST /api/hospitals/<hospital_id>/duty-schedules/
    Supports: ?date=2024-01-15 &department=<id> &specialization=icu
    """
    serializer_class = DutyScheduleSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsReception(), IsSameHospitalStaff()]

    def get_queryset(self):
        qs = DutySchedule.objects.filter(
            doctor__hospital_id=self.kwargs['hospital_id'],
            is_active=True
        ).select_related('doctor', 'department', 'created_by')

        # filter by date if provided
        date_str = self.request.query_params.get('date')
        if date_str:
            try:
                from datetime import date
                filter_date = date.fromisoformat(date_str)
                qs = qs.filter(
                    shift_start__date__lte=filter_date,
                    shift_end__date__gte=filter_date
                )
            except ValueError:
                pass

        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department_id=dept)

        return qs


class DutyScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/hospitals/duty-schedules/<id>/
    PATCH  /api/hospitals/duty-schedules/<id>/
    DELETE /api/hospitals/duty-schedules/<id>/
    """
    serializer_class   = DutyScheduleSerializer
    permission_classes = [IsReception, IsSameHospitalStaff]

    def get_queryset(self):
        return DutySchedule.objects.select_related('doctor', 'department')


class OnDutyNowView(APIView):
    """
    GET /api/hospitals/<hospital_id>/on-duty-now/
    Shows every doctor currently on shift right now.
    Reception uses this on their dashboard.
    Supports: ?specialization=icu &department=<id>
    """
    permission_classes = [AllowAny]

    def get(self, request, hospital_id):
        now = timezone.now()

        doctors_on_duty = Doctor.objects.filter(
            hospital_id=hospital_id,
            status=Doctor.Status.ACTIVE,
            duty_schedules__shift_start__lte=now,
            duty_schedules__shift_end__gte=now,
            duty_schedules__is_active=True
        ).select_related('department').distinct()

        # optional filters
        spec = request.query_params.get('specialization')
        dept = request.query_params.get('department')
        if spec:
            doctors_on_duty = doctors_on_duty.filter(specialization=spec)
        if dept:
            doctors_on_duty = doctors_on_duty.filter(department_id=dept)

        return Response({
            'timestamp'     : now,
            'hospital_id'   : str(hospital_id),
            'total_on_duty' : doctors_on_duty.count(),
            'doctors'       : OnDutyDoctorSerializer(doctors_on_duty, many=True).data,
        })


# ── Nearby Hospitals View (Phase 2) ──────────────────────────
from rest_framework.decorators import api_view, permission_classes as drf_permission_classes
from .routing import find_nearest_hospital


@api_view(['GET'])
@drf_permission_classes([AllowAny])
def nearby_hospitals_view(request):
    """
    GET /api/hospitals/nearby/?lat=22.71&lng=75.85&bed_type=ICU&department=Cardiology&severity=P1
    Returns ranked list of nearby hospitals with bed availability.
    """
    try:
        lat        = float(request.query_params.get('lat', 0))
        lng        = float(request.query_params.get('lng', 0))
        bed_type   = request.query_params.get('bed_type', 'GENERAL').upper()
        department = request.query_params.get('department', None)
        severity   = request.query_params.get('severity', 'P3')
        radius     = float(request.query_params.get('radius_km', 50))
    except (ValueError, TypeError):
        return Response({'error': 'Invalid coordinates'}, status=400)

    if not lat or not lng:
        return Response({'error': 'lat and lng are required'}, status=400)

    hospitals = find_nearest_hospital(
        lat=lat, lng=lng,
        required_bed_type=bed_type,
        department=department,
        max_radius_km=radius,
        severity=severity,
    )

    return Response({
        "query": {"lat": lat, "lng": lng, "bed_type": bed_type,
                  "department": department, "severity": severity},
        "count": len(hospitals),
        "hospitals": hospitals,
    })