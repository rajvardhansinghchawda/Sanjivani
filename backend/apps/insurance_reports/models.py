"""
apps/insurance_reports/models.py — Phase 24: Insurance Adherence Reports
"""
import uuid
from django.db import models
from shared.models import BaseModel


RECIPIENT_TYPES = [
    ('INSURANCE', 'Insurance Company'),
    ('EMPLOYER',  'Employer'),
    ('DOCTOR',    'Doctor'),
    ('SELF',      'Self'),
]


class AdherenceReportShare(BaseModel):
    patient         = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='report_shares')
    recipient_type  = models.CharField(max_length=20, choices=RECIPIENT_TYPES)
    recipient_name  = models.CharField(max_length=200)
    access_token    = models.CharField(max_length=100, unique=True, db_index=True, default=uuid.uuid4)
    expires_at      = models.DateTimeField()
    data_scope      = models.JSONField(default=dict)   # {period_days, include_conditions}
    is_revoked      = models.BooleanField(default=False, db_index=True)
    access_count    = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'insurance_report_shares'

    def __str__(self):
        return f'Report share for {self.patient} → {self.recipient_name}'


class ReportAccessLog(BaseModel):
    share           = models.ForeignKey(AdherenceReportShare, on_delete=models.CASCADE, related_name='access_logs')
    accessor_ip     = models.GenericIPAddressField()
    accessor_ua     = models.TextField()
    accessed_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'insurance_report_access_logs'

    def __str__(self):
        return f'Access to {self.share} from {self.accessor_ip}'
