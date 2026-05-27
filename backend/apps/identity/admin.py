"""
apps/identity/admin.py — Django admin for identity models.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserSession, MFAConfig, NotificationPreferences, UserDevice


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ['email', 'full_name', 'role', 'is_active', 'is_email_verified', 'mfa_enabled', 'created_at']
    list_filter    = ['role', 'is_active', 'is_email_verified', 'mfa_enabled']
    search_fields  = ['email', 'full_name', 'phone_number']
    ordering       = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'last_login_ip', 'password_changed_at']
    fieldsets = (
        ('Account', {'fields': ('id', 'email', 'password', 'role')}),
        ('Personal', {'fields': ('full_name', 'phone_number', 'preferred_language', 'profile_photo_url')}),
        ('Status', {'fields': ('is_active', 'is_email_verified', 'is_phone_verified', 'mfa_enabled')}),
        ('Security', {'fields': ('failed_login_count', 'locked_until', 'last_login_ip', 'password_changed_at')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at', 'deleted_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'password1', 'password2', 'role'),
        }),
    )


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display  = ['user', 'device_type', 'ip_address', 'created_at', 'expires_at', 'revoked_at']
    list_filter   = ['device_type']
    search_fields = ['user__email', 'ip_address', 'jti']
    readonly_fields = ['jti', 'refresh_token_hash']


@admin.register(MFAConfig)
class MFAConfigAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_totp_enabled', 'is_sms_enabled', 'is_required']


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display  = ['user', 'device_type', 'device_name', 'is_active', 'last_active_at']
    list_filter   = ['device_type', 'is_active']
    search_fields = ['user__email', 'device_name']
