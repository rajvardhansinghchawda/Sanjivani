# apps/supervisors/views.py
from django.utils import timezone
from django.db.models import Q, Count, Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSupervisor, IsStaffMember, IsAdminUser
from apps.hospitals.models import Hospital
from apps.beds.models import Bed, BedAllocation
from apps.patients.models import TransferRequest
from .models import Alert, ResourceAvailability
from .serializers import (
    AlertSerializer, CreateAlertSerializer, ResolveAlertSerializer,
    ResourceAvailabilitySerializer, HospitalMonitorSerializer,
)
from apps.beds.models import Bed, BedAllocation
from apps.beds.cache import invalidate_bed_cache
from apps.patients.models import Patient


# ─────────────────────────────────────────────────────────────
#  Supervisor dashboard
# ─────────────────────────────────────────────────────────────

class SupervisorDashboardView(APIView):
    """
    GET /api/supervisor/dashboard/
    Platform-wide overview card for every hospital.
    Shows: bed status, open alerts, pending transfers,
    long-occupancy beds — all in one response.
    """
    permission_classes = [IsSupervisor]

    def get(self, request):
        hospitals = Hospital.objects.filter(
            status=Hospital.Status.ACTIVE
        ).prefetch_related('beds', 'alerts')

        cards = []
        long_threshold = timezone.now() - timezone.timedelta(days=20)

        for hospital in hospitals:
            beds = hospital.beds.filter(is_active=True)

            total_beds     = beds.count()
            available_beds = beds.filter(status='available').count()
            occupied_beds  = beds.filter(status='occupied').count()

            open_alerts = Alert.objects.filter(
                hospital=hospital,
                status=Alert.Status.OPEN
            ).count()

            high_alerts = Alert.objects.filter(
                hospital=hospital,
                status=Alert.Status.OPEN,
                severity=Alert.Severity.HIGH
            ).count()

            pending_transfers = TransferRequest.objects.filter(
                from_hospital=hospital,
                status=TransferRequest.Status.PENDING
            ).count()

            long_occupancy_beds = BedAllocation.objects.filter(
                bed__hospital=hospital,
                discharged_at__isnull=True,
                admitted_at__lte=long_threshold
            ).count()

            cards.append({
                'hospital_id'        : str(hospital.id),
                'hospital_name'      : hospital.name,
                'city'               : hospital.city,
                'verification_status': hospital.verification_status,
                'total_beds'         : total_beds,
                'available_beds'     : available_beds,
                'occupied_beds'      : occupied_beds,
                'open_alerts'        : open_alerts,
                'high_alerts'        : high_alerts,
                'pending_transfers'  : pending_transfers,
                'long_occupancy_beds': long_occupancy_beds,
            })

        # sort: hospitals with high alerts first
        cards.sort(key=lambda x: (-x['high_alerts'], -x['open_alerts']))

        return Response({
            'total_hospitals': len(cards),
            'hospitals'      : cards,
        })


class AlertSummaryView(APIView):
    """
    GET /api/supervisor/alerts/summary/
    Quick counts by severity and type — for the
    supervisor's top-bar stat widgets.
    """
    permission_classes = [IsSupervisor]

    def get(self, request):
        open_alerts = Alert.objects.filter(status=Alert.Status.OPEN)

        return Response({
            'total_open'      : open_alerts.count(),
            'high'            : open_alerts.filter(severity='high').count(),
            'medium'          : open_alerts.filter(severity='medium').count(),
            'low'             : open_alerts.filter(severity='low').count(),
            'by_type'         : {
                item['alert_type']: item['count']
                for item in open_alerts.values('alert_type').annotate(count=Count('id'))
            },
            'investigating'   : Alert.objects.filter(status=Alert.Status.INVESTIGATING).count(),
            'resolved_today'  : Alert.objects.filter(
                status=Alert.Status.RESOLVED,
                resolved_at__date=timezone.now().date()
            ).count(),
        })


