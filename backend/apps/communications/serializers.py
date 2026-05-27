"""
apps/communications/serializers.py
"""
from rest_framework import serializers
from .models import ChatRoom, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_id   = serializers.UUIDField(source='sender.id', read_only=True)
    type        = serializers.CharField(source='message_type', read_only=True)

    class Meta:
        model  = Message
        fields = [
            'id', 'sender_id', 'sender_name',
            'content', 'type',
            'file_url', 'file_name', 'file_size', 'mime_type',
            'is_read', 'created_at',
        ]

    def get_sender_name(self, obj):
        return obj.sender.full_name or obj.sender.email


class ChatRoomSerializer(serializers.ModelSerializer):
    other_user_name = serializers.SerializerMethodField()
    other_user_id = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'other_user_name', 'other_user_id', 'unread_count', 'last_message', 'created_at']

    def _other_user(self, obj):
        request_user = self.context['request'].user
        if obj.caregiver.user_id == request_user.id:
            return obj.patient.user
        return obj.caregiver.user

    def get_other_user_name(self, obj):
        return self._other_user(obj).full_name or self._other_user(obj).email

    def get_other_user_id(self, obj):
        return str(self._other_user(obj).id)

    def get_unread_count(self, obj):
        user = self.context['request'].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {'content': msg.content[:80], 'created_at': msg.created_at.isoformat()}
