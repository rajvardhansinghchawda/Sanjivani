import logging
from .models import Tenant, TenantAdmin

logger = logging.getLogger('medadhere.tenants')

class TenantService:
    @staticmethod
    def create_tenant(name: str, subdomain: str, plan: str = 'CLINIC', owner_user=None) -> Tenant:
        """Create a new tenant and assign an owner."""
        tenant = Tenant.objects.create(
            name=name,
            subdomain=subdomain,
            plan=plan,
            schema_name=subdomain.replace('-', '_')
        )
        
        if owner_user:
            TenantAdmin.objects.create(tenant=tenant, user=owner_user, is_primary=True)
            
        # Trigger orchestrator (Phase 28)
        try:
            from agenthandover import get_orchestrator
            from medadhere_extensions_handover import TENANT_AGENT, ExtAgentEvent, HandoverPayload
            
            payload = HandoverPayload(
                patient_id=None,
                data={"tenant_id": str(tenant.id), "subdomain": subdomain, "plan": plan},
            )
            get_orchestrator().broadcast(TENANT_AGENT, ExtAgentEvent.TENANT_CREATED, payload)
        except ImportError:
            logger.warning("Could not broadcast tenant creation — orchestrator missing.")
            
        return tenant

    @staticmethod
    def get_tenant_by_subdomain(subdomain: str) -> Tenant:
        """Resolve a tenant from its subdomain."""
        return Tenant.objects.filter(subdomain=subdomain, is_active=True).first()
