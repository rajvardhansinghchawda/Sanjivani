from apps.identity.models import UserSession, User
from django.utils import timezone

u = User.objects.get(email='caregiver@medadhere.test')
sessions = UserSession.objects.filter(user=u).order_by('-created_at')[:3]
print(f'\nLatest 3 sessions:')
for s in sessions:
    print(f'\nJTI: {s.jti}')
    print(f'Created: {s.created_at}')
    print(f'Expires: {s.expires_at}')
    print(f'Expired now: {s.expires_at < timezone.now()}')
    print(f'Revoked: {s.revoked_at}')
    target_jti = '27943ad9d6df48f0b5961adca40a9e96'
    print(f'Match target: {s.jti == target_jti}')
