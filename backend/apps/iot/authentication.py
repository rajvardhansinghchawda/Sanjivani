"""
apps/iot/authentication.py — Device API Key authentication for firmware endpoints.
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import Device


class DeviceAPIKeyAuthentication(BaseAuthentication):
    """
    Firmware devices authenticate using X-Device-Key header instead of JWT.
    """
    def authenticate(self, request):
        api_key = request.headers.get('X-Device-Key')
        if not api_key:
            return None
        try:
            device = Device.objects.get(api_key=api_key, is_active=True)
        except Device.DoesNotExist:
            raise AuthenticationFailed('Invalid or inactive device API key.')
        return (device.user, device)  # (user, auth)

    def authenticate_header(self, request):
        return 'X-Device-Key'
