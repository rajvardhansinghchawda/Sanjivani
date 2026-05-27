"""
apps/communications/middleware.py — JWT authentication for WebSocket connections.
Token is passed as query param: ws://host/ws/chat/<id>/?token=<jwt>
"""
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_token(token: str):
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from apps.identity.models import User
        decoded = AccessToken(token)
        return User.objects.get(id=decoded['user_id'])
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Attaches the authenticated User to the WebSocket scope."""

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
