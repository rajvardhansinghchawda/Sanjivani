# config/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# import after setting env var
django_asgi_app = get_asgi_application()

from apps.notifications.middleware import JWTWebSocketMiddleware
from apps.notifications.routing   import websocket_urlpatterns

application = ProtocolTypeRouter({
    # normal HTTP requests still handled by Django
    'http'     : django_asgi_app,

    # WebSocket connections go through JWT middleware → URL router
    'websocket': AllowedHostsOriginValidator(
        JWTWebSocketMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})