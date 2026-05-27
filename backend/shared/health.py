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
        from django.core.cache import cache
        
        # Check cache first to avoid hitting database / Redis connectivity checks too frequently (saves Neon CU-hours)
        cached_health = None
        try:
            cached_health = cache.get('system_health_status')
        except Exception:
            pass

        if cached_health:
            status = cached_health.get('status', {})
            details = cached_health.get('details', {})
            all_ok = cached_health.get('all_ok', False)
            http_status = cached_health.get('http_status', 200)
            
            # Add cache indication to details
            details['cached'] = True
            
            return APIResponse.success(
                data={**status, **details},
                message='All systems operational.' if all_ok else 'Degraded service.',
                status=http_status,
            )

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
            cache.set('health_check', 'ok', timeout=5)
            if cache.get('health_check') == 'ok':
                status['redis'] = True
        except Exception as e:
            details['redis_error'] = str(e)

        # 3. Celery Beat (check last periodic task run)
        try:
            from django_celery_beat.models import PeriodicTask
            total_tasks = PeriodicTask.objects.count()
            if total_tasks == 0:
                status['celery_beat'] = False
                details['celery_beat_error'] = "No periodic tasks registered in database."
            else:
                latest = PeriodicTask.objects.exclude(last_run_at__isnull=True).order_by('-last_run_at').first()
                if latest and latest.last_run_at:
                    status['celery_beat'] = True
                    details['last_beat_run'] = latest.last_run_at.isoformat()
                else:
                    # Tasks exist but none have run yet (e.g. brand new deployment)
                    # We mark celery_beat as True so the initial health check passes and the space starts.
                    status['celery_beat'] = True
                    details['last_beat_run'] = None
                    details['celery_beat_note'] = "Periodic tasks registered, but none have executed yet."
        except Exception as e:
            details['celery_beat_error'] = str(e)

        all_ok = all(status.values())
        http_status = 200 if all_ok else 503

        # Save to cache if cache is working
        try:
            cache.set('system_health_status', {
                'status': status,
                'details': details,
                'all_ok': all_ok,
                'http_status': http_status,
            }, timeout=60)  # Cache for 60 seconds
        except Exception:
            pass

        return APIResponse.success(
            data={**status, **details},
            message='All systems operational.' if all_ok else 'Degraded service.',
            status=http_status,
        )
