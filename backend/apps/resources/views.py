# apps/resources/views.py
from django.db import models
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import ResourceSharingRequest
from .serializers import ResourceSharingRequestSerializer

class ResourceSharingViewSet(viewsets.ModelViewSet):
    queryset = ResourceSharingRequest.objects.all()
    serializer_class = ResourceSharingRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.hospital:
            return ResourceSharingRequest.objects.none()
        
        # return requests where hospital is either requester or provider
        # also show pending provider-less requests (broadcasts)
        return ResourceSharingRequest.objects.filter(
            models.Q(requester_hospital=user.hospital) | 
            models.Q(provider_hospital=user.hospital) |
            models.Q(provider_hospital__isnull=True, status='pending')
        ).distinct()

    def create(self, request, *args, **kwargs):
        """
        POST /api/resources/requests/

        Requires the authenticated user to be linked to a hospital, otherwise
        requester_hospital would be NULL and the DB insert will fail.
        """
        if not getattr(request.user, "hospital", None):
            return Response(
                {"detail": "Your user account is not linked to a hospital."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user, requester_hospital=self.request.user.hospital)

    @action(detail=True, methods=['patch'])
    def respond(self, request, pk=None):
        """Provider accepts or rejects a request."""
        obj = self.get_object()
        user = request.user
        
        if not getattr(user, "hospital", None):
            return Response(
                {"detail": "Your user account is not linked to a hospital."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        act = request.data.get("action")  # accept | reject | ship | receive | complete
        allowed = {"accept", "reject", "ship", "receive", "complete"}
        if act not in allowed:
            return Response(
                {"detail": f"Invalid action. Expected one of: {', '.join(sorted(allowed))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If provider is set, only that hospital can progress the request.
        if obj.provider_hospital and obj.provider_hospital != user.hospital:
            return Response({"detail": "Not authorized to respond to this request."}, status=status.HTTP_403_FORBIDDEN)

        # For broadcast requests (provider is null), only an "accept" should claim the request.
        if not obj.provider_hospital and act in {"ship", "receive", "complete"}:
            return Response(
                {"detail": "This request must be accepted by a provider hospital first."},
                status=status.HTTP_409_CONFLICT,
            )
        
        if act == 'accept':
            if not obj.provider_hospital:
                obj.provider_hospital = user.hospital
            obj.status = 'accepted'
            obj.provider_contact = user
            obj.responded_at = timezone.now()
        elif act == 'reject':
            obj.status = 'rejected'
            obj.rejection_reason = request.data.get('rejection_reason', 'No reason provided.')
            obj.responded_at = timezone.now()
        elif act == 'ship':
            obj.status = 'shipped'
        elif act == 'receive':
            obj.status = 'received'
        elif act == 'complete':
            obj.status = 'completed'
            obj.completed_at = timezone.now()
        
        obj.save()
        return Response(ResourceSharingRequestSerializer(obj).data)