# ─────────────────────────────────────────────────────────────
#  Alert CRUD
# ─────────────────────────────────────────────────────────────

class AlertListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/supervisor/alerts/          → all alerts with filters
    POST /api/supervisor/alerts/          → manually raise an alert
    Supports: ?status=open &severity=high &hospital=<id>
              &alert_type=bed_long_occupancy &ordering=-created_at
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields= ['status', 'severity', 'alert_type', 'hospital']
    search_fields   = ['title', 'description', 'hospital__name']
    ordering_fields = ['created_at', 'severity', 'status']
    ordering        = ['-created_at']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsStaffMember()]
        return [IsSupervisor()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateAlertSerializer
        return AlertSerializer

    def get_queryset(self):
        return Alert.objects.select_related(
            'hospital', 'raised_by', 'resolved_by',
            'bed', 'department'
        )

    def create(self, request, *args, **kwargs):
        serializer = CreateAlertSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        alert = serializer.save()
        return Response(
            AlertSerializer(alert).data,
            status=status.HTTP_201_CREATED
        )


class AlertDetailView(generics.RetrieveAPIView):
    """
    GET /api/supervisor/alerts/<id>/
    Full alert detail including meta_data.
    """
    permission_classes = [IsStaffMember]
    serializer_class   = AlertSerializer

    def get_queryset(self):
        return Alert.objects.select_related(
            'hospital', 'raised_by', 'resolved_by', 'bed', 'department'
        )


class ResolveAlertView(APIView):
    """
    POST /api/supervisor/alerts/<id>/resolve/
    Supervisor moves alert through its status lifecycle.

    Actions:
      investigate → status = INVESTIGATING
      resolve     → status = RESOLVED (requires resolution_note)
      dismiss     → status = DISMISSED
    """
    permission_classes = [IsSupervisor]

    def post(self, request, pk):
        try:
            alert = Alert.objects.get(pk=pk)
        except Alert.DoesNotExist:
            return Response({'error': 'Alert not found'}, status=404)

        if alert.status in [Alert.Status.RESOLVED, Alert.Status.DISMISSED]:
            return Response(
                {'error': f'Alert is already {alert.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ResolveAlertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action          = serializer.validated_data['action']
        resolution_note = serializer.validated_data.get('resolution_note', '')

        if action == 'investigate':
            alert.status = Alert.Status.INVESTIGATING

        elif action == 'resolve':
            alert.status          = Alert.Status.RESOLVED
            alert.resolved_by     = request.user
            alert.resolved_at     = timezone.now()
            alert.resolution_note = resolution_note

        elif action == 'dismiss':
            alert.status          = Alert.Status.DISMISSED
            alert.resolved_by     = request.user
            alert.resolved_at     = timezone.now()
            alert.resolution_note = resolution_note

        alert.save()

        return Response({
            'message': f'Alert {action}d successfully',
            'alert'  : AlertSerializer(alert).data,
        })


class HospitalAlertsView(generics.ListAPIView):
    """
    GET /api/supervisor/alerts/hospital/<hospital_id>/
    All alerts for a specific hospital.
    Supervisor and reception of that hospital can see this.
    """
    serializer_class = AlertSerializer
    permission_classes = [IsStaffMember]
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'severity', 'alert_type']
    ordering_fields  = ['created_at']

    def get_queryset(self):
        return Alert.objects.filter(
            hospital_id=self.kwargs['hospital_id']
        ).select_related('raised_by', 'resolved_by', 'bed', 'department')


# ─────────────────────────────────────────────────────────────
#  Long occupancy monitoring
# ─────────────────────────────────────────────────────────────

class LongOccupancyMonitorView(APIView):
    """
    GET /api/supervisor/long-occupancy/
    All currently occupied beds past the threshold.
    Supports: ?days=20 &hospital=<id>
    """
    permission_classes = [IsSupervisor]

    def get(self, request):
        days      = int(request.query_params.get('days', 20))
        hospital  = request.query_params.get('hospital')
        threshold = timezone.now() - timezone.timedelta(days=days)

        qs = BedAllocation.objects.filter(
            discharged_at__isnull=True,
            admitted_at__lte=threshold
        ).select_related(
            'bed__hospital', 'bed__department', 'patient', 'allocated_by'
        )

        if hospital:
            qs = qs.filter(bed__hospital_id=hospital)

        results = []
        for alloc in qs:
            occ_days = (timezone.now() - alloc.admitted_at).days
            results.append({
                'allocation_id'  : str(alloc.id),
                'bed_id'         : str(alloc.bed.id),
                'bed_number'     : alloc.bed.bed_number,
                'bed_type'       : alloc.bed.bed_type,
                'hospital_id'    : str(alloc.bed.hospital.id),
                'hospital_name'  : alloc.bed.hospital.name,
                'department_name': alloc.bed.department.name if alloc.bed.department else None,
                'patient_id'     : str(alloc.patient.id),
                'patient_name'   : alloc.patient.full_name,
                'patient_phone'  : alloc.patient.phone,
                'admitted_at'    : alloc.admitted_at,
                'days_occupied'  : occ_days,
                'severity'       : 'high' if occ_days > 30 else 'medium',
            })

        results.sort(key=lambda x: -x['days_occupied'])

        return Response({
            'threshold_days': days,
            'total'         : len(results),
            'beds'          : results,
        })


# ─────────────────────────────────────────────────────────────
#  Resource Availability tracking
# ─────────────────────────────────────────────────────────────

class ResourceAvailabilityListView(generics.ListCreateAPIView):
    """
    GET  /api/supervisor/resources/              → list snapshots
    POST /api/supervisor/resources/              → reception logs a snapshot
    Supports: ?hospital=<id> &resource_type=bed &availability_status=limited
    """
    serializer_class = ResourceAvailabilitySerializer
    filter_backends  = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['hospital', 'resource_type', 'availability_status', 'department']
    ordering_fields  = ['recorded_at']

    def get_permissions(self):
        from core.permissions import IsReception
        if self.request.method == 'POST':
            return [IsReception()]
        return [IsStaffMember()]

    def get_queryset(self):
        return ResourceAvailability.objects.select_related(
            'hospital', 'department', 'updated_by'
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return Response(
            ResourceAvailabilitySerializer(obj).data,
            status=status.HTTP_201_CREATED
        )


class LatestResourceStatusView(APIView):
    """
    GET /api/supervisor/resources/latest/<hospital_id>/
    Latest snapshot of every resource type for a hospital.
    Supervisor uses this to compare against live DB counts.
    """
    permission_classes = [IsStaffMember]

    def get(self, request, hospital_id):
        resource_types = ResourceAvailability.ResourceType.values
        result = {}

        for rtype in resource_types:
            latest = ResourceAvailability.objects.filter(
                hospital_id=hospital_id,
                resource_type=rtype
            ).order_by('-recorded_at').first()

            if latest:
                result[rtype] = {
                    'total'              : latest.total_count,
                    'available'          : latest.available_count,
                    'availability_status': latest.availability_status,
                    'recorded_at'        : latest.recorded_at,
                    'updated_by'         : latest.updated_by.full_name if latest.updated_by else None,
                }

        return Response({
            'hospital_id': str(hospital_id),
            'resources'  : result,
        })


# ─────────────────────────────────────────────────────────────
#  Hospital verification
# ─────────────────────────────────────────────────────────────

class PendingVerificationsView(generics.ListAPIView):
    """
    GET /api/supervisor/verifications/pending/
    All hospitals awaiting verification.
    """
    permission_classes = [IsSupervisor]

    def get(self, request):
        from apps.hospitals.models import HospitalRegistration
        from apps.hospitals.serializers import HospitalRegistrationSerializer

        pending = HospitalRegistration.objects.filter(
            status='pending'
        ).select_related('hospital', 'verified_by').order_by('registration_date')

        from apps.hospitals.serializers import HospitalRegistrationSerializer
        return Response({
            'count'  : pending.count(),
            'pending': HospitalRegistrationSerializer(pending, many=True).data,
        })


# ─────────────────────────────────────────────────────────────
#  Manual Celery task triggers (for testing / on-demand runs)
# ─────────────────────────────────────────────────────────────

class TriggerChecksView(APIView):
    """
    POST /api/supervisor/run-checks/
    Admin or supervisor manually triggers all auto-checks.
    Useful for testing or running outside schedule.
    Body: { "check": "long_occupancy" | "mismatches" | "transfers" | "all" }
    """
    permission_classes = [IsSupervisor]

    def post(self, request):
        from .tasks import (
            check_long_occupancy_beds,
            check_resource_mismatches,
            check_pending_hospital_verifications,
            check_transfer_delays,
        )

        check = request.data.get('check', 'all')
        results = {}

        if check in ['long_occupancy', 'all']:
            results['long_occupancy'] = check_long_occupancy_beds.delay().id

        if check in ['mismatches', 'all']:
            results['mismatches'] = check_resource_mismatches.delay().id

        if check in ['verifications', 'all']:
            results['verifications'] = check_pending_hospital_verifications.delay().id

        if check in ['transfers', 'all']:
            results['transfers'] = check_transfer_delays.delay().id

        return Response({
            'message'  : 'Checks triggered successfully',
            'task_ids' : results,
        })

class SupervisorBedCorrectionView(APIView):
    """
    PATCH /api/supervisor/correct/bed/<bed_id>/
    Supervisor directly corrects a bed's status and notes
    after physical verification at the hospital.

    Every correction is automatically logged as a
    RESOLVED alert so there is a full audit trail.

    Body:
    {
      "status"         : "available",
      "notes"          : "Bed was incorrectly marked occupied — verified on site",
      "correction_reason": "Patient discharged 2 days ago, reception did not update"
    }
    """
    permission_classes = [IsSupervisor]

    def patch(self, request, bed_id):
        try:
            bed = Bed.objects.select_related(
                'hospital', 'department'
            ).get(pk=bed_id)
        except Bed.DoesNotExist:
            return Response({'error': 'Bed not found'}, status=404)

        new_status        = request.data.get('status')
        notes             = request.data.get('notes', '')
        correction_reason = request.data.get('correction_reason', '')

        valid_statuses = [s.value for s in Bed.BedStatus]
        if new_status and new_status not in valid_statuses:
            return Response(
                {'error': f'Invalid status. Choose from: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = bed.status

        # apply correction
        if new_status:
            bed.status = new_status
        if notes:
            bed.notes = notes
        bed.save(update_fields=['status', 'notes', 'last_updated'])

        # invalidate Redis cache for this hospital
        invalidate_bed_cache(bed.hospital_id, bed.department_id)

        # if bed is corrected to available but allocation is still open — close it
        if new_status == Bed.BedStatus.AVAILABLE:
            open_alloc = BedAllocation.objects.filter(
                bed=bed,
                discharged_at__isnull=True
            ).first()
            if open_alloc:
                from django.utils import timezone
                open_alloc.discharged_at = timezone.now()
                open_alloc.notes = f'[Supervisor correction] {correction_reason}'
                open_alloc.save(update_fields=['discharged_at', 'notes'])

        # auto-create a resolved audit alert
        Alert.objects.create(
            hospital    = bed.hospital,
            bed         = bed,
            department  = bed.department,
            raised_by   = request.user,
            resolved_by = request.user,
            alert_type  = Alert.AlertType.DATA_INCONSISTENCY,
            severity    = Alert.Severity.HIGH,
            status      = Alert.Status.RESOLVED,
            title       = f'Supervisor corrected bed {bed.bed_number}',
            description = (
                f'Supervisor {request.user.full_name} corrected bed '
                f'{bed.bed_number} from {old_status} → {new_status or old_status}. '
                f'Reason: {correction_reason}'
            ),
            resolution_note = correction_reason,
            resolved_at     = timezone.now(),
            meta_data = {
                'bed_id'          : str(bed.id),
                'bed_number'      : bed.bed_number,
                'old_status'      : old_status,
                'new_status'      : new_status,
                'correction_reason': correction_reason,
            }
        )

        return Response({
            'message'          : 'Bed corrected successfully',
            'bed_number'       : bed.bed_number,
            'hospital'         : bed.hospital.name,
            'old_status'       : old_status,
            'new_status'       : new_status or old_status,
            'audit_alert'      : 'Created automatically',
        })


class SupervisorPatientCorrectionView(APIView):
    """
    PATCH /api/supervisor/correct/patient/<patient_id>/
    Supervisor corrects patient details after verification.
    Covers cases like:
      - Wrong name / phone entered by reception
      - Medical info needs update after supervisor visit
      - Flagged record needs correction

    Body: any subset of Patient fields to update.
    All changes are logged as a resolved audit alert.
    """
    permission_classes = [IsSupervisor]

    def patch(self, request, patient_id):
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found'}, status=404)

        correction_reason = request.data.pop('correction_reason', 'Supervisor correction')

        # fields supervisor is allowed to correct
        allowed_fields = [
            'full_name', 'phone', 'email', 'age',
            'gender', 'blood_group', 'address',
            'city', 'area',
            'emergency_contact_name', 'emergency_contact_phone',
            'known_allergies', 'chronic_conditions',
        ]

        changes = {}
        for field in allowed_fields:
            if field in request.data:
                old_val = getattr(patient, field)
                new_val = request.data[field]
                if str(old_val) != str(new_val):
                    changes[field] = {'from': old_val, 'to': new_val}
                    setattr(patient, field, new_val)

        if not changes:
            return Response(
                {'message': 'No changes detected'},
                status=status.HTTP_200_OK
            )

        patient.save()

        # find the hospital this patient is currently admitted to
        # for audit alert association
        active_alloc = BedAllocation.objects.filter(
            patient=patient,
            discharged_at__isnull=True
        ).select_related('bed__hospital').first()

        hospital = active_alloc.bed.hospital if active_alloc else None

        if hospital:
            Alert.objects.create(
                hospital    = hospital,
                raised_by   = request.user,
                resolved_by = request.user,
                alert_type  = Alert.AlertType.DATA_INCONSISTENCY,
                severity    = Alert.Severity.MEDIUM,
                status      = Alert.Status.RESOLVED,
                title       = f'Supervisor corrected patient record: {patient.full_name}',
                description = (
                    f'Supervisor {request.user.full_name} corrected patient '
                    f'{patient.full_name} record. '
                    f'Reason: {correction_reason}. '
                    f'Fields changed: {list(changes.keys())}'
                ),
                resolution_note = correction_reason,
                resolved_at     = timezone.now(),
                meta_data = {
                    'patient_id'       : str(patient.id),
                    'patient_name'     : patient.full_name,
                    'changes'          : changes,
                    'correction_reason': correction_reason,
                }
            )

        return Response({
            'message'          : 'Patient record corrected successfully',
            'patient_id'       : str(patient.id),
            'patient_name'     : patient.full_name,
            'fields_corrected' : list(changes.keys()),
            'changes'          : changes,
            'audit_alert'      : 'Created automatically' if hospital else 'Skipped — patient not currently admitted',
        })


class SupervisorAllocationCorrectionView(APIView):
    """
    PATCH /api/supervisor/correct/allocation/<allocation_id>/
    Supervisor corrects a bed allocation record.
    Common use case: reception forgot to discharge a patient —
    supervisor finds the bed still marked occupied on visit.

    Body:
    {
      "action"           : "force_discharge" | "correct_admission_date",
      "discharged_at"    : "2024-01-15T10:00:00",   # for force_discharge
      "admitted_at"      : "2024-01-10T09:00:00",   # for correct_admission_date
      "correction_reason": "Patient left hospital 3 days ago per nursing records"
    }
    """
    permission_classes = [IsSupervisor]

    def patch(self, request, allocation_id):
        try:
            allocation = BedAllocation.objects.select_related(
                'bed__hospital', 'bed__department', 'patient'
            ).get(pk=allocation_id)
        except BedAllocation.DoesNotExist:
            return Response({'error': 'Allocation not found'}, status=404)

        action            = request.data.get('action')
        correction_reason = request.data.get('correction_reason', 'Supervisor correction')

        if action not in ['force_discharge', 'correct_admission_date']:
            return Response(
                {'error': 'action must be force_discharge or correct_admission_date'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bed     = allocation.bed
        patient = allocation.patient
        changes = {}

        if action == 'force_discharge':
            if allocation.discharged_at:
                return Response(
                    {'error': 'Allocation already has a discharge date'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            discharged_at_str = request.data.get('discharged_at')
            try:
                from django.utils.dateparse import parse_datetime
                discharged_at = parse_datetime(discharged_at_str) if discharged_at_str else timezone.now()
            except Exception:
                discharged_at = timezone.now()

            old_val                   = allocation.discharged_at
            allocation.discharged_at  = discharged_at
            allocation.notes          = f'[Supervisor force discharge] {correction_reason}'
            allocation.save(update_fields=['discharged_at', 'notes'])

            # free the bed
            old_bed_status = bed.status
            bed.status     = Bed.BedStatus.AVAILABLE
            bed.save(update_fields=['status', 'last_updated'])

            # invalidate Redis cache
            invalidate_bed_cache(bed.hospital_id, bed.department_id)

            changes = {
                'discharged_at' : {'from': str(old_val), 'to': str(discharged_at)},
                'bed_status'    : {'from': old_bed_status, 'to': 'available'},
            }

        elif action == 'correct_admission_date':
            admitted_at_str = request.data.get('admitted_at')
            if not admitted_at_str:
                return Response(
                    {'error': 'admitted_at is required for correct_admission_date'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            from django.utils.dateparse import parse_datetime
            new_admitted = parse_datetime(admitted_at_str)
            if not new_admitted:
                return Response({'error': 'Invalid admitted_at format'}, status=400)

            old_val              = allocation.admitted_at
            allocation.admitted_at = new_admitted
            allocation.save(update_fields=['admitted_at'])

            changes = {
                'admitted_at': {'from': str(old_val), 'to': str(new_admitted)}
            }

        # auto audit alert
        Alert.objects.create(
            hospital    = bed.hospital,
            bed         = bed,
            department  = bed.department,
            raised_by   = request.user,
            resolved_by = request.user,
            alert_type  = Alert.AlertType.DATA_INCONSISTENCY,
            severity    = Alert.Severity.HIGH,
            status      = Alert.Status.RESOLVED,
            title       = f'Supervisor corrected allocation — {patient.full_name} / Bed {bed.bed_number}',
            description = (
                f'Supervisor {request.user.full_name} performed {action} on '
                f'allocation for patient {patient.full_name} in bed {bed.bed_number}. '
                f'Reason: {correction_reason}'
            ),
            resolution_note = correction_reason,
            resolved_at     = timezone.now(),
            meta_data = {
                'allocation_id'    : str(allocation.id),
                'action'           : action,
                'patient_id'       : str(patient.id),
                'patient_name'     : patient.full_name,
                'bed_number'       : bed.bed_number,
                'changes'          : changes,
                'correction_reason': correction_reason,
            }
        )

        return Response({
            'message'    : f'{action.replace("_", " ").title()} completed successfully',
            'allocation' : str(allocation.id),
            'patient'    : patient.full_name,
            'bed_number' : bed.bed_number,
            'changes'    : changes,
            'audit_alert': 'Created automatically',
        })