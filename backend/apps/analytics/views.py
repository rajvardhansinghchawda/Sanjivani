# apps/analytics/views.py
import csv
import io
from datetime import timedelta

from django.db.models import (
    Count, Avg, Sum, Q, F,
    FloatField, ExpressionWrapper
)
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsAdminUser, IsSupervisor, IsStaffMember
from apps.hospitals.models import Hospital
from apps.beds.models import Bed, BedAllocation
from apps.patients.models import Patient, TransferRequest
from apps.ambulances.models import Ambulance, AmbulanceRequest
from apps.supervisors.models import Alert
from .helpers import parse_date_range


def _pdf_escape(text):
    return str(text).replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _chunked(items, size):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def _build_pdf_response(title, subtitle, summary_lines, rows, filename):
    page_width = 842
    page_height = 595
    left_margin = 36
    top_margin = 536
    line_height = 14
    data_lines_per_page = 24

    if not rows:
        rows = ['No records found for the selected period.']

    pages = []
    row_chunks = list(_chunked(rows, data_lines_per_page))
    total_pages = len(row_chunks)

    for page_index, chunk in enumerate(row_chunks, start=1):
        page_lines = [
            title,
            subtitle,
            *summary_lines,
            '',
            'Patient | Phone | Hospital | Bed | Type | Admitted | Discharged | Days | Status',
            *chunk,
            '',
            f'Page {page_index} of {total_pages}',
        ]

        text_commands = ['BT', '/F1 10 Tf']
        current_y = top_margin

        for line_number, line in enumerate(page_lines):
            font_size = 12 if line_number == 0 else 10 if line_number < 5 else 9
            text_commands.append(f'/F1 {font_size} Tf')
            text_commands.append(f'1 0 0 1 {left_margin} {current_y} Tm')
            text_commands.append(f'({_pdf_escape(line)}) Tj')
            current_y -= 18 if line_number == 0 else line_height

        text_commands.append('ET')
        stream = '\n'.join(text_commands).encode('latin-1', 'replace')
        pages.append(stream)

    objects = []
    catalog_obj = 1
    pages_obj = 2
    font_obj = 3 + (len(pages) * 2)

    objects.append(f'{catalog_obj} 0 obj\n<< /Type /Catalog /Pages {pages_obj} 0 R >>\nendobj\n'.encode('latin-1'))

    page_object_numbers = [3 + index * 2 for index in range(len(pages))]
    content_object_numbers = [4 + index * 2 for index in range(len(pages))]
    kids = ' '.join(f'{obj_num} 0 R' for obj_num in page_object_numbers)
    objects.append(
        f'{pages_obj} 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>\nendobj\n'.encode('latin-1')
    )

    for page_obj, content_obj, stream in zip(page_object_numbers, content_object_numbers, pages):
        page_object = (
            f'{page_obj} 0 obj\n'
            f'<< /Type /Page /Parent {pages_obj} 0 R /MediaBox [0 0 {page_width} {page_height}] '
            f'/Resources << /Font << /F1 {font_obj} 0 R >> >> /Contents {content_obj} 0 R >>\n'
            f'endobj\n'
        )
        objects.append(page_object.encode('latin-1'))

        content_object = (
            f'{content_obj} 0 obj\n'
            f'<< /Length {len(stream)} >>\nstream\n'.encode('latin-1')
            + stream
            + b'\nendstream\nendobj\n'
        )
        objects.append(content_object)

    objects.append(
        f'{font_obj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'.encode('latin-1')
    )

    pdf = bytearray(b'%PDF-1.4\n')
    offsets = [0]

    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_offset = len(pdf)
    pdf.extend(f'xref\n0 {len(objects) + 1}\n'.encode('latin-1'))
    pdf.extend(b'0000000000 65535 f \n')
    for offset in offsets[1:]:
        pdf.extend(f'{offset:010d} 00000 n \n'.encode('latin-1'))
    pdf.extend(
        (
            'trailer\n'
            f'<< /Size {len(objects) + 1} /Root {catalog_obj} 0 R >>\n'
            f'startxref\n{xref_offset}\n%%EOF\n'
        ).encode('latin-1')
    )

    response = HttpResponse(bytes(pdf), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


class AdherenceExportView(APIView):
    """
    GET /api/v1/adherence/export/?days=30&format=csv|pdf|json
    Exports recent admission activity for the requested window.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        days_raw = request.query_params.get('days', 30)
        export_format = (request.query_params.get('format') or 'pdf').lower()

        try:
            days = max(1, min(int(days_raw), 3650))
        except (TypeError, ValueError):
            days = 30

        end = timezone.now()
        start = end - timedelta(days=days)

        allocations = (
            BedAllocation.objects.filter(
                admitted_at__gte=start,
                admitted_at__lte=end,
            )
            .select_related('bed__hospital', 'bed__department', 'patient', 'allocated_by')
            .order_by('-admitted_at')
        )

        summary = {
            'total_records': allocations.count(),
            'active_admissions': allocations.filter(discharged_at__isnull=True).count(),
            'discharged_admissions': allocations.filter(discharged_at__isnull=False).count(),
            'unique_patients': allocations.values('patient_id').distinct().count(),
            'unique_hospitals': allocations.values('bed__hospital_id').distinct().count(),
        }

        records = []
        for allocation in allocations:
            records.append({
                'patient_name': allocation.patient.full_name,
                'patient_phone': allocation.patient.phone,
                'hospital_name': allocation.bed.hospital.name,
                'bed_number': allocation.bed.bed_number,
                'bed_type': allocation.bed.bed_type,
                'admitted_at': allocation.admitted_at.strftime('%Y-%m-%d %H:%M'),
                'discharged_at': allocation.discharged_at.strftime('%Y-%m-%d %H:%M') if allocation.discharged_at else 'Active',
                'duration_days': allocation.duration_days,
                'status': 'active' if allocation.discharged_at is None else 'discharged',
            })

        if export_format == 'json':
            return Response({
                'period_days': days,
                'generated_at': end,
                'summary': summary,
                'records': records[:500],
            })

        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="adherence_report_{days}_days.csv"'

            writer = csv.writer(response)
            writer.writerow([
                'Patient Name', 'Phone', 'Hospital', 'Bed Number', 'Bed Type',
                'Admitted At', 'Discharged At', 'Duration (days)', 'Status',
            ])
            for record in records:
                writer.writerow([
                    record['patient_name'],
                    record['patient_phone'],
                    record['hospital_name'],
                    record['bed_number'],
                    record['bed_type'],
                    record['admitted_at'],
                    record['discharged_at'],
                    record['duration_days'],
                    record['status'],
                ])
            return response

        row_lines = [
            ' | '.join([
                record['patient_name'],
                record['patient_phone'],
                record['hospital_name'],
                record['bed_number'],
                record['bed_type'],
                record['admitted_at'],
                record['discharged_at'],
                str(record['duration_days']),
                record['status'],
            ])
            for record in records
        ]

        subtitle = f'Last {days} days | Generated at {end.strftime("%Y-%m-%d %H:%M")}'
        summary_lines = [
            f'Total records: {summary["total_records"]} | Active: {summary["active_admissions"]} | Discharged: {summary["discharged_admissions"]}',
            f'Unique patients: {summary["unique_patients"]} | Unique hospitals: {summary["unique_hospitals"]}',
        ]
        return _build_pdf_response(
            'Adherence Report',
            subtitle,
            summary_lines,
            row_lines,
            f'adherence_report_{days}_days.pdf',
        )


# ─────────────────────────────────────────────────────────────
#  1. Platform-wide dashboard (admin top-level view)
# ─────────────────────────────────────────────────────────────

class PlatformDashboardView(APIView):
    """
    GET /api/analytics/dashboard/
    Top-level KPIs for the entire platform.
    Admin sees this on first login.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        now   = timezone.now()
        today = now.date()

        # ── hospital stats ────────────────────────────────────
        total_hospitals    = Hospital.objects.count()
        active_hospitals   = Hospital.objects.filter(status='active').count()
        verified_hospitals = Hospital.objects.filter(verification_status='verified').count()
        pending_verification = Hospital.objects.filter(verification_status='pending').count()

        # ── bed stats ─────────────────────────────────────────
        bed_qs = Bed.objects.filter(is_active=True)
        total_beds     = bed_qs.count()
        available_beds = bed_qs.filter(status='available').count()
        occupied_beds  = bed_qs.filter(status='occupied').count()
        occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds else 0

        # ── patient stats ─────────────────────────────────────
        total_patients     = Patient.objects.count()
        admitted_today     = BedAllocation.objects.filter(
            admitted_at__date=today
        ).count()
        discharged_today   = BedAllocation.objects.filter(
            discharged_at__date=today
        ).count()
        currently_admitted = BedAllocation.objects.filter(
            discharged_at__isnull=True
        ).count()

        # ── transfer stats ────────────────────────────────────
        total_transfers   = TransferRequest.objects.count()
        pending_transfers = TransferRequest.objects.filter(status='pending').count()
        completed_transfers_today = TransferRequest.objects.filter(
            completed_at__date=today
        ).count()

        # ── ambulance stats ───────────────────────────────────
        total_ambulances     = Ambulance.objects.filter(is_active=True).count()
        available_ambulances = Ambulance.objects.filter(status='available').count()
        trips_today = AmbulanceRequest.objects.filter(
            requested_at__date=today
        ).count()

        # ── alert stats ───────────────────────────────────────
        open_alerts = Alert.objects.filter(status='open').count()
        high_alerts = Alert.objects.filter(status='open', severity='high').count()

        return Response({
            'generated_at' : now,
            'hospitals'    : {
                'total'              : total_hospitals,
                'active'             : active_hospitals,
                'verified'           : verified_hospitals,
                'pending_verification': pending_verification,
            },
            'beds'         : {
                'total'         : total_beds,
                'available'     : available_beds,
                'occupied'      : occupied_beds,
                'occupancy_rate': occupancy_rate,
            },
            'patients'     : {
                'total'             : total_patients,
                'currently_admitted': currently_admitted,
                'admitted_today'    : admitted_today,
                'discharged_today'  : discharged_today,
            },
            'transfers'    : {
                'total'           : total_transfers,
                'pending'         : pending_transfers,
                'completed_today' : completed_transfers_today,
            },
            'ambulances'   : {
                'total'    : total_ambulances,
                'available': available_ambulances,
                'trips_today': trips_today,
            },
            'alerts'       : {
                'open': open_alerts,
                'high': high_alerts,
            },
        })


# ─────────────────────────────────────────────────────────────
#  2. Bed utilisation analysis
# ─────────────────────────────────────────────────────────────

class BedUtilisationView(APIView):
    """
    GET /api/analytics/beds/utilisation/
    Bed occupancy rates broken down by hospital, type, ward.
    Supports: ?from_date=2024-01-01 &to_date=2024-01-31
              &hospital=<id> &bed_type=icu
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request)
        hospital_id = request.query_params.get('hospital')
        bed_type    = request.query_params.get('bed_type')

        bed_qs = Bed.objects.filter(is_active=True)
        if hospital_id:
            bed_qs = bed_qs.filter(hospital_id=hospital_id)
        if bed_type:
            bed_qs = bed_qs.filter(bed_type=bed_type)

        # ── by hospital ───────────────────────────────────────
        by_hospital = bed_qs.values(
            'hospital__id', 'hospital__name', 'hospital__city'
        ).annotate(
            total    = Count('id'),
            available= Count('id', filter=Q(status='available')),
            occupied = Count('id', filter=Q(status='occupied')),
        ).order_by('-occupied')

        by_hospital_result = [
            {
                'hospital_id'   : str(row['hospital__id']),
                'hospital_name' : row['hospital__name'],
                'city'          : row['hospital__city'],
                'total'         : row['total'],
                'available'     : row['available'],
                'occupied'      : row['occupied'],
                'occupancy_rate': round(row['occupied'] / row['total'] * 100, 1) if row['total'] else 0,
            }
            for row in by_hospital
        ]

        # ── by bed type ───────────────────────────────────────
        by_type = bed_qs.values('bed_type').annotate(
            total    = Count('id'),
            available= Count('id', filter=Q(status='available')),
            occupied = Count('id', filter=Q(status='occupied')),
        )

        by_type_result = [
            {
                'bed_type'      : row['bed_type'],
                'total'         : row['total'],
                'available'     : row['available'],
                'occupied'      : row['occupied'],
                'occupancy_rate': round(row['occupied'] / row['total'] * 100, 1) if row['total'] else 0,
            }
            for row in by_type
        ]

        # ── average occupancy duration (in date range) ────────
        avg_duration = BedAllocation.objects.filter(
            admitted_at__gte=start,
            admitted_at__lte=end,
            discharged_at__isnull=False
        ).aggregate(
            avg_days=Avg(
                ExpressionWrapper(
                    F('discharged_at') - F('admitted_at'),
                    output_field=FloatField()
                )
            )
        )

        avg_days = round(
            (avg_duration['avg_days'] or 0) / 86400000000,  # microseconds → days
            1
        )

        return Response({
            'period'          : label,
            'by_hospital'     : by_hospital_result,
            'by_type'         : by_type_result,
            'avg_stay_days'   : avg_days,
        })


class BedOccupancyTrendView(APIView):
    """
    GET /api/analytics/beds/trend/
    Daily admissions and discharges over a period.
    Used to draw the time-series chart on admin dashboard.
    Supports: ?from_date= &to_date= &hospital=<id>
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request, default_days=30)
        hospital_id = request.query_params.get('hospital')

        alloc_qs = BedAllocation.objects.all()
        if hospital_id:
            alloc_qs = alloc_qs.filter(bed__hospital_id=hospital_id)

        # daily admissions
        admissions = (
            alloc_qs
            .filter(admitted_at__gte=start, admitted_at__lte=end)
            .annotate(day=TruncDay('admitted_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        # daily discharges
        discharges = (
            alloc_qs
            .filter(discharged_at__gte=start, discharged_at__lte=end)
            .annotate(day=TruncDay('discharged_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        adm_map = {str(r['day'].date()): r['count'] for r in admissions}
        dis_map = {str(r['day'].date()): r['count'] for r in discharges}

        # merge into unified day-by-day series
        all_days = sorted(set(list(adm_map.keys()) + list(dis_map.keys())))

        trend = [
            {
                'date'       : day,
                'admissions' : adm_map.get(day, 0),
                'discharges' : dis_map.get(day, 0),
            }
            for day in all_days
        ]

        return Response({'period': label, 'trend': trend})


# ─────────────────────────────────────────────────────────────
#  3. Admission & discharge reports
# ─────────────────────────────────────────────────────────────

class AdmissionReportView(APIView):
    """
    GET /api/analytics/admissions/
    Detailed admission report with patient-level data.
    Supports: ?from_date= &to_date= &hospital=<id>
              &bed_type=icu &export=csv
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request)
        hospital_id = request.query_params.get('hospital')
        bed_type    = request.query_params.get('bed_type')
        export      = request.query_params.get('export')

        qs = BedAllocation.objects.filter(
            admitted_at__gte=start,
            admitted_at__lte=end
        ).select_related(
            'bed__hospital', 'bed__department',
            'patient', 'allocated_by'
        )

        if hospital_id:
            qs = qs.filter(bed__hospital_id=hospital_id)
        if bed_type:
            qs = qs.filter(bed__bed_type=bed_type)

        qs = qs.order_by('-admitted_at')

        # ── CSV export ────────────────────────────────────────
        if export == 'csv':
            return self._export_csv(qs, label)

        # ── JSON response ─────────────────────────────────────
        summary = {
            'total_admissions': qs.count(),
            'still_admitted'  : qs.filter(discharged_at__isnull=True).count(),
            'discharged'      : qs.filter(discharged_at__isnull=False).count(),
        }

        records = [
            {
                'allocation_id'  : str(a.id),
                'patient_name'   : a.patient.full_name,
                'patient_phone'  : a.patient.phone,
                'hospital_name'  : a.bed.hospital.name,
                'bed_number'     : a.bed.bed_number,
                'bed_type'       : a.bed.bed_type,
                'department'     : a.bed.department.name if a.bed.department else None,
                'admitted_at'    : a.admitted_at,
                'discharged_at'  : a.discharged_at,
                'duration_days'  : a.duration_days,
                'admitted_by'    : a.allocated_by.full_name if a.allocated_by else None,
            }
            for a in qs[:500]   # cap at 500 rows for JSON
        ]

        return Response({
            'period' : label,
            'summary': summary,
            'records': records,
        })

    def _export_csv(self, qs, label):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="admissions_{label}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Patient Name', 'Phone', 'Hospital', 'Bed Number',
            'Bed Type', 'Department', 'Admitted At',
            'Discharged At', 'Duration (days)'
        ])

        for a in qs:
            writer.writerow([
                a.patient.full_name,
                a.patient.phone,
                a.bed.hospital.name,
                a.bed.bed_number,
                a.bed.bed_type,
                a.bed.department.name if a.bed.department else '',
                a.admitted_at.strftime('%Y-%m-%d %H:%M'),
                a.discharged_at.strftime('%Y-%m-%d %H:%M') if a.discharged_at else 'Still Admitted',
                a.duration_days,
            ])

        return response


# ─────────────────────────────────────────────────────────────
#  4. Transfer analysis
# ─────────────────────────────────────────────────────────────

class TransferAnalysisView(APIView):
    """
    GET /api/analytics/transfers/
    Transfer patterns — which hospitals send/receive most,
    common reasons, average response times.
    Supports: ?from_date= &to_date= &status= &priority=
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request)
        status_filter   = request.query_params.get('status')
        priority_filter = request.query_params.get('priority')

        qs = TransferRequest.objects.filter(
            requested_at__gte=start,
            requested_at__lte=end
        )
        if status_filter:
            qs = qs.filter(status=status_filter)
        if priority_filter:
            qs = qs.filter(priority=priority_filter)

        # ── summary ───────────────────────────────────────────
        summary = qs.aggregate(
            total     = Count('id'),
            pending   = Count('id', filter=Q(status='pending')),
            accepted  = Count('id', filter=Q(status='accepted')),
            completed = Count('id', filter=Q(status='completed')),
            rejected  = Count('id', filter=Q(status='rejected')),
            critical  = Count('id', filter=Q(priority='critical')),
        )

        # ── avg response time (minutes) ───────────────────────
        responded = qs.filter(responded_at__isnull=False)
        avg_response = None
        if responded.exists():
            total_sec = sum(
                (r.responded_at - r.requested_at).total_seconds()
                for r in responded
            )
            avg_response = round(total_sec / responded.count() / 60, 1)

        # ── top sending hospitals ─────────────────────────────
        top_senders = (
            qs.values('from_hospital__name', 'from_hospital__city')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # ── top receiving hospitals ───────────────────────────
        top_receivers = (
            qs.filter(to_hospital__isnull=False)
            .values('to_hospital__name', 'to_hospital__city')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # ── daily trend ───────────────────────────────────────
        daily = (
            qs.annotate(day=TruncDay('requested_at'))
            .values('day', 'status')
            .annotate(count=Count('id'))
            .order_by('day')
        )

        return Response({
            'period'          : label,
            'summary'         : summary,
            'avg_response_min': avg_response,
            'top_senders'     : list(top_senders),
            'top_receivers'   : list(top_receivers),
            'daily_trend'     : list(daily),
        })


# ─────────────────────────────────────────────────────────────
#  5. Hospital performance report
# ─────────────────────────────────────────────────────────────

class HospitalPerformanceView(APIView):
    """
    GET /api/analytics/hospitals/performance/
    Per-hospital scorecard:
      - occupancy rate
      - avg patient stay
      - transfers sent vs received
      - open alerts
      - ambulance trips served
    Supports: ?from_date= &to_date= &city= &category=
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request)
        city     = request.query_params.get('city')
        category = request.query_params.get('category')
        export   = request.query_params.get('export')

        hospitals = Hospital.objects.filter(
            status='active',
            verification_status='verified'
        )
        if city:
            hospitals = hospitals.filter(city__iexact=city)
        if category:
            hospitals = hospitals.filter(category=category)

        results = []

        for hospital in hospitals:
            beds = Bed.objects.filter(hospital=hospital, is_active=True)
            total_beds = beds.count()
            occupied   = beds.filter(status='occupied').count()
            occ_rate   = round(occupied / total_beds * 100, 1) if total_beds else 0

            # admissions in period
            admissions = BedAllocation.objects.filter(
                bed__hospital=hospital,
                admitted_at__gte=start,
                admitted_at__lte=end
            )
            total_admissions = admissions.count()

            # avg stay in days
            completed_stays = admissions.filter(discharged_at__isnull=False)
            avg_stay = None
            if completed_stays.exists():
                total_sec = sum(
                    (a.discharged_at - a.admitted_at).total_seconds()
                    for a in completed_stays
                )
                avg_stay = round(total_sec / completed_stays.count() / 86400, 1)

            # transfers
            transfers_sent     = TransferRequest.objects.filter(
                from_hospital=hospital,
                requested_at__gte=start
            ).count()
            transfers_received = TransferRequest.objects.filter(
                to_hospital=hospital,
                requested_at__gte=start
            ).count()

            # alerts
            open_alerts = Alert.objects.filter(
                hospital=hospital,
                status='open'
            ).count()

            # ambulance trips
            amb_trips = AmbulanceRequest.objects.filter(
                destination_hospital=hospital,
                requested_at__gte=start,
                status='completed'
            ).count()

            results.append({
                'hospital_id'       : str(hospital.id),
                'hospital_name'     : hospital.name,
                'city'              : hospital.city,
                'category'          : hospital.category,
                'total_beds'        : total_beds,
                'occupancy_rate'    : occ_rate,
                'total_admissions'  : total_admissions,
                'avg_stay_days'     : avg_stay,
                'transfers_sent'    : transfers_sent,
                'transfers_received': transfers_received,
                'open_alerts'       : open_alerts,
                'ambulance_trips'   : amb_trips,
            })

        results.sort(key=lambda x: -x['occupancy_rate'])

        if export == 'csv':
            return self._export_csv(results, label)

        return Response({
            'period'   : label,
            'count'    : len(results),
            'hospitals': results,
        })

    def _export_csv(self, results, label):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="hospital_performance_{label}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Hospital', 'City', 'Category', 'Total Beds',
            'Occupancy %', 'Admissions', 'Avg Stay (days)',
            'Transfers Sent', 'Transfers Received',
            'Open Alerts', 'Ambulance Trips',
        ])
        for r in results:
            writer.writerow([
                r['hospital_name'], r['city'], r['category'],
                r['total_beds'], r['occupancy_rate'],
                r['total_admissions'], r['avg_stay_days'],
                r['transfers_sent'], r['transfers_received'],
                r['open_alerts'], r['ambulance_trips'],
            ])
        return response


# ─────────────────────────────────────────────────────────────
#  6. Ambulance analytics
# ─────────────────────────────────────────────────────────────

class AmbulanceAnalyticsView(APIView):
    """
    GET /api/analytics/ambulances/
    Ambulance usage stats — trips, response times, ratings.
    Supports: ?from_date= &to_date= &city=
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request)
        city = request.query_params.get('city')

        qs = AmbulanceRequest.objects.filter(
            requested_at__gte=start,
            requested_at__lte=end
        )
        if city:
            qs = qs.filter(pickup_city__iexact=city)

        summary = qs.aggregate(
            total_requests  = Count('id'),
            completed       = Count('id', filter=Q(status='completed')),
            cancelled       = Count('id', filter=Q(status='cancelled')),
            avg_response_sec= Avg('response_time_sec'),
            avg_trip_sec    = Avg('trip_duration_sec'),
            avg_rating      = Avg('patient_rating'),
        )

        # response time in minutes
        avg_resp = summary.pop('avg_response_sec') or 0
        avg_trip = summary.pop('avg_trip_sec') or 0
        summary['avg_response_min'] = round(avg_resp / 60, 1)
        summary['avg_trip_min']     = round(avg_trip / 60, 1)
        summary['avg_rating']       = round(summary['avg_rating'] or 0, 2)

        # by ambulance type
        by_type = (
            qs.values('ambulance_type')
            .annotate(count=Count('id'), avg_resp=Avg('response_time_sec'))
            .order_by('-count')
        )

        # top ambulances by trips
        top_ambulances = (
            qs.filter(ambulance__isnull=False)
            .values(
                'ambulance__vehicle_number',
                'ambulance__driver_name',
                'ambulance__city',
            )
            .annotate(
                trips      = Count('id'),
                avg_rating = Avg('patient_rating'),
            )
            .order_by('-trips')[:10]
        )

        # daily trend
        daily = (
            qs.annotate(day=TruncDay('requested_at'))
            .values('day')
            .annotate(trips=Count('id'))
            .order_by('day')
        )

        return Response({
            'period'        : label,
            'summary'       : summary,
            'by_type'       : list(by_type),
            'top_ambulances': list(top_ambulances),
            'daily_trend'   : list(daily),
        })


# ─────────────────────────────────────────────────────────────
#  7. Service utilisation report
# ─────────────────────────────────────────────────────────────

class ServiceUtilisationView(APIView):
    """
    GET /api/analytics/services/
    Which services are offered most across hospitals.
    Useful for admin to decide which ServiceMaster entries
    to promote or add.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.hospitals.models import HospitalService, ServiceCategory

        # services by hospital count
        by_service = (
            HospitalService.objects
            .filter(is_available=True)
            .values('service__name', 'service__code', 'service__category__name')
            .annotate(hospital_count=Count('hospital', distinct=True))
            .order_by('-hospital_count')
        )

        # by category
        by_category = (
            HospitalService.objects
            .filter(is_available=True)
            .values('service__category__name')
            .annotate(
                total_services  = Count('service', distinct=True),
                total_hospitals = Count('hospital', distinct=True),
            )
            .order_by('-total_hospitals')
        )

        return Response({
            'by_service' : list(by_service),
            'by_category': list(by_category),
        })


# ─────────────────────────────────────────────────────────────
#  8. Alert analytics
# ─────────────────────────────────────────────────────────────

class AlertAnalyticsView(APIView):
    """
    GET /api/analytics/alerts/
    Alert frequency, resolution time, and patterns.
    Supports: ?from_date= &to_date=
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, label = parse_date_range(request)

        qs = Alert.objects.filter(created_at__gte=start, created_at__lte=end)

        summary = qs.aggregate(
            total     = Count('id'),
            open      = Count('id', filter=Q(status='open')),
            resolved  = Count('id', filter=Q(status='resolved')),
            dismissed = Count('id', filter=Q(status='dismissed')),
            high      = Count('id', filter=Q(severity='high')),
            medium    = Count('id', filter=Q(severity='medium')),
            low       = Count('id', filter=Q(severity='low')),
        )

        # avg resolution time in hours
        resolved_qs = qs.filter(status='resolved', resolved_at__isnull=False)
        avg_resolution = None
        if resolved_qs.exists():
            total_sec = sum(
                (a.resolved_at - a.created_at).total_seconds()
                for a in resolved_qs
            )
            avg_resolution = round(total_sec / resolved_qs.count() / 3600, 1)

        # by type
        by_type = (
            qs.values('alert_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # hospitals with most alerts
        by_hospital = (
            qs.values('hospital__name', 'hospital__city')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # weekly trend
        weekly = (
            qs.annotate(week=TruncWeek('created_at'))
            .values('week')
            .annotate(count=Count('id'))
            .order_by('week')
        )

        return Response({
            'period'              : label,
            'summary'             : summary,
            'avg_resolution_hours': avg_resolution,
            'by_type'             : list(by_type),
            'top_hospitals'       : list(by_hospital),
            'weekly_trend'        : list(weekly),
        })


# ─────────────────────────────────────────────────────────────
#  9. My hospital report (for reception / hospital admin)
# ─────────────────────────────────────────────────────────────

class MyHospitalReportView(APIView):
    """
    GET /api/analytics/my-hospital/
    Reception or hospital-level admin sees their
    own hospital's stats — not platform-wide.
    Supports: ?from_date= &to_date= &export=csv
    """
    permission_classes = [IsStaffMember]

    def get(self, request):
        hospital = request.user.hospital
        if not hospital:
            return Response(
                {'error': 'No hospital linked to your account'},
                status=400
            )

        start, end, label = parse_date_range(request)
        export = request.query_params.get('export')

        beds = Bed.objects.filter(hospital=hospital, is_active=True)
        total_beds = beds.count()
        occupied   = beds.filter(status='occupied').count()
        available  = beds.filter(status='available').count()

        allocations = BedAllocation.objects.filter(
            bed__hospital=hospital,
            admitted_at__gte=start,
            admitted_at__lte=end
        ).select_related('bed', 'patient', 'allocated_by')

        admitted    = allocations.count()
        discharged  = allocations.filter(discharged_at__isnull=False).count()
        still_in    = allocations.filter(discharged_at__isnull=True).count()

        transfers_out = TransferRequest.objects.filter(
            from_hospital=hospital,
            requested_at__gte=start
        ).count()

        transfers_in  = TransferRequest.objects.filter(
            to_hospital=hospital,
            requested_at__gte=start
        ).count()

        open_alerts = Alert.objects.filter(
            hospital=hospital,
            status='open'
        ).count()

        records = [
            {
                'patient_name' : a.patient.full_name,
                'patient_phone': a.patient.phone,
                'bed_number'   : a.bed.bed_number,
                'bed_type'     : a.bed.bed_type,
                'admitted_at'  : a.admitted_at,
                'discharged_at': a.discharged_at,
                'duration_days': a.duration_days,
            }
            for a in allocations.order_by('-admitted_at')[:200]
        ]

        if export == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = (
                f'attachment; filename="{hospital.name}_report_{label}.csv"'
            )
            writer = csv.writer(response)
            writer.writerow([
                'Patient Name', 'Phone', 'Bed', 'Type',
                'Admitted At', 'Discharged At', 'Duration (days)'
            ])
            for r in records:
                writer.writerow([
                    r['patient_name'], r['patient_phone'],
                    r['bed_number'], r['bed_type'],
                    r['admitted_at'], r['discharged_at'] or 'Active',
                    r['duration_days'],
                ])
            return response

        return Response({
            'hospital'       : hospital.name,
            'period'         : label,
            'beds'           : {
                'total'    : total_beds,
                'occupied' : occupied,
                'available': available,
                'occupancy_rate': round(occupied / total_beds * 100, 1) if total_beds else 0,
            },
            'patients'       : {
                'admitted'  : admitted,
                'discharged': discharged,
                'still_in'  : still_in,
            },
            'transfers'      : {
                'sent'    : transfers_out,
                'received': transfers_in,
            },
            'open_alerts'    : open_alerts,
            'records'        : records,
        })