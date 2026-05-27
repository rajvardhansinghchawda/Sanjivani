"""apps/abha/models.py — Phase 27: ABHA / ABDM Health Integration"""
from django.db import models
from shared.models import BaseModel

IMPORT_STATUSES = [('IMPORTED','Imported'),('DUPLICATE','Duplicate'),('REJECTED','Rejected')]

class ABHAConnection(BaseModel):
    patient           = models.OneToOneField('clinical.Patient', on_delete=models.CASCADE, related_name='abha_connection')
    abha_id           = models.CharField(max_length=14, db_index=True)
    abha_address      = models.EmailField(null=True, blank=True)    # name@abdm
    consent_token_enc = models.TextField()                           # Encrypted
    linked_at         = models.DateTimeField()
    last_synced_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'abha_connections'

    def __str__(self):
        return f'ABHA {self.abha_id} ({self.patient})'


class ABHAImportLog(BaseModel):
    connection           = models.ForeignKey(ABHAConnection, on_delete=models.CASCADE, related_name='import_logs')
    record_type          = models.CharField(max_length=50)
    raw_fhir_payload     = models.JSONField()
    import_status        = models.CharField(max_length=15, choices=IMPORT_STATUSES)
    source_hospital      = models.CharField(max_length=200, null=True, blank=True)
    created_prescription = models.ForeignKey('clinical.Prescription', null=True, blank=True, on_delete=models.SET_NULL, related_name='abha_import')

    class Meta:
        db_table = 'abha_import_logs'
