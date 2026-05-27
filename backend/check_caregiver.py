#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.identity.models import User
from apps.clinical.models import Caregiver

u = User.objects.get(email='caregiver@medadhere.test')
print(f'User ID: {u.id}')

c = Caregiver.objects.filter(user=u).first()
print(f'Caregiver profile exists: {bool(c)}')
if c:
    print(f'Caregiver ID: {c.id}')
else:
    print('No caregiver profile found - THIS IS THE ISSUE!')
