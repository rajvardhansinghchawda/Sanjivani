from celery import shared_task
from agenthandover import get_orchestrator
from medadhere_extensions_handover import ABHA_AGENT

@shared_task
def sync_all_abha_connections():
    """Daily ABHA sync — all linked patients."""
    from apps.abha.models import ABHAConnection
    connections = ABHAConnection.objects.filter(
        deleted_at__isnull=True,
    ).values_list('id', flat=True)
    
    for conn_id in connections:
        sync_single_abha_connection.delay(str(conn_id))
    return {'connections_queued': len(connections)}

@shared_task(bind=True, max_retries=2)
def sync_single_abha_connection(self, connection_id: str):
    orchestrator = get_orchestrator()
    abha_agent = orchestrator.get_agent(ABHA_AGENT)
    if not abha_agent:
        raise Exception("ABHAAgent not found")
        
    try:
        # Assuming sync_health_records is the method used for periodic sync
        return abha_agent.sync_health_records(connection_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)

@shared_task(bind=True, max_retries=3)
def sync_abha_records(self, connection_id: str):
    """Triggered after initial linking."""
    return sync_single_abha_connection(connection_id)
