from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FamilyGroupViewSet

router = DefaultRouter()
router.register(r'groups', FamilyGroupViewSet, basename='family-group')

urlpatterns = [
    path('', include(router.urls)),
]
