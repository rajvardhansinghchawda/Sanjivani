# apps/notifications/middleware.py
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async


@database_sync_to_async
def get_user_from_token(token_str):
    """
    Validates the JWT access token and returns the User.
    Returns AnonymousUser if token is invalid.
    """
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from apps.authentication.models import User

        token   = AccessToken(token_str)
        user_id = token['user_id']
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()


class JWTWebSocketMiddleware:
    """
    Extracts JWT token from WebSocket query string.
    Usage from driver app:
      ws://your-domain/ws/ambulance/driver/<id>/?token=<access_token>
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params       = parse_qs(query_string)
        token_list   = params.get('token', [None])
        token_str    = token_list[0] if token_list else None

        if token_str:
            scope['user'] = await get_user_from_token(token_str)
        else:
            scope['user'] = AnonymousUser()

        return await self.app(scope, receive, send)