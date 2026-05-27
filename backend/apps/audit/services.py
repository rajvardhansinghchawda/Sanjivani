"""
apps/audit/services.py — AuditLog writer used by all apps.
"""
from .models import AuditLog


class AuditService:
    @staticmethod
    def log(
        action: str,
        resource_type: str,
        resource_id: str = '',
        actor=None,
        request=None,
        before_state: dict = None,
        after_state: dict = None,
        trace_id: str = '',
    ):
        ip = None
        ua = ''
        if request:
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
            if ip and ',' in ip:
                ip = ip.split(',')[0].strip()
            ua = request.META.get('HTTP_USER_AGENT', '')

        AuditLog.objects.create(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            ip_address=ip,
            user_agent=ua,
            before_state=before_state,
            after_state=after_state,
            trace_id=trace_id,
        )
