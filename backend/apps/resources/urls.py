# apps/resources/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ResourceSharingViewSet

router = DefaultRouter()
router.register(r'requests', ResourceSharingViewSet, basename='resource-sharing')

urlpatterns = [
    path('', include(router.urls)),
]
