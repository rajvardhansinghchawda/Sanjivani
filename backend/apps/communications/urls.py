from django.urls import path
from .views import ChatRoomListCreateView, ChatRoomMessagesView, MarkRoomReadView, ChatRoomUploadView

urlpatterns = [
    path('rooms/',                          ChatRoomListCreateView.as_view()),
    path('rooms/<uuid:room_id>/messages/',  ChatRoomMessagesView.as_view()),
    path('rooms/<uuid:room_id>/read/',      MarkRoomReadView.as_view()),
    path('rooms/<uuid:room_id>/upload/',    ChatRoomUploadView.as_view()),
]
