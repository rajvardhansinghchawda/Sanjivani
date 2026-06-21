# apps/calls/urls.py
from django.urls import path
from .views import (
    InitiateTransferCallView,
    RequestUserAgentCallView,
    TransferCallWebhookView,
    TransferAlertWebhookView,
    TransferAcknowledgeWebhookView,
    AgentGreetWebhookView,
    AgentLanguageWebhookView,
    AgentProcessWebhookView,
    CallStatusWebhookView,
    CallSessionStatusView,
)

urlpatterns = [
    # ── initiation (frontend / Celery) ────────────────────────
    path('transfer/<uuid:transfer_id>/call/',    InitiateTransferCallView.as_view(),     name='transfer-call'),
    path('user-agent/request/',                  RequestUserAgentCallView.as_view(),     name='user-agent-request'),
    path('user-agent/status/<uuid:session_id>/', CallSessionStatusView.as_view(),        name='user-agent-status'),

    # ── Twilio webhooks (Twilio calls these) ──────────────────
    path('webhook/transfer/<uuid:transfer_id>/',                   TransferCallWebhookView.as_view(),        name='webhook-transfer'),
    path('webhook/transfer/<uuid:transfer_id>/alert/',             TransferAlertWebhookView.as_view(),       name='webhook-transfer-alert'),
    path('webhook/transfer/<uuid:transfer_id>/acknowledge/',       TransferAcknowledgeWebhookView.as_view(), name='webhook-transfer-ack'),
    path('webhook/agent/greet/<uuid:session_id>/',                 AgentGreetWebhookView.as_view(),          name='webhook-agent-greet'),
    path('webhook/agent/language/<uuid:session_id>/',              AgentLanguageWebhookView.as_view(),       name='webhook-agent-language'),
    path('webhook/agent/process/<uuid:session_id>/',               AgentProcessWebhookView.as_view(),        name='webhook-agent-process'),
    path('webhook/status/',                                        CallStatusWebhookView.as_view(),          name='webhook-status'),
]