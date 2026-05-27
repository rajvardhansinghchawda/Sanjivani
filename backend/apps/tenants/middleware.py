import logging
from django.db import connection
from .models import Tenant

logger = logging.getLogger('medadhere.tenants')

class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Extract subdomain
        host = request.get_host().split(':')[0]
        parts = host.split('.')
        
        # Simple subdomain resolution (e.g., clinic-a.medadhere.com)
        if len(parts) > 2:
            subdomain = parts[0]
            if subdomain not in ['www', 'api', 'admin']:
                tenant = Tenant.objects.filter(subdomain=subdomain, is_active=True).first()
                if tenant:
                    request.tenant = tenant
                    # In a real Postgres implementation with schemas:
                    # connection.set_schema(tenant.schema_name)
                    logger.debug(f"Resolved tenant: {tenant.subdomain}")
                else:
                    request.tenant = None
        else:
            request.tenant = None

        response = self.get_response(request)
        return response
