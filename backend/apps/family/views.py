from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import FamilyGroup, FamilyMember
from .serializers import FamilyGroupSerializer, FamilyMemberSerializer

class FamilyGroupViewSet(viewsets.ModelViewSet):
    serializer_class = FamilyGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Return groups where the user is a member
        user = self.request.user
        return FamilyGroup.objects.filter(familymember__user=user, familymember__is_active=True)

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        # Add creator as ADMIN
        FamilyMember.objects.create(
            group=group,
            user=self.request.user,
            role='ADMIN',
            is_active=True
        )

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        group = self.get_object()
        
        # Check if requester is admin
        try:
            requester_member = FamilyMember.objects.get(group=group, user=request.user, is_active=True)
            if requester_member.role != 'ADMIN':
                return Response({"error": "Only admins can add members."}, status=status.HTTP_403_FORBIDDEN)
        except FamilyMember.DoesNotExist:
            return Response({"error": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
            
        user_id = request.data.get('user_id')
        role = request.data.get('role', 'MEMBER')
        
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Add member (user must exist, assuming identity app provides users)
        # Note: In a real implementation, you'd fetch the user to ensure it exists
        member, created = FamilyMember.objects.get_or_create(
            group=group,
            user_id=user_id,
            defaults={'role': role, 'is_active': True}
        )
        
        if not created and not member.is_active:
            member.is_active = True
            member.role = role
            member.save()
            
        serializer = FamilyMemberSerializer(member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        group = self.get_object()
        
        # Check if requester is admin
        try:
            requester_member = FamilyMember.objects.get(group=group, user=request.user, is_active=True)
            if requester_member.role != 'ADMIN':
                return Response({"error": "Only admins can remove members."}, status=status.HTTP_403_FORBIDDEN)
        except FamilyMember.DoesNotExist:
            return Response({"error": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
            
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({"error": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            member = FamilyMember.objects.get(group=group, user_id=user_id)
            if member.user_id == request.user.id:
                return Response({"error": "Cannot remove yourself. Use leave group instead."}, status=status.HTTP_400_BAD_REQUEST)
                
            member.is_active = False
            member.save()
            return Response({"status": "member removed"})
        except FamilyMember.DoesNotExist:
            return Response({"error": "Member not found in this group."}, status=status.HTTP_404_NOT_FOUND)
