"""
apps/identity/tasks.py — Celery background tasks for identity app.
"""
from celery import shared_task
from django.utils import timezone


@shared_task(name='apps.identity.tasks.purge_expired_sessions')
def purge_expired_sessions():
    """Hourly: delete expired + revoked sessions older than 30 days."""
    from .models import UserSession
    cutoff = timezone.now() - __import__('datetime').timedelta(days=30)
    deleted, _ = UserSession.objects.filter(
        expires_at__lt=cutoff
    ).delete()
    return {'deleted_sessions': deleted}


@shared_task(name='apps.identity.tasks.send_verification_email_task')
def send_verification_email_task(user_id: str, token: str):
    """Send email verification link to new user."""
    from .models import User
    from apps.notifications.services import NotificationDispatcher
    from django.conf import settings
    
    try:
        user = User.objects.get(id=user_id)
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        verify_link = f"{frontend_url}/verify-email?token={token}"
        
        NotificationDispatcher.dispatch(
            user=user,
            notification_type='ACCOUNT_SECURITY',
            title='Verify Your Email - MedAdhere',
            body=f'Welcome to MedAdhere! Please verify your email by clicking here: {verify_link}',
            data={'verify_link': verify_link, 'token': token},
            channels=['EMAIL', 'IN_APP']
        )
        
    except User.DoesNotExist:
        pass


@shared_task(name='apps.identity.tasks.send_password_reset_email_task')
def send_password_reset_email_task(user_id: str, token: str):
    """Send password reset link to user."""
    from .models import User
    from apps.notifications.services import NotificationDispatcher
    from django.conf import settings
    
    try:
        user = User.objects.get(id=user_id)
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_link = f"{frontend_url}/password-reset/confirm?token={token}"
        
        NotificationDispatcher.dispatch(
            user=user,
            notification_type='ACCOUNT_SECURITY',
            title='Reset Your Password - MedAdhere',
            body=f'We received a request to reset your password. Use this link to continue: {reset_link}',
            data={'reset_link': reset_link, 'token': token},
            channels=['EMAIL', 'IN_APP']
        )
        
    except User.DoesNotExist:
        pass
