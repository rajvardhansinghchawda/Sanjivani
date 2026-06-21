# apps/patients/views.py
from django.utils import timezone
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import (
    IsReception, IsStaffMember,
  IsSameHospitalStaff, IsSupervisor
)
from apps.beds.cache import invalidate_bed_cache
from apps.beds.models import BedAllocation, Bed
from .models import Patient, TransferRequest
from .serializers import (
    PatientSerializer, PatientPublicSerializer,
    PatientSearchSerializer,
    TransferRequestSerializer,
    CreateTransferRequestSerializer,
    RespondToTransferSerializer,
)


def _parse_date_ymd(value: str):
    """
    Parse YYYY-MM-DD into a date, or return None.
    """
    if not value:
        return None
    try:
        return timezone.datetime.strptime(value, '%Y-%m-%d').date()
    except Exception:
        return None


def _dt_in_range(dt, from_date, to_date):
    if not dt:
        return False
    d = dt.date() if hasattr(dt, 'date') else dt
    if from_date and d < from_date:
        return False
    if to_date and d > to_date:
        return False
    return True


class HospitalHistoryView(APIView):
    """
    GET /api/patients/history/?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&type=...&search=...

    Returns hospital-scoped event history (admit / discharge / transfers).
    Hospital isolation is enforced by request.user.hospital.
    """
    permission_classes = [IsStaffMember, IsSameHospitalStaff]

    def get(self, request):
        hospital = request.user.hospital
        if not hospital:
            return Response({'detail': 'User is not linked to a hospital.'}, status=status.HTTP_403_FORBIDDEN)

        from_date = _parse_date_ymd(request.query_params.get('from_date', '').strip())
        to_date = _parse_date_ymd(request.query_params.get('to_date', '').strip())
        event_type = (request.query_params.get('type', '') or '').strip().lower()  # optional
        search = (request.query_params.get('search', '') or '').strip().lower()
        limit = request.query_params.get('limit', '200')
        try:
            limit_n = max(1, min(int(limit), 500))
        except Exception:
            limit_n = 200

        events = []

        # Admissions / discharges (BedAllocation)
        allocations = BedAllocation.objects.filter(
            bed__hospital=hospital
        ).select_related('patient', 'bed', 'bed__department', 'allocated_by').order_by('-admitted_at')[:limit_n]

        for a in allocations:
            patient = a.patient
            if search:
                hay = f"{patient.full_name or ''} {patient.phone or ''} {a.bed.bed_number or ''}".lower()
                if search not in hay:
                    continue

            admit_dt = a.admitted_at
            if (not event_type or event_type == 'admit') and _dt_in_range(admit_dt, from_date, to_date):
                events.append({
                    'kind': 'admit',
                    'occurred_at': admit_dt,
                    'source': 'allocation',
                    'source_id': str(a.id),
                    'hospital_id': str(hospital.id),
                    'patient': {
                        'id': str(patient.id),
                        'full_name': patient.full_name,
                        'phone': patient.phone,
                        'age': patient.age,
                        'gender': patient.gender,
                        'blood_group': patient.blood_group,
                    },
                    'summary': f"Admitted to bed {a.bed.bed_number}",
                    'meta': {
                        'bed_number': a.bed.bed_number,
                        'bed_type': a.bed.bed_type,
                        'ward_type': a.bed.ward_type,
                        'department': getattr(a.bed.department, 'name', None),
                        'allocated_by': getattr(a.allocated_by, 'full_name', None),
                    }
                })

            discharge_dt = a.discharged_at
            if discharge_dt and (not event_type or event_type == 'discharge') and _dt_in_range(discharge_dt, from_date, to_date):
                events.append({
                    'kind': 'discharge',
                    'occurred_at': discharge_dt,
                    'source': 'allocation',
                    'source_id': str(a.id),
                    'hospital_id': str(hospital.id),
                    'patient': {
                        'id': str(patient.id),
                        'full_name': patient.full_name,
                        'phone': patient.phone,
                        'age': patient.age,
                        'gender': patient.gender,
                        'blood_group': patient.blood_group,
                    },
                    'summary': f"Discharged from bed {a.bed.bed_number}",
                    'meta': {
                        'bed_number': a.bed.bed_number,
                        'department': getattr(a.bed.department, 'name', None),
                        'allocated_by': getattr(a.allocated_by, 'full_name', None),
                    }
                })

        # Transfers (TransferRequest)
        transfers = TransferRequest.objects.filter(
            Q(from_hospital=hospital) | Q(to_hospital=hospital)
        ).select_related('patient', 'from_hospital', 'to_hospital', 'requested_by', 'accepted_by').order_by('-requested_at')[:limit_n]

        for t in transfers:
            patient = t.patient
            if search:
                hay = f"{patient.full_name or ''} {patient.phone or ''} {t.from_hospital.name if t.from_hospital_id else ''} {t.to_hospital.name if t.to_hospital_id else ''}".lower()
                if search not in hay:
                    continue

            # requested (outgoing only)
            if t.from_hospital_id == hospital.id:
                if (not event_type or event_type == 'transfer_requested') and _dt_in_range(t.requested_at, from_date, to_date):
                    events.append({
                        'kind': 'transfer_requested',
                        'occurred_at': t.requested_at,
                        'source': 'transfer',
                        'source_id': str(t.id),
                        'hospital_id': str(hospital.id),
                        'patient': {
                            'id': str(patient.id),
                            'full_name': patient.full_name,
                            'phone': patient.phone,
                            'age': patient.age,
                            'gender': patient.gender,
                            'blood_group': patient.blood_group,
                        },
                        'summary': f"Transfer requested → {t.to_hospital.name if t.to_hospital_id else 'Any hospital'}",
                        'meta': {
                            'status': t.status,
                            'priority': t.priority,
                            'to_hospital': t.to_hospital.name if t.to_hospital_id else None,
                            'required_bed_type': t.required_bed_type,
                            'required_services': t.required_services,
                        }
                    })

            # accepted / rejected (incoming only)
            if t.to_hospital_id == hospital.id and t.responded_at:
                kind = None
                if t.status == TransferRequest.Status.ACCEPTED:
                    kind = 'transfer_accepted'
                elif t.status == TransferRequest.Status.REJECTED:
                    kind = 'transfer_rejected'
                if kind and (not event_type or event_type == kind) and _dt_in_range(t.responded_at, from_date, to_date):
                    events.append({
                        'kind': kind,
                        'occurred_at': t.responded_at,
                        'source': 'transfer',
                        'source_id': str(t.id),
                        'hospital_id': str(hospital.id),
                        'patient': {
                            'id': str(patient.id),
                            'full_name': patient.full_name,
                            'phone': patient.phone,
                            'age': patient.age,
                            'gender': patient.gender,
                            'blood_group': patient.blood_group,
                        },
                        'summary': f"Transfer {t.status} from {t.from_hospital.name}",
                        'meta': {
                            'status': t.status,
                            'priority': t.priority,
                            'from_hospital': t.from_hospital.name if t.from_hospital_id else None,
                            'rejection_reason': t.rejection_reason,
                            'notes': t.notes,
                        }
                    })

            # completed (incoming)
            if t.to_hospital_id == hospital.id and t.completed_at and (not event_type or event_type == 'transfer_completed') and _dt_in_range(t.completed_at, from_date, to_date):
                events.append({
                    'kind': 'transfer_completed',
                    'occurred_at': t.completed_at,
                    'source': 'transfer',
                    'source_id': str(t.id),
                    'hospital_id': str(hospital.id),
                    'patient': {
                        'id': str(patient.id),
                        'full_name': patient.full_name,
                        'phone': patient.phone,
                        'age': patient.age,
                        'gender': patient.gender,
                        'blood_group': patient.blood_group,
                    },
                    'summary': f"Transfer completed (arrived) from {t.from_hospital.name}",
                    'meta': {
                        'priority': t.priority,
                        'required_bed_type': t.required_bed_type,
                        'required_services': t.required_services,
                    }
                })

        # Sort descending by occurred_at and limit
        events.sort(key=lambda e: e.get('occurred_at') or timezone.now(), reverse=True)
        events = events[:limit_n]

        # Serialize datetimes to ISO
        for e in events:
            dt = e.get('occurred_at')
            e['occurred_at'] = dt.isoformat() if dt else None

        return Response({'results': events, 'count': len(events)})


