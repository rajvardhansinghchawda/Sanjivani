"""
apps/identity/views/users.py — User profile, sessions, notification prefs, push devices.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone

from shared.response import APIResponse
from ..models import UserSession, NotificationPreferences, UserDevice
from ..serializers import (
    UserProfileSerializer, UserProfileUpdateSerializer,
    UserSessionSerializer, NotificationPreferencesSerializer,
    UserDeviceSerializer, UserDeviceRegisterSerializer,
)
from ..services import AuthService


# ─── User Profile ─────────────────────────────────────────────────────────────

class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/v1/users/me/"""
        s = UserProfileSerializer(request.user)
        return APIResponse.success(s.data)

    def patch(self, request):
        """PATCH /api/v1/users/me/"""
        s = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)
        s.save()
        return APIResponse.success(UserProfileSerializer(request.user).data,
                                   message='Profile updated.')


# ─── Sessions ─────────────────────────────────────────────────────────────────

class UserSessionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/v1/users/me/sessions/ — list active sessions."""
        sessions = UserSession.objects.filter(
            user=request.user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
            deleted_at__isnull=True,
        ).order_by('-created_at')
        s = UserSessionSerializer(sessions, many=True, context={'request': request})
        return APIResponse.success(s.data)


class UserSessionRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, session_id):
        """DELETE /api/v1/users/me/sessions/{id}/ — revoke a specific session."""
        from django.utils import timezone
        session = get_object_or_404(
            UserSession, id=session_id, user=request.user, revoked_at__isnull=True
        )
        session.revoked_at   = timezone.now()
        session.revoke_reason = 'user_revoked'
        session.save(update_fields=['revoked_at', 'revoke_reason'])

        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            ot = OutstandingToken.objects.filter(jti=session.jti).first()
            if ot:
                BlacklistedToken.objects.get_or_create(token=ot)
        except Exception:
            pass

        return APIResponse.no_content('Session revoked.')


# ─── Notification Preferences ─────────────────────────────────────────────────

class NotificationPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/v1/users/me/notifications/"""
        prefs, _ = NotificationPreferences.objects.get_or_create(user=request.user)
        return APIResponse.success(NotificationPreferencesSerializer(prefs).data)

    def patch(self, request):
        """PATCH /api/v1/users/me/notifications/"""
        prefs, _ = NotificationPreferences.objects.get_or_create(user=request.user)
        s = NotificationPreferencesSerializer(prefs, data=request.data, partial=True)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)
        s.save()
        return APIResponse.success(s.data, message='Preferences updated.')


# ─── Push Devices ─────────────────────────────────────────────────────────────

class UserDeviceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """GET /api/v1/users/me/devices/"""
        devices = UserDevice.objects.filter(user=request.user, is_active=True)
        return APIResponse.success(UserDeviceSerializer(devices, many=True).data)

    def post(self, request):
        """POST /api/v1/users/me/devices/ — register FCM/APNs token."""
        s = UserDeviceRegisterSerializer(data=request.data)
        if not s.is_valid():
            return APIResponse.error('Validation failed.', errors=s.errors)

        # Upsert — if same FCM token already exists, reactivate it
        fcm   = s.validated_data.get('fcm_token')
        apns  = s.validated_data.get('apns_token')
        dtype = s.validated_data.get('device_type', 'android')

        qs_filter = {}
        if fcm:
            qs_filter['fcm_token'] = fcm
        elif apns:
            qs_filter['apns_token'] = apns

        if qs_filter:
            device, created = UserDevice.all_objects.get_or_create(
                user=request.user, **qs_filter,
                defaults={**s.validated_data, 'is_active': True}
            )
            if not created:
                device.is_active = True
                device.save(update_fields=['is_active', 'updated_at'])
        else:
            device = UserDevice.objects.create(user=request.user, **s.validated_data)

        return APIResponse.created(UserDeviceSerializer(device).data)


class UserDeviceDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, device_id):
        """DELETE /api/v1/users/me/devices/{id}/"""
        device = get_object_or_404(UserDevice, id=device_id, user=request.user)
        device.is_active = False
        device.save(update_fields=['is_active', 'updated_at'])
        return APIResponse.no_content('Device token unregistered.')
