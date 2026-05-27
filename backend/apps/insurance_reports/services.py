import logging
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from apps.telemetry.models import AdherenceEvent

logger = logging.getLogger('medadhere')

class AdherenceReportBuilder:
    """
    Builds a structured adherence report for a given share token.
    Respects the data_scope defined in the share.
    """
    def __init__(self, share):
        self.share = share
        self.patient = share.patient
        self.scope = share.data_scope or {}

    def build(self) -> dict:
        # Default window: 30 days unless specified
        days = self.scope.get('days', 30)
        start_date = timezone.now() - timedelta(days=days)

        events = AdherenceEvent.objects.filter(
            patient=self.patient,
            scheduled_at__gte=start_date
        ).select_related('schedule__prescription__medication')

        # Filter by medication if scoped
        med_ids = self.scope.get('medication_ids')
        if med_ids:
            events = events.filter(schedule__prescription__medication_id__in=med_ids)

        total = events.count()
        taken = events.filter(status='TAKEN').count()
        missed = events.filter(status='MISSED').count()
        skipped = events.filter(status='SKIPPED').count()

        adherence_rate = (taken / total * 100) if total > 0 else 0

        # Group by medication
        medication_breakdown = []
        med_stats = events.values(
            'schedule__prescription__medication__name'
        ).annotate(
            total=Count('id'),
            taken=Count('id', filter=Q(status='TAKEN')),
            missed=Count('id', filter=Q(status='MISSED'))
        )

        for ms in med_stats:
            medication_breakdown.append({
                'medication': ms['schedule__prescription__medication__name'],
                'total_doses': ms['total'],
                'taken': ms['taken'],
                'missed': ms['missed'],
                'rate': (ms['taken'] / ms['total'] * 100) if ms['total'] > 0 else 0
            })

        return {
            'report_id': str(self.share.id),
            'generated_at': timezone.now().isoformat(),
            'patient_name': self.patient.user.get_full_name() if not self.scope.get('anonymize') else "REDACTED",
            'window_days': days,
            'summary': {
                'total_doses': total,
                'taken': taken,
                'missed': missed,
                'skipped': skipped,
                'overall_adherence_rate': round(adherence_rate, 2),
            },
            'medication_breakdown': medication_breakdown,
            'status': 'VERIFIED' if adherence_rate >= 80 else 'UNSATISFACTORY',
        }