class HospitalHistoryDetailView(APIView):
    """
    GET /api/patients/history/detail/?source=allocation|transfer&id=<uuid>
    Returns full detail for a single history entity.
    """
    permission_classes = [IsStaffMember, IsSameHospitalStaff]

    def get(self, request):
        hospital = request.user.hospital
        if not hospital:
            return Response({'detail': 'User is not linked to a hospital.'}, status=status.HTTP_403_FORBIDDEN)

        source = (request.query_params.get('source', '') or '').strip().lower()
        source_id = (request.query_params.get('id', '') or '').strip()
        if source not in ['allocation', 'transfer'] or not source_id:
            return Response({'detail': 'source and id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if source == 'allocation':
            from apps.beds.serializers import BedAllocationSerializer
            try:
                allocation = BedAllocation.objects.select_related(
                    'bed__hospital', 'bed__department', 'patient', 'allocated_by'
                ).get(id=source_id, bed__hospital=hospital)
            except BedAllocation.DoesNotExist:
                return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'source': 'allocation', 'data': BedAllocationSerializer(allocation).data})

        # transfer
        try:
            transfer = TransferRequest.objects.select_related(
                'patient', 'from_hospital', 'to_hospital', 'requested_by', 'accepted_by'
            ).get(id=source_id)
        except TransferRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # hospital isolation
        if str(transfer.from_hospital_id) != str(hospital.id) and str(transfer.to_hospital_id) != str(hospital.id):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'source': 'transfer', 'data': TransferRequestSerializer(transfer).data})


# ─────────────────────────────────────────────────────────────
#  Patient views
# ─────────────────────────────────────────────────────────────

class PatientMeView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/patients/me/   → patient views their own profile + admission info
    PATCH /api/patients/me/   → patient updates their own profile
    """
    serializer_class   = PatientSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'patch', 'head', 'options']

    def get_object(self):
        try:
            return self.request.user.patient_profile
        except Patient.DoesNotExist:
            user = self.request.user
            from django.db.models import Q

            existing = (
                Patient.objects.filter(user__isnull=True)
                .filter(Q(phone=user.phone) | Q(email=user.email))
                .first()
            )
            if existing:
                existing.user = user
                if not existing.full_name:
                    existing.full_name = user.full_name or 'Patient'
                if user.email and not existing.email:
                    existing.email = user.email
                if user.phone and not existing.phone:
                    existing.phone = user.phone
                existing.save()
                return existing

            return Patient.objects.create(
                user=user,
                full_name=user.full_name or 'Patient',
                phone=user.phone or (user.email[:15] if user.email else '0000000000'),
                email=user.email,
            )


class PatientRegisterView(generics.CreateAPIView):
    """
    POST /api/patients/register/
    Reception registers a new patient on arrival.
    No login required — walk-in patients can also self-register.
    """
    serializer_class   = PatientSerializer
    permission_classes = [AllowAny]


class PatientSearchView(APIView):
    """
    GET /api/patients/search/?phone=9876543210
    Reception quickly finds existing patient by phone number.
    Avoids duplicate patient records.
    """
    permission_classes = [IsReception]

    def get(self, request):
        phone = request.query_params.get('phone', '').strip()
        if not phone:
            return Response(
                {'error': 'phone query param is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        patients = Patient.objects.filter(phone__icontains=phone)
        return Response(PatientSerializer(patients, many=True).data)


class PatientDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/patients/<id>/   → view patient detail
    PATCH /api/patients/<id>/   → update patient info
    """
    serializer_class   = PatientSerializer
    permission_classes = [IsStaffMember]
    queryset           = Patient.objects.all()


