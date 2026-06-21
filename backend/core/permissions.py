# core/permissions.py
from rest_framework.permissions import BasePermission
from apps.authentication.models import User


class IsReception(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == User.Role.RECEPTION
        )


class IsSupervisor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == User.Role.SUPERVISOR
        )


class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == User.Role.ADMIN
        )


class IsAmbulanceDriver(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == User.Role.AMBULANCE
        )


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == User.Role.PATIENT
        )


class IsReceptionOrSupervisor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [User.Role.RECEPTION, User.Role.SUPERVISOR]
        )


class IsStaffMember(BasePermission):
    """Any internal staff — reception, supervisor, admin."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [
                User.Role.RECEPTION,
                User.Role.SUPERVISOR,
                User.Role.ADMIN,
            ]
        )


class IsSameHospitalStaff(BasePermission):
    """Ensures staff can only access their own hospital's data."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.hospital_id is not None
        )

    def has_object_permission(self, request, view, obj):
        hospital_id = getattr(obj, 'hospital_id', None)
        return str(hospital_id) == str(request.user.hospital_id)


class IsPatientProfileOwner(BasePermission):
    """Ensures a patient can only access/edit their own patient record."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.PATIENT

    def has_object_permission(self, request, view, obj):
        return obj.user == request.user