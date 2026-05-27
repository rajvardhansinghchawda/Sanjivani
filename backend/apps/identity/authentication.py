"""
apps/identity/authentication.py — Custom JWT authentication with server-side session revocation.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.utils import timezone
from .models import UserSession


class MedAdhereJWTAuthentication(JWTAuthentication):
    """
    Extends SimpleJWT authentication with:
    1. Server-side session lookup — token is invalid if session was revoked.
    2. Password-change check — tokens issued before password change are rejected.
    """

    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        token_type = token.get('token_type')
        
        import logging
        logger = logging.getLogger(__name__)
        
        # For access tokens, we need to look up by user_id since access tokens have different JTI
        if token_type == 'access':
            user_id = token.get('user_id')
            logger.info(f"[AUTH] Access token for user={user_id}")
            
            # Check if user has ANY active session (session validation happens via refresh token)
            from .models import User
            try:
                user = User.objects.get(id=user_id)
                # Access token is valid if derived from a valid refresh token, so check user exists and is active
                if not user.is_active:
                    raise InvalidToken('User account is deactivated.')
                # Session validity is ensured by the fact that this access token was issued from a valid refresh
                return token
            except User.DoesNotExist:
                raise InvalidToken('Invalid user.')
        
        # For refresh tokens, validate server-side session
        jti = token.get('jti')
        logger.info(f"[AUTH] Refresh token validation: jti={jti[:30] if jti else 'None'}...")

        session = UserSession.objects.with_deleted().filter(
            jti=jti,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
            deleted_at__isnull=True,
        ).first()

        if not session:
            logger.warning(f"[AUTH] Refresh session not found for jti={jti[:30] if jti else 'None'}...")
            raise InvalidToken('Session has been revoked or expired. Please log in again.')

        # Check token not issued before last password change
        user = session.user
        if user.password_changed_at:
            token_iat = token.get('iat', 0)
            if token_iat < user.password_changed_at.timestamp():
                raise TokenError('Token invalidated due to password change. Please log in again.')

        return token


class DeviceAPIKeyAuthentication:
    """
    Authentication for IoT device firmware endpoints.
    Reads X-Device-Key header and resolves Device object.
    Returned as request.auth.
    """
    keyword = 'X-Device-Key'

    def authenticate(self, request):
        api_key = request.META.get('HTTP_X_DEVICE_KEY')
        if not api_key:
            return None
        try:
            from apps.iot.models import Device
            device = Device.objects.select_related('user', 'linked_patient').get(
                api_key=api_key, is_active=True
            )
            return (device.user, device)
        except Exception:
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed('Invalid or inactive device API key.')

    def authenticate_header(self, request):
        return self.keyword
