"""
shared/urls.py — Health check endpoint.
"""
from django.urls import path
from shared.views import HealthCheckView

urlpatterns = [
    path('', HealthCheckView.as_view(), name='health-check'),
]
