from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VitalReadingViewSet, VitalTargetViewSet

router = DefaultRouter()
router.register(r'targets', VitalTargetViewSet, basename='vital-target')
router.register(r'readings', VitalReadingViewSet, basename='vital-reading')

urlpatterns = [
    path('', include(router.urls)),
]
