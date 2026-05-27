"""
apps/communications/views.py — REST endpoints for chat rooms and message history.
"""
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.conf import settings
from shared.response import APIResponse
from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer


class ChatRoomListCreateView(APIView):
    """
    GET  /api/v1/communications/rooms/           — list my rooms
    POST /api/v1/communications/rooms/           — get or create room with patient
      body: { "patient_id": "<uuid>" }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'CAREGIVER':
            rooms = ChatRoom.objects.filter(
                caregiver__user=user, deleted_at__isnull=True
            ).select_related('caregiver__user', 'patient__user').prefetch_related('messages')
        else:
            rooms = ChatRoom.objects.filter(
                patient__user=user, deleted_at__isnull=True
            ).select_related('caregiver__user', 'patient__user').prefetch_related('messages')

        return APIResponse.success(ChatRoomSerializer(rooms, many=True, context={'request': request}).data)

    def post(self, request):
        """Create or retrieve a chat room between the current caregiver and a patient."""
        user = request.user
        patient_id = request.data.get('patient_id')
        if not patient_id:
            return APIResponse.error('patient_id is required.', status=400)

        from apps.clinical.models import Caregiver, Patient, PatientCaregiverLink
        try:
            caregiver = user.caregiver_profile
        except Exception:
            return APIResponse.error('Only caregivers can initiate chat rooms.', status=403)

        patient = get_object_or_404(Patient, id=patient_id, deleted_at__isnull=True)

        # Verify link exists
        linked = PatientCaregiverLink.objects.filter(
            caregiver=caregiver, patient=patient, is_active=True
        ).exists()
        if not linked:
            return APIResponse.error('You are not linked to this patient.', status=403)

        room, created = ChatRoom.objects.get_or_create(
            caregiver=caregiver,
            patient=patient,
        )
        status_code = 201 if created else 200
        return APIResponse.success(
            ChatRoomSerializer(room, context={'request': request}).data,
            status=status_code,
        )


class ChatRoomMessagesView(APIView):
    """
    GET  /api/v1/communications/rooms/<id>/messages/  — paginated message history
    POST /api/v1/communications/rooms/<id>/read/      — mark all as read
    """
    permission_classes = [IsAuthenticated]

    def _get_room(self, request, room_id):
        user = request.user
        try:
            if user.role == 'CAREGIVER':
                return ChatRoom.objects.get(id=room_id, caregiver__user=user)
            else:
                return ChatRoom.objects.get(id=room_id, patient__user=user)
        except ChatRoom.DoesNotExist:
            return None

    def get(self, request, room_id):
        room = self._get_room(request, room_id)
        if not room:
            return APIResponse.error('Room not found.', status=404)

        # Simple cursor: before_id param for older messages
        before_id = request.query_params.get('before_id')
        qs = Message.objects.filter(room=room).select_related('sender')
        if before_id:
            try:
                pivot = Message.objects.get(id=before_id)
                qs = qs.filter(created_at__lt=pivot.created_at)
            except Message.DoesNotExist:
                pass
        msgs = qs.order_by('-created_at')[:50]
        return APIResponse.success(MessageSerializer(reversed(list(msgs)), many=True).data)


class MarkRoomReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        user = request.user
        try:
            if user.role == 'CAREGIVER':
                room = ChatRoom.objects.get(id=room_id, caregiver__user=user)
            else:
                room = ChatRoom.objects.get(id=room_id, patient__user=user)
        except ChatRoom.DoesNotExist:
            return APIResponse.error('Room not found.', status=404)

        updated = Message.objects.filter(room=room, is_read=False).exclude(sender=user).update(is_read=True)
        return APIResponse.success({'marked_read': updated})


class ChatRoomUploadView(APIView):
    """
    POST /api/v1/communications/rooms/<room_id>/upload/
    Upload a file and persist it as a Message record.
    Returns { file_url, file_name, file_size, mime_type, message_id }.
    """
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def _get_room(self, request, room_id):
        user = request.user
        try:
            if user.role == 'CAREGIVER':
                return ChatRoom.objects.get(id=room_id, caregiver__user=user)
            return ChatRoom.objects.get(id=room_id, patient__user=user)
        except ChatRoom.DoesNotExist:
            return None

    def post(self, request, room_id):
        room = self._get_room(request, room_id)
        if not room:
            return APIResponse.error('Room not found.', status=404)

        uploaded = request.FILES.get('file')
        if not uploaded:
            return APIResponse.error('No file provided.', status=400)

        rel_path  = f'chat_rooms/{room.id}/{uploaded.name}'
        saved     = default_storage.save(rel_path, uploaded)
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        file_url  = request.build_absolute_uri(f'{media_url}{saved}')

        msg = Message.objects.create(
            room         = room,
            sender       = request.user,
            content      = '',
            message_type = 'file',
            file_url     = file_url,
            file_name    = uploaded.name,
            file_size    = uploaded.size,
            mime_type    = uploaded.content_type or 'application/octet-stream',
        )

        return APIResponse.success({
            'file_url':   file_url,
            'file_name':  uploaded.name,
            'file_size':  uploaded.size,
            'mime_type':  uploaded.content_type,
            'message_id': str(msg.id),
        }, status=201)
