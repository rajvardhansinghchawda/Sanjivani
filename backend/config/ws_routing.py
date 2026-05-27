"""
config/ws_routing.py — WebSocket URL patterns.
"""
from django.urls import path
from apps.communications.consumers import (
    ChatConsumer, CallConsumer, DoctorChatConsumer, NotificationConsumer,
)

websocket_urlpatterns = [
    path('ws/chat/<uuid:room_id>/',            ChatConsumer.as_asgi()),
    path('ws/call/<uuid:room_id>/',            CallConsumer.as_asgi()),
    path('ws/doctor-chat/<uuid:session_id>/',  DoctorChatConsumer.as_asgi()),
    path('ws/notifications/',                  NotificationConsumer.as_asgi()),
]
