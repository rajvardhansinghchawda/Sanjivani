"""
apps/identity/serializers.py — Request/response serializers for all identity endpoints.
"""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, UserSession, MFAConfig, NotificationPreferences, UserDevice


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.Serializer):
    email        = serializers.EmailField()
    password     = serializers.CharField(min_length=8, write_only=True)
    full_name    = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role         = serializers.ChoiceField(
        choices=['PATIENT', 'DOCTOR', 'CAREGIVER', 'NURSE', 'PHARMACIST'],
        default='PATIENT'
    )

    def validate_password(self, value):
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MFAVerifySerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    code    = serializers.CharField(max_length=8)


class RefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token        = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField()


# ─── User Profile ─────────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    plan = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'full_name', 'phone_number', 'role',
            'is_email_verified', 'is_phone_verified', 'mfa_enabled',
            'preferred_language', 'profile_photo_url', 'plan', 'created_at',
        ]
        read_only_fields = ['id', 'email', 'role', 'is_email_verified', 'is_phone_verified', 'mfa_enabled', 'created_at']

    def get_plan(self, obj) -> str:
        return obj.get_plan_slug()


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ['full_name', 'phone_number', 'preferred_language', 'profile_photo_url']


# ─── Sessions ─────────────────────────────────────────────────────────────────

class UserSessionSerializer(serializers.ModelSerializer):
    is_current = serializers.SerializerMethodField()

    class Meta:
        model  = UserSession
        fields = ['id', 'device_type', 'device_name', 'ip_address', 'created_at', 'expires_at', 'is_current']

    def get_is_current(self, obj) -> bool:
        request = self.context.get('request')
        if not request:
            return False
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            raw = request.META.get('HTTP_AUTHORIZATION', '').replace('Bearer ', '')
            token = AccessToken(raw)
            return token['jti'] == obj.jti
        except Exception:
            return False


# ─── MFA ──────────────────────────────────────────────────────────────────────

class MFASetupResponseSerializer(serializers.Serializer):
    secret   = serializers.CharField()
    qr_code  = serializers.CharField()
    uri      = serializers.CharField()


class MFAVerifyInputSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=8)


# ─── Notification Preferences ─────────────────────────────────────────────────

class NotificationPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model  = NotificationPreferences
        fields = [
            'push_enabled', 'sms_enabled', 'email_enabled',
            'whatsapp_enabled', 'voice_call_enabled',
            'quiet_hours_start', 'quiet_hours_end', 'reminder_lead_mins',
        ]


# ─── User Devices ─────────────────────────────────────────────────────────────

class UserDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserDevice
        fields = ['id', 'device_type', 'device_name', 'app_version', 'is_active', 'last_active_at', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserDeviceRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserDevice
        fields = ['fcm_token', 'apns_token', 'device_type', 'device_name', 'app_version']
