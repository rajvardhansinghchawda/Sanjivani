"""
shared/health.py — System health check endpoint.
GET /api/v1/health/
→ { db, redis, celery_workers, last_beat_run }
"""
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from shared.response import APIResponse
import datetime


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        status = {'db': False, 'redis': False, 'celery_beat': False}
        details = {}

        # 1. Database
        try:
            from django.db import connection
            connection.ensure_connection()
            status['db'] = True
        except Exception as e:
            details['db_error'] = str(e)

        # 2. Redis
        try:
            from django.core.cache import cache
            cache.set('health_check', 'ok', timeout=5)
            if cache.get('health_check') == 'ok':
                status['redis'] = True
        except Exception as e:
            details['redis_error'] = str(e)

        # 3. Celery Beat (check last periodic task run)
        try:
            from django_celery_beat.models import PeriodicTask
            latest = PeriodicTask.objects.order_by('-last_run_at').first()
            if latest and latest.last_run_at:
                status['celery_beat'] = True
                details['last_beat_run'] = latest.last_run_at.isoformat()
        except Exception as e:
            details['celery_beat_error'] = str(e)

        all_ok = all(status.values())
        http_status = 200 if all_ok else 503

        return APIResponse.success(
            data={**status, **details},
            message='All systems operational.' if all_ok else 'Degraded service.',
            status=http_status,
        )
