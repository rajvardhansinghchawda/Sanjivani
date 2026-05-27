import uuid
import logging
from django.utils import timezone
from apps.clinical.models import Medication, Prescription
from .models import ABHAConnection, ABHAImportLog

logger = logging.getLogger('medadhere.abha')

class ABDMGatewayService:
    """
    Mock service for Ayushman Bharat Digital Mission (ABDM) Gateway.
    """
    @staticmethod
    def request_otp(abha_id: str) -> str:
        logger.info(f"ABDM: Requesting OTP for {abha_id}")
        return str(uuid.uuid4()) # txnId

    @staticmethod
    def verify_otp(txn_id: str, otp: str, abha_id: str):
        logger.info(f"ABDM: Verifying OTP {otp} for txn {txn_id}")
        if otp == "123456": # Mock success
            return "mock_access_token_" + str(uuid.uuid4()), f"{abha_id}@abdm"
        raise Exception("Invalid OTP")

    @staticmethod
    def fetch_records(abha_id: str, token: str, record_type: str) -> list:
        logger.info(f"ABDM: Fetching {record_type} for {abha_id}")
        # Mock returning 1 prescription
        return [{
            'id': f'abdm-rx-{uuid.uuid4().hex[:8]}',
            'status': 'active',
            'intent': 'order',
            'medicationCodeableConcept': {
                'coding': [{'display': 'Metformin 500mg', 'code': '12345'}]
            },
            'dosageInstruction': [{'text': 'Once daily after dinner'}],
            'authoredOn': timezone.now().isoformat(),
            'encounter': {'hospital': 'AIIMS Delhi'}
        }]

class ABHAFHIRMapper:
    """
    Maps ABDM FHIR resources to MedAdhere models.
    """
    @staticmethod
    def to_prescription(resource: dict, patient):
        med_name = resource['medicationCodeableConcept']['coding'][0]['display']
        medication, _ = Medication.objects.get_or_create(
            name=med_name,
            defaults={'category': 'General'}
        )
        
        return Prescription.objects.create(
            patient=patient,
            medication=medication,
            dosage_instruction=resource['dosageInstruction'][0]['text'],
            is_active=True,
            remaining_quantity=30, # Default for imported
            source='ABHA'
        )

class ABHAService:
    @staticmethod
    def link_abha(patient, abha_id: str, abha_number: str, access_token: str):
        """Link a patient with their ABHA account."""
        connection, _ = ABHAConnection.objects.update_or_create(
            patient=patient,
            defaults={
                'abha_id': abha_id,
                'abha_number': abha_number,
                'access_token': access_token,
                'is_linked': True,
                'last_synced_at': timezone.now()
            }
        )
        
        # Trigger orchestrator (Phase 27)
        try:
            from agenthandover import get_orchestrator
            from medadhere_extensions_handover import ABHA_AGENT, ExtAgentEvent, HandoverPayload
            
            payload = HandoverPayload(
                patient_id=str(patient.id),
                data={"abha_id": abha_id},
            )
            get_orchestrator().broadcast(ABHA_AGENT, ExtAgentEvent.ABHA_LINKED, payload)
        except ImportError:
            logger.warning("Could not broadcast ABHA link — orchestrator missing.")
            
        return connection

    @staticmethod
    def import_prescriptions(connection):
        """Fetch and import prescriptions from ABDM."""
        records = ABDMGatewayService.fetch_records(connection.abha_id, connection.access_token, 'Prescription')
        imported_count = 0
        
        for res in records:
            ABHAFHIRMapper.to_prescription(res, connection.patient)
            imported_count += 1
            
        ABHAImportLog.objects.create(
            connection=connection,
            resource_type='Prescription',
            count=imported_count,
            status='SUCCESS'
        )
        
        # Trigger event (Phase 27)
        try:
            from agenthandover import get_orchestrator
            from medadhere_extensions_handover import ABHA_AGENT, ExtAgentEvent, HandoverPayload
            
            payload = HandoverPayload(
                patient_id=str(connection.patient.id),
                data={"imported_count": imported_count},
            )
            get_orchestrator().broadcast(ABHA_AGENT, ExtAgentEvent.ABHA_PRESCRIPTIONS_IMPORTED, payload)
        except ImportError:
            logger.warning("Could not broadcast ABHA import — orchestrator missing.")
            
        return imported_count

