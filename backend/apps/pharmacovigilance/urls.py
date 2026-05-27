from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SideEffectReportViewSet

router = DefaultRouter()
router.register(r'reports', SideEffectReportViewSet, basename='side-effect-report')

urlpatterns = [
    path('', include(router.urls)),
]
