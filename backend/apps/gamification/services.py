from .models import Streak, Badge, WeeklyAdherenceScore
from django.utils import timezone
from datetime import timedelta

class GamificationService:
    @staticmethod
    def update_streak(patient, activity_date=None):
        if not activity_date:
            activity_date = timezone.now().date()
            
        streak, created = Streak.objects.get_or_create(patient=patient)
        
        # If created or last activity was exactly yesterday, increment
        if created or (streak.last_dose_date and streak.last_dose_date == activity_date - timedelta(days=1)):
            streak.current_days += 1
        # If last activity was more than a day ago, reset
        elif streak.last_dose_date and streak.last_dose_date < activity_date - timedelta(days=1):
            streak.current_days = 1
        # If activity date is same as last activity, do nothing
            
        if streak.current_days > streak.longest_days:
            streak.longest_days = streak.current_days
            
        streak.last_dose_date = activity_date
        streak.save()
        
        # Check for streak badges
        GamificationService._check_streak_badges(patient, streak.current_days)
        
        return streak
        
    @staticmethod
    def _check_streak_badges(patient, current_days):
        badge_thresholds = {
            7: "7_DAY_STREAK",
            30: "30_DAY_STREAK",
            90: "90_DAY_STREAK",
            365: "365_DAY_STREAK"
        }
        
        if current_days in badge_thresholds:
            badge_type = badge_thresholds[current_days]
            Badge.objects.get_or_create(
                patient=patient,
                badge_type=badge_type
            )

    @staticmethod
    def award_badge(patient, badge_type):
        badge, created = Badge.objects.get_or_create(
            patient=patient,
            badge_type=badge_type
        )
        return badge

    @staticmethod
    def compute_weekly_score(patient, week_start, score, total, taken, missed):
        score_obj, created = WeeklyAdherenceScore.objects.update_or_create(
            patient=patient,
            week_start=week_start,
            defaults={
                "score": score,
                "total_doses": total,
                "taken_doses": taken,
                "missed_doses": missed
            }
        )
        return score_obj
