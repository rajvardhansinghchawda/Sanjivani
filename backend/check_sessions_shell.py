from apps.identity.models import UserSession, User
from django.utils import timezone
import json

# Get patient user
user = User.objects.get(email='patient+apollo-indore@medadhere.test')
print(f"\nUser: {user.email} ({user.id})")

# Get all sessions for this user
sessions = UserSession.objects.filter(user=user).order_by('-created_at')[:5]

print(f"\n🔍 Found {sessions.count()} sessions:\n")
print("=" * 100)

for i, session in enumerate(sessions, 1):
    print(f"\nSession {i}:")
    print(f"  JTI:          {session.jti[:50]}...")
    print(f"  Revoked at:   {session.revoked_at}")
    print(f"  Expires at:   {session.expires_at}")
    print(f"  Now:          {timezone.now()}")
    print(f"  Time left:    {session.expires_at - timezone.now()}")
    print(f"  Is Active:    {session.is_active}")
    print(f"  Deleted at:   {session.deleted_at}")
    
    # Check all conditions
    checks = {
        "not_revoked": session.revoked_at is None,
        "not_expired": session.expires_at > timezone.now(),
        "not_deleted": session.deleted_at is None,
    }
    print(f"  Validation checks: {checks}")
    print(f"  ✅ PASS" if all(checks.values()) else f"  ❌ FAIL")

print("\n" + "=" * 100)
