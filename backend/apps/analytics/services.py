"""
apps/analytics/services.py — Data aggregation for caregivers and doctors.
"""
from django.utils import timezone
import datetime
from decimal import Decimal
from django.db.models import Count, Q, Avg


class CaregiverAnalyticsService:
    @staticmethod
    def get_dashboard_summary(caregiver) -> dict:
        """
        Returns high-level summary of all patients linked to the caregiver.
        - Total patients
        - Overall adherence (average of patients)
        - Patients requiring attention (< 70% adherence or open anomalies)
        """
        from apps.clinical.models import PatientCaregiverLink
        from apps.telemetry.models import Anomaly
        from apps.scheduling.models import AdherenceSummary

        active_links = PatientCaregiverLink.objects.filter(caregiver=caregiver, is_active=True).select_related('patient')
        patients     = [link.patient for link in active_links]
        
        if not patients:
            return {'total_patients': 0, 'overall_adherence_pct': 0, 'needs_attention': 0}
        
        # Check anomalies
        open_anomalies = Anomaly.objects.filter(
            patient__in=patients, is_resolved=False
        ).values_list('patient_id', flat=True).distinct()
        
        # Check adherence (last 7 days average per patient)
        since = timezone.now().date() - datetime.timedelta(days=7)
        needs_attention_count = len(open_anomalies)
        
        total_adherence = 0
        adherence_count = 0
        
        for p in patients:
            aggr = AdherenceSummary.objects.filter(
                patient=p, period_start__gte=since, period_type='daily'
            ).aggregate(
                avg_pct = Avg('adherence_pct')
            )
            val = aggr['avg_pct']
            if val is not None:
                total_adherence += float(val)
                adherence_count += 1
                if float(val) < 70 and p.id not in open_anomalies:
                    needs_attention_count += 1
                    
        overall = round(total_adherence / adherence_count, 1) if adherence_count > 0 else 0
        
        return {
            'total_patients': len(patients),
            'overall_adherence_pct': overall,
            'needs_attention': needs_attention_count,
        }

    @staticmethod
    def get_patient_cohort_list(caregiver):
        """
        Detailed list of linked patients with their 7-day adherence and anomaly count.
        """
        from apps.clinical.models import PatientCaregiverLink
        from apps.telemetry.models import Anomaly
        from apps.scheduling.models import AdherenceSummary
        
        links = PatientCaregiverLink.objects.filter(caregiver=caregiver, is_active=True).select_related('patient__user')
        since = timezone.now().date() - datetime.timedelta(days=7)
        
        results = []
        for link in links:
            p = link.patient
            aggr = AdherenceSummary.objects.filter(
                patient=p, period_start__gte=since, period_type='daily'
            ).aggregate(avg_pct=Avg('adherence_pct'))
            
            anomalies = Anomaly.objects.filter(patient=p, is_resolved=False).count()
            
            val = aggr['avg_pct']
            adherence = round(float(val), 1) if val is not None else 0
            
            results.append({
                'patient_id': str(p.id),
                'patient_name': p.user.full_name,
                'patient_code': p.patient_code,
                'adherence_pct_7d': adherence,
                'open_anomalies': anomalies,
                'status': 'ATTENTION' if anomalies > 0 or adherence < 70 else 'OK'
            })
            
        return sorted(results, key=lambda x: (x['status'] == 'OK', x['adherence_pct_7d']))
