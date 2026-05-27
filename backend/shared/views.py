"""
shared/views.py — Health check view.
"""
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection
from django.core.cache import cache
from django.utils import timezone


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        status = {'db': 'ok', 'redis': 'ok', 'timestamp': timezone.now().isoformat()}

        # DB check
        try:
            connection.ensure_connection()
        except Exception as e:
            status['db'] = f'error: {str(e)}'

        # Redis check
        try:
            cache.set('health_check', '1', 5)
            cache.get('health_check')
        except Exception as e:
            status['redis'] = f'error: {str(e)}'

        http_status = 200 if all(v == 'ok' for k, v in status.items() if k != 'timestamp') else 503
        return Response({'success': http_status == 200, 'data': status}, status=http_status)