class PatientAdmissionHistoryView(generics.ListAPIView):
    """
    GET /api/patients/<id>/admission-history/
    Full admit/discharge history for a patient.
    """
    permission_classes = [IsStaffMember]

    def get(self, request, pk):
        from apps.beds.serializers import BedAllocationSerializer
        allocations = BedAllocation.objects.filter(
            patient_id=pk
        ).select_related('bed__hospital', 'bed__department', 'allocated_by')
        from apps.beds.serializers import BedAllocationSerializer
        return Response(
            BedAllocationSerializer(allocations, many=True).data
        )


class HospitalPatientListView(generics.ListAPIView):
    """
    GET /api/patients/hospital/<hospital_id>/
    All patients currently admitted in a hospital.
    Reception and supervisor use this.
    """
    permission_classes = [IsStaffMember, IsSameHospitalStaff]
    serializer_class   = PatientSerializer
    filter_backends    = [filters.SearchFilter, DjangoFilterBackend]
    search_fields      = ['full_name', 'phone']
    filterset_fields   = ['gender', 'blood_group', 'city']

    def get_queryset(self):
        hospital_id = self.kwargs['hospital_id']
        # only admitted patients (active allocation)
        admitted_patient_ids = BedAllocation.objects.filter(
            bed__hospital_id=hospital_id,
            discharged_at__isnull=True
        ).values_list('patient_id', flat=True)

        return Patient.objects.filter(
            id__in=admitted_patient_ids
        ).prefetch_related('allocations__bed')


# ─────────────────────────────────────────────────────────────
#  Transfer Request views
# ─────────────────────────────────────────────────────────────

class CreateTransferRequestView(generics.CreateAPIView):
    """
    POST /api/patients/transfers/create/
    Reception raises a transfer request when their hospital
    cannot provide required care.
    """
    permission_classes = [IsReception]
    serializer_class   = CreateTransferRequestSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        transfer = serializer.save()

        try:
            from apps.calls.tasks import send_transfer_alert_call
            send_transfer_alert_call.delay(str(transfer.id))
        except Exception as e:
            # log exception or pass, but don't fail the API request
            print(f"Failed to trigger transfer alert call: {e}")

        return Response(
            TransferRequestSerializer(transfer).data,
            status=status.HTTP_201_CREATED
        )


class IncomingTransferListView(generics.ListAPIView):
    """
    GET /api/patients/transfers/incoming/
    Reception at receiving hospital sees pending transfer
    requests they can accept.
    Only shows PENDING requests targeting their hospital
    or with no target hospital yet (open requests).
    """
    permission_classes = [IsReception]
    serializer_class   = TransferRequestSerializer
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status', 'priority', 'required_bed_type']
    ordering_fields    = ['requested_at', 'priority']

    def get_queryset(self):
        hospital = self.request.user.hospital
        return TransferRequest.objects.filter(
            Q(to_hospital=hospital) | Q(to_hospital__isnull=True),
            status=TransferRequest.Status.PENDING
        ).select_related(
            'patient', 'from_hospital', 'requested_by'
        ).exclude(from_hospital=hospital)


class OutgoingTransferListView(generics.ListAPIView):
    """
    GET /api/patients/transfers/outgoing/
    Reception sees transfers they have raised from their hospital.
    """
    permission_classes = [IsReception]
    serializer_class   = TransferRequestSerializer
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status', 'priority']
    ordering_fields    = ['requested_at']

    def get_queryset(self):
        return TransferRequest.objects.filter(
            from_hospital=self.request.user.hospital
        ).select_related(
            'patient', 'to_hospital', 'accepted_by'
        )


