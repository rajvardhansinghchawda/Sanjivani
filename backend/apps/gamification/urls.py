from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GamificationViewSet, BadgeViewSet, WeeklyScoreViewSet

router = DefaultRouter()
router.register(r'badges', BadgeViewSet, basename='gamification-badge')
router.register(r'scores', WeeklyScoreViewSet, basename='gamification-score')

urlpatterns = [
    path('', include(router.urls)),
    path('summary/', GamificationViewSet.as_view({'get': 'summary'}), name='gamification-summary'),
    path('ping/', GamificationViewSet.as_view({'post': 'ping_streak'}), name='gamification-ping'),
]
