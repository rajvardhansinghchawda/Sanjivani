"""
shared/middleware.py — Request logging and IP extraction middleware.
"""
import logging
import time

logger = logging.getLogger('medadhere')


class RequestLogMiddleware:
    """Logs method, path, status code, and duration for every request."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.time()
        response = self.get_response(request)
        duration_ms = int((time.time() - start) * 1000)

        user_id = getattr(getattr(request, 'user', None), 'id', 'anon')
        logger.info(
            f'{request.method} {request.path} → {response.status_code} '
            f'({duration_ms}ms) user={user_id}'
        )
        return response


def get_client_ip(request) -> str:
    """Extract real client IP address (proxy-aware)."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')
