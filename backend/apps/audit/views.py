"""
apps/audit/views.py — Admin-only audit log viewer.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from shared.response import APIResponse
from shared.permissions import IsAdminOrSuperAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(APIView):
    """GET /admin/api/v1/audit-logs/ — paginated, filterable"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        qs = AuditLog.objects.select_related('actor').all()

        actor_id = request.query_params.get('actor_id')
        resource_type = request.query_params.get('resource_type')
        action = request.query_params.get('action')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        if actor_id:
            qs = qs.filter(actor_id=actor_id)
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if action:
            qs = qs.filter(action__icontains=action)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        page = int(request.query_params.get('page', 1))
        page_size = 50
        start = (page - 1) * page_size
        end = start + page_size

        data = AuditLogSerializer(qs[start:end], many=True).data
        return APIResponse.success(data, meta={'page': page, 'total': qs.count()})
