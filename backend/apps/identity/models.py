"""
apps/identity/models.py — User, sessions, MFA, notification preferences, devices.
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from shared.models import BaseModel
from shared.utils.encryption import EncryptedCharField


# ─── User Roles ───────────────────────────────────────────────────────────────
class UserRole(models.TextChoices):
    PATIENT      = 'PATIENT',      'Patient'
    DOCTOR       = 'DOCTOR',       'Doctor'
    CAREGIVER    = 'CAREGIVER',    'Caregiver'
    NURSE        = 'NURSE',        'Nurse'
    PHARMACIST   = 'PHARMACIST',   'Pharmacist'
    ADMIN        = 'ADMIN',        'Admin'
    SUPER_ADMIN  = 'SUPER_ADMIN',  'Super Admin'


# ─── Custom User Manager ──────────────────────────────────────────────────────
class UserManager(BaseUserManager):
    def create_user(self, email, password, full_name, role=UserRole.PATIENT, **extra):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email)
        user  = self.model(email=email, full_name=full_name, role=role, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, full_name='Admin', **extra):
        extra.setdefault('role', UserRole.SUPER_ADMIN)
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('is_email_verified', True)
        return self.create_user(email, password, full_name, **extra)


# ─── User ─────────────────────────────────────────────────────────────────────
class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model. email is the login credential.
    UUID primary key — no sequential IDs exposed.
    """
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email               = models.EmailField(unique=True, db_index=True)
    full_name           = models.CharField(max_length=255)
    phone_number        = models.CharField(max_length=20, blank=True, null=True)
    role                = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.PATIENT)

    # Status
    is_active           = models.BooleanField(default=True)
    is_staff            = models.BooleanField(default=False)
    is_email_verified   = models.BooleanField(default=False)
    is_phone_verified   = models.BooleanField(default=False)

    # MFA
    mfa_enabled         = models.BooleanField(default=False)

    # Security
    password_changed_at = models.DateTimeField(null=True, blank=True)
    failed_login_count  = models.SmallIntegerField(default=0)
    locked_until        = models.DateTimeField(null=True, blank=True)
    last_login_ip       = models.GenericIPAddressField(null=True, blank=True)

    # Preferences
    preferred_language  = models.CharField(max_length=10, default='en')
    profile_photo_url   = models.URLField(null=True, blank=True)

    # Timestamps
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)
    deleted_at          = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    class Meta:
        db_table = 'identity_users'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.email} ({self.role})'

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > timezone.now())

    def is_premium(self) -> bool:
        try:
            return self.subscription.plan.slug == 'premium'
        except Exception:
            return False

    def get_plan_slug(self) -> str:
        try:
            return self.subscription.plan.slug
        except Exception:
            return 'free'


# ─── User Session ─────────────────────────────────────────────────────────────
class UserSession(BaseModel):
    """
    Tracks every JWT refresh token as a server-side session.
    Enables revocation on password change and logout.
    """
    user                = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    jti                 = models.CharField(max_length=255, unique=True, db_index=True)  # JWT ID
    refresh_token_hash  = models.CharField(max_length=255)                               # hashed
    device_type         = models.CharField(max_length=50, blank=True, default='unknown')
    device_name         = models.CharField(max_length=200, blank=True, null=True)
    app_version         = models.CharField(max_length=20, blank=True, null=True)
    ip_address          = models.GenericIPAddressField(null=True, blank=True)
    user_agent          = models.TextField(blank=True, null=True)
    expires_at          = models.DateTimeField()
    revoked_at          = models.DateTimeField(null=True, blank=True)
    revoke_reason       = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'identity_user_sessions'

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > timezone.now()


# ─── MFA Configuration ────────────────────────────────────────────────────────
class MFAConfig(BaseModel):
    user            = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mfa_config')
    totp_secret     = EncryptedCharField(max_length=500, blank=True, null=True)
    is_totp_enabled = models.BooleanField(default=False)
    is_sms_enabled  = models.BooleanField(default=False)
    is_required     = models.BooleanField(default=False)    # plan-level enforcement
    backup_codes    = models.JSONField(default=list, blank=True)  # bcrypt hashed codes

    class Meta:
        db_table = 'identity_mfa_configs'


# ─── Notification Preferences ─────────────────────────────────────────────────
class NotificationPreferences(BaseModel):
    user                = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    push_enabled        = models.BooleanField(default=True)
    sms_enabled         = models.BooleanField(default=True)
    email_enabled       = models.BooleanField(default=True)
    whatsapp_enabled    = models.BooleanField(default=False)
    voice_call_enabled  = models.BooleanField(default=False)
    quiet_hours_start   = models.TimeField(null=True, blank=True)  # e.g. 22:00
    quiet_hours_end     = models.TimeField(null=True, blank=True)  # e.g. 07:00
    reminder_lead_mins  = models.SmallIntegerField(default=5)      # notify N min before scheduled

    class Meta:
        db_table = 'identity_notification_preferences'


# ─── User Device (push token registry) ───────────────────────────────────────
class UserDevice(BaseModel):
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_devices')
    fcm_token       = models.TextField(blank=True, null=True)   # Android / Web
    apns_token      = models.TextField(blank=True, null=True)   # iOS
    device_type     = models.CharField(max_length=20, choices=[
                        ('android', 'Android'), ('ios', 'iOS'), ('web', 'Web')
                      ], default='android')
    device_name     = models.CharField(max_length=200, blank=True, null=True)
    app_version     = models.CharField(max_length=20, blank=True, null=True)
    is_active       = models.BooleanField(default=True)
    last_active_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'identity_user_devices'
