from django.urls import path
from .views import ABHASyncView

urlpatterns = [
    path('sync/', ABHASyncView.as_view(), name='abha-sync'),
]
