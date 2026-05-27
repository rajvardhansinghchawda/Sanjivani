from rest_framework import viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Streak, Badge, WeeklyAdherenceScore
from .serializers import StreakSerializer, BadgeSerializer, WeeklyAdherenceScoreSerializer
from .services import GamificationService

class GamificationViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        user = request.user
        # In a real app, user might have multiple patients if they are a caregiver, 
        # but here we assume the user is the patient for MVP.
        patient = getattr(user, 'patient_profile', None)
        if not patient:
            return Response({"error": "No patient profile found for this user"}, status=404)

        streak, _ = Streak.objects.get_or_create(patient=patient)
        badges = Badge.objects.filter(patient=patient).order_by('-earned_at')[:5]
        scores = WeeklyAdherenceScore.objects.filter(patient=patient).order_by('-week_start')[:4]
        
        return Response({
            "streak": StreakSerializer(streak).data,
            "recent_badges": BadgeSerializer(badges, many=True).data,
            "recent_scores": WeeklyAdherenceScoreSerializer(scores, many=True).data
        })

    @action(detail=False, methods=['post'])
    def ping_streak(self, request):
        patient = getattr(request.user, 'patient_profile', None)
        if not patient:
            return Response({"error": "No patient profile found for this user"}, status=404)
            
        streak = GamificationService.update_streak(patient)
        return Response(StreakSerializer(streak).data)

class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BadgeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        patient = getattr(self.request.user, 'patient_profile', None)
        if not patient:
            return Badge.objects.none()
        return Badge.objects.filter(patient=patient).order_by('-earned_at')

class WeeklyScoreViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WeeklyAdherenceScoreSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        patient = getattr(self.request.user, 'patient_profile', None)
        if not patient:
            return WeeklyAdherenceScore.objects.none()
        return WeeklyAdherenceScore.objects.filter(patient=patient).order_by('-week_start')
