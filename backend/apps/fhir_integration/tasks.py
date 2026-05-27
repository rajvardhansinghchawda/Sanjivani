from celery import shared_task
from agenthandover import get_orchestrator
from medadhere_extensions_handover import FHIR_AGENT

@shared_task
def sync_all_fhir_connections():
    """Daily sync — all FHIR-connected patients."""
    from apps.fhir_integration.models import FHIRConnection
    connections = FHIRConnection.objects.filter(
        sync_status__in=['IDLE', 'SUCCESS'],
        deleted_at__isnull=True,
    ).values_list('id', flat=True)
    
    for conn_id in connections:
        sync_single_fhir_connection.delay(str(conn_id))
    return {'connections_queued': len(connections)}

@shared_task(bind=True, max_retries=2)
def sync_single_fhir_connection(self, connection_id: str):
    orchestrator = get_orchestrator()
    fhir_agent = orchestrator.get_agent(FHIR_AGENT)
    if not fhir_agent:
        raise Exception("FHIRAgent not found")
        
    try:
        # Assuming sync_connection is a method on FHIRAgent
        return fhir_agent.sync_connection(connection_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)