class RespondToTransferView(APIView):
    """
    POST /api/patients/transfers/<id>/respond/
    Receiving hospital's reception accepts or rejects the transfer.

    On accept:
      - Sets status to accepted
      - Records responding hospital as to_hospital
      - Records accepted_by and responded_at

    On reject:
      - Sets status to rejected with reason
    """
    permission_classes = [IsReception]

    def post(self, request, pk):
        try:
            transfer = TransferRequest.objects.select_related(
                'patient', 'from_hospital'
            ).get(pk=pk, status=TransferRequest.Status.PENDING)
        except TransferRequest.DoesNotExist:
            return Response(
                {'error': 'Transfer request not found or already responded to'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = RespondToTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action           = serializer.validated_data['action']
        rejection_reason = serializer.validated_data.get('rejection_reason', '')
        notes            = serializer.validated_data.get('notes', '')

        transfer.accepted_by   = request.user
        transfer.responded_at  = timezone.now()

        if action == 'accept':
            transfer.status      = TransferRequest.Status.ACCEPTED
            transfer.to_hospital = request.user.hospital
            transfer.notes       = notes
            transfer.save()

            try:
                from apps.calls.tasks import send_transfer_notification_call
                send_transfer_notification_call.delay(str(transfer.id))
            except Exception:
                pass  # never let call failure break the transfer
            
            return Response({
                'message' : 'Transfer accepted',
                'transfer': TransferRequestSerializer(transfer).data,
            })

        else:
            transfer.status           = TransferRequest.Status.REJECTED
            transfer.rejection_reason = rejection_reason
            transfer.save()
            return Response({
                'message' : 'Transfer rejected',
                'transfer': TransferRequestSerializer(transfer).data,
            })


class CompleteTransferView(APIView):
    """
    POST /api/patients/transfers/<id>/complete/
    Called by receiving hospital's reception once the patient
    physically arrives and is admitted.

    This will:
      1. Mark transfer as completed
      2. Discharge patient from source hospital bed
      3. Let receiving hospital's reception admit to new bed
    """
    permission_classes = [IsReception]

    def post(self, request, pk):
        try:
            transfer = TransferRequest.objects.select_related(
                'patient', 'from_hospital', 'to_hospital'
            ).get(
                pk=pk,
                status=TransferRequest.Status.ACCEPTED,
                to_hospital=request.user.hospital
            )
        except TransferRequest.DoesNotExist:
            return Response(
                {'error': 'Accepted transfer not found for your hospital'},
                status=status.HTTP_404_NOT_FOUND
            )

        # discharge patient from source hospital bed
        active_allocation = BedAllocation.objects.filter(
            patient=transfer.patient,
            bed__hospital=transfer.from_hospital,
            discharged_at__isnull=True
        ).first()

        if active_allocation:
            active_allocation.discharged_at = timezone.now()
            active_allocation.notes = f'Transferred to {transfer.to_hospital.name}'
            active_allocation.save()

            # free the bed at source hospital
            source_bed = active_allocation.bed
            source_bed.status = Bed.BedStatus.AVAILABLE
            source_bed.save(update_fields=['status', 'last_updated'])

            # invalidate source hospital's bed cache
            invalidate_bed_cache(
                transfer.from_hospital.id,
                source_bed.department_id
            )

        # mark transfer complete
        transfer.status       = TransferRequest.Status.COMPLETED
        transfer.completed_at = timezone.now()
        transfer.save()

        return Response({
            'message': 'Transfer completed. Patient discharged from source hospital.',
            'next'   : 'Now admit the patient to a bed at your hospital using POST /api/beds/admit/',
        })


class TransferRequestDetailView(generics.RetrieveAPIView):
    """
    GET /api/patients/transfers/<id>/
    Full detail of a single transfer request.
    """
    permission_classes = [IsStaffMember]
    serializer_class   = TransferRequestSerializer

    def get_queryset(self):
        return TransferRequest.objects.select_related(
            'patient', 'from_hospital', 'to_hospital',
            'requested_by', 'accepted_by'
        )


class AllTransfersView(generics.ListAPIView):
    """
    GET /api/patients/transfers/all/
    Supervisor sees all transfers across all hospitals.
    Supports: ?status=pending &priority=critical &from_hospital=<id>
    """
    permission_classes = [IsSupervisor]
    serializer_class   = TransferRequestSerializer
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status', 'priority', 'from_hospital', 'to_hospital']
    ordering_fields    = ['requested_at', 'responded_at', 'priority']

    def get_queryset(self):
        return TransferRequest.objects.select_related(
            'patient', 'from_hospital', 'to_hospital',
            'requested_by', 'accepted_by'
        )


# ─────────────────────────────────────────────────────────────
#  Emergency Triage Views (Phase 1 & 2)
#  NOTE: These views now delegate to apps/triage/ for AI logic.
#  The old keyword triage_engine.py is kept for the /triage/severity/
#  endpoint (used by EmergencyPortal step-by-step flow) but
#  create_emergency_case_view now uses the full AI pipeline.
# ─────────────────────────────────────────────────────────────

from rest_framework.decorators import api_view, permission_classes as drf_permission_classes
from .triage_engine import compute_severity, SEVERITY_TO_PRIORITY


@api_view(['POST'])
@drf_permission_classes([AllowAny])
def triage_severity_view(request):
    """
    POST /api/patients/triage/severity/

    Enhanced: now uses unified AI triage when symptoms_text is provided alone
    (no doctor_category required). Falls back to rules engine if doctor_category
    is given explicitly for backward compatibility with EmergencyPortal.

    Body (new style — AI path):
        { "symptoms_text": "severe chest pain radiating to arm" }

    Body (legacy style — rules engine path):
        { "doctor_category": "Cardiology", "symptoms_text": "chest pain" }
    """
    doctor_category = request.data.get('doctor_category', '').strip()
    symptoms_text   = request.data.get('symptoms_text', '').strip()
    age             = request.data.get('age', None)
    gender          = request.data.get('gender', None)

    # ── If no doctor_category, use the full AI triage pipeline ───────────────
    if not doctor_category and symptoms_text:
        try:
            from apps.triage.unified_triage import unified_analyze
            patient_age = None
            if age:
                try:
                    patient_age = int(age)
                except (ValueError, TypeError):
                    pass

            ai_result = unified_analyze(
                symptoms_text=symptoms_text,
                patient_age=patient_age,
                patient_gender=gender,
            )
            # Return in the shape expected by EmergencyPortal (p_level, description etc.)
            return Response({
                'p_level':     ai_result['p_level'],
                'priority':    {'P1': 'CRITICAL', 'P2': 'HIGH', 'P3': 'MEDIUM', 'P4': 'LOW'}.get(ai_result['p_level'], 'HIGH'),
                'label':       ai_result.get('severity_label', ''),
                'color':       {'P1': '#E24B4A', 'P2': '#EF9F27', 'P3': '#378ADD', 'P4': '#639922'}.get(ai_result['p_level'], '#EF9F27'),
                'description': ai_result.get('reasoning', ''),
                'escalated':   ai_result.get('was_escalated', False),
                # Pass through full AI fields too
                'doctor_category':   ai_result.get('doctor_category', 'Emergency'),
                'red_flags':         ai_result.get('red_flags', []),
                'possible_conditions': ai_result.get('possible_conditions', []),
                'requires_ambulance': ai_result.get('requires_ambulance', False),
                'requires_icu':       ai_result.get('requires_icu', False),
                'confidence':         ai_result.get('confidence', 'MEDIUM'),
                'ai_powered':         True,
            }, status=200)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error(f'AI triage fallback: {exc}')
            # Fall through to rules engine

    # ── Legacy path: rules engine ─────────────────────────────────────────────
    if not doctor_category:
        return Response({'error': 'doctor_category or symptoms_text is required'}, status=400)

    result = compute_severity(doctor_category, symptoms_text)
    result['ai_powered'] = False
    return Response(result, status=200)


@api_view(['POST'])
@drf_permission_classes([AllowAny])
def create_emergency_case_view(request):
    """
    POST /api/patients/triage/create-case/

    UPDATED: This view now delegates to the full AI pipeline in
    apps/triage/views.create_emergency_case_view which:
      1. Runs unified AI triage (not the keyword rules engine)
      2. Builds a care needs profile
      3. Ranks hospitals by composite capability score
      4. Generates an AI routing explanation
      5. Persists to the EmergencyCase model
      6. Broadcasts via WebSocket

    The request body is forwarded as-is. Supports both:
      - Old style: { "doctor_category": "Cardiology", "symptoms_text": "..." }
      - New style: { "symptoms_text": "..." }  (doctor_category auto-detected by AI)
    """
    from apps.triage.views import create_emergency_case_view as ai_create_view
    return ai_create_view(request._request)