#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.identity.models import UserSession, User
from django.utils import timezone
import json

# Get patient user
user = User.objects.get(email='patient+apollo-indore@medadhere.test')
print(f"User: {user.email} ({user.id})")

# Get all sessions for this user
sessions = UserSession.objects.filter(user=user).order_by('-created_at')[:5]

print(f"\n🔍 Found {sessions.count()} sessions:")
print("=" * 80)

for i, session in enumerate(sessions, 1):
    print(f"\nSession {i}:")
    print(f"  JTI:          {session.jti[:50]}...")
    print(f"  Revoked at:   {session.revoked_at}")
    print(f"  Expires at:   {session.expires_at}")
    print(f"  Now:          {timezone.now()}")
    print(f"  Expires in:   {session.expires_at - timezone.now()}")
    print(f"  Is Active:    {session.is_active}")
    print(f"  Deleted at:   {session.deleted_at}")
    print(f"  Created at:   {session.created_at}")

print("\n" + "=" * 80)
print("\nAll sessions for filtering check:")
for session in sessions:
    checks = {
        "jti_exists": True,
        "not_revoked": session.revoked_at is None,
        "not_expired": session.expires_at > timezone.now(),
        "not_deleted": session.deleted_at is None,
        "all_pass": (session.revoked_at is None and 
                     session.expires_at > timezone.now() and 
                     session.deleted_at is None)
    }
    print(f"\nJTI {session.jti[:30]}...: {checks}")
