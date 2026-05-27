"""
apps/pharmacovigilance/models.py — Phase 21: Side Effect + Pharmacovigilance
"""
from django.db import models
from shared.models import BaseModel


SEVERITY_CHOICES = [
    ('MILD',             'Mild'),
    ('MODERATE',         'Moderate'),
    ('SEVERE',           'Severe'),
    ('LIFE_THREATENING', 'Life Threatening'),
]


class SideEffectReport(BaseModel):
    patient             = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='side_effect_reports')
    prescription        = models.ForeignKey('clinical.Prescription', on_delete=models.CASCADE, related_name='side_effect_reports')
    symptom             = models.CharField(max_length=200)
    severity            = models.CharField(max_length=20, choices=SEVERITY_CHOICES, db_index=True)
    onset_at            = models.DateTimeField()
    resolved_at         = models.DateTimeField(null=True, blank=True)
    is_ongoing          = models.BooleanField(default=True)
    reported_to_doctor  = models.BooleanField(default=False)
    reported_to_cdsco   = models.BooleanField(default=False)
    cdsco_report_id     = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'pharmacovig_side_effect_reports'
        indexes  = [
            models.Index(fields=['prescription', 'severity']),
            models.Index(fields=['reported_to_cdsco', 'severity']),
        ]

    def __str__(self):
        return f'{self.symptom} ({self.severity}) — {self.patient}'
