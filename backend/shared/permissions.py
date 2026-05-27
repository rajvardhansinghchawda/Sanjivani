"""
shared/permissions.py — Role-based and subscription-based DRF permissions.
"""
from rest_framework.permissions import BasePermission


PERMISSION_HIERARCHY = {
    'view_only':       1,
    'log_doses':       2,
    'manage_schedule': 3,
    'full_access':     4,
}


# ─── Role Permissions ─────────────────────────────────────────────────────────

class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'PATIENT')


class IsCaregiver(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'CAREGIVER')


class IsNurse(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'NURSE')


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('ADMIN', 'SUPER_ADMIN'))


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'SUPER_ADMIN')


# Alias — used by admin_panel and audit views
IsAdminOrSuperAdmin = IsAdminUser


class IsPatientOrCaregiver(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ('PATIENT', 'CAREGIVER'))


# ─── Subscription Permissions ─────────────────────────────────────────────────

class IsPremiumSubscriber(BasePermission):
    message = 'This feature requires a Premium subscription.'

    def has_permission(self, request, view):
        try:
            return request.user.subscription.plan.slug == 'premium'
        except Exception:
            return False


class IsFreemiumOrPremium(BasePermission):
    message = 'This feature requires a Freemium or Premium subscription.'

    def has_permission(self, request, view):
        try:
            return request.user.subscription.plan.slug in ('freemium', 'premium')
        except Exception:
            return False


# ─── Caregiver Object-Level Permission ────────────────────────────────────────

class CaregiverPermission(BasePermission):
    """
    Checks PatientCaregiverLink.permission_level for object-level access.
    View must declare `required_permission_level` class attribute.
    """
    def has_object_permission(self, request, view, obj):
        required = getattr(view, 'required_permission_level', 'view_only')
        try:
            from apps.clinical.models import PatientCaregiverLink
            link = PatientCaregiverLink.objects.get(
                patient=obj,
                caregiver__user=request.user,
                is_active=True,
            )
            return (PERMISSION_HIERARCHY.get(link.permission_level, 0)
                    >= PERMISSION_HIERARCHY.get(required, 0))
        except Exception:
            return False


# ─── Device API Key Auth permission ───────────────────────────────────────────

class IsDeviceAuthenticated(BasePermission):
    """Used on IoT firmware endpoints — request.auth is the Device object."""
    def has_permission(self, request, view):
        return bool(request.auth is not None
                    and hasattr(request.auth, 'is_active')
                    and request.auth.is_active)
