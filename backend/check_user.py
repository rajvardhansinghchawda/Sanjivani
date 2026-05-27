import django
import os
from datetime import timezone as tz_module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.identity.models import UserSession, User
from django.utils import timezone

user = User.objects.filter(email='caregiver@medadhere.test').first()
if user:
    sessions = UserSession.objects.filter(user=user).order_by('-created_at')
    print(f'\nTotal sessions for caregiver: {sessions.count()}')
    for s in sessions[:10]:
        print(f'\nSession ID: {s.id}')
        print(f'  JTI: {s.jti[:30]}...')
        print(f'  Created: {s.created_at}')
        print(f'  Expires: {s.expires_at}')
        print(f'  Is expired: {s.expires_at < timezone.now()}')
        print(f'  Revoked: {s.revoked_at}')
        print(f'  Deleted: {s.deleted_at}')
else:
    print('User not found')
