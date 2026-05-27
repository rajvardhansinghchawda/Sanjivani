from rest_framework import serializers
from .models import Streak, Badge, WeeklyAdherenceScore

class StreakSerializer(serializers.ModelSerializer):
    class Meta:
        model = Streak
        fields = ['id', 'patient', 'current_days', 'longest_days', 'last_dose_date']
        read_only_fields = ['id', 'patient', 'current_days', 'longest_days', 'last_dose_date']

class BadgeSerializer(serializers.ModelSerializer):
    badge_type_display = serializers.CharField(source='get_badge_type_display', read_only=True)

    class Meta:
        model = Badge
        fields = ['id', 'patient', 'badge_type', 'badge_type_display', 'earned_at']
        read_only_fields = ['id', 'patient', 'earned_at']

class WeeklyAdherenceScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyAdherenceScore
        fields = ['id', 'patient', 'week_start', 'score', 'total_doses', 'taken_doses', 'missed_doses']
        read_only_fields = ['id', 'patient', 'week_start', 'score', 'total_doses', 'taken_doses', 'missed_doses']
