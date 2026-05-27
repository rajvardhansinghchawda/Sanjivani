from django.contrib import admin
from .models import ChatRoom, Message

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'caregiver', 'patient', 'created_at')
    raw_id_fields = ('caregiver', 'patient')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'sender', 'is_read', 'created_at')
    list_filter = ('is_read',)
