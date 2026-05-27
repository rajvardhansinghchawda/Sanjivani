"""apps/fhir_integration/models.py — Phase 18: FHIR / HL7 EHR Import"""
from django.db import models
from shared.models import BaseModel

SYNC_STATUSES = [('IDLE','Idle'),('SYNCING','Syncing'),('SUCCESS','Success'),('FAILED','Failed')]
IMPORT_STATUSES = [('IMPORTED','Imported'),('DUPLICATE','Duplicate'),('REJECTED','Rejected')]

class FHIRConnection(BaseModel):
    patient           = models.ForeignKey('clinical.Patient', on_delete=models.CASCADE, related_name='fhir_connections')
    fhir_server_url   = models.URLField()
    access_token_enc  = models.TextField()          # Encrypted at rest
    refresh_token_enc = models.TextField(null=True, blank=True)
    token_expires_at  = models.DateTimeField(null=True, blank=True)
    hospital_name     = models.CharField(max_length=200)
    last_synced_at    = models.DateTimeField(null=True, blank=True)
    sync_status       = models.CharField(max_length=10, choices=SYNC_STATUSES, default='IDLE')

    class Meta:
        db_table = 'fhir_connections'

    def __str__(self):
        return f'{self.hospital_name} ({self.patient})'


class FHIRImportLog(BaseModel):
    connection           = models.ForeignKey(FHIRConnection, on_delete=models.CASCADE, related_name='import_logs')
    resource_type        = models.CharField(max_length=50)
    external_id          = models.CharField(max_length=200)
    raw_payload          = models.JSONField()
    import_status        = models.CharField(max_length=15, choices=IMPORT_STATUSES)
    rejection_reason     = models.TextField(null=True, blank=True)
    created_prescription = models.ForeignKey('clinical.Prescription', null=True, blank=True, on_delete=models.SET_NULL, related_name='fhir_import')

    class Meta:
        db_table = 'fhir_import_logs'
        unique_together = ('connection', 'external_id')
