from celery import shared_task
from apps.gamification.services import GamificationService

@shared_task
def update_all_patient_scores():
    """Weekly/Daily score refresh."""
    from apps.clinical.models import Patient
    patients = Patient.objects.filter(is_active=True)
    count = 0
    for p in patients:
        GamificationService.get_or_update_profile(p)
        count += 1
    return {"updated": count}
