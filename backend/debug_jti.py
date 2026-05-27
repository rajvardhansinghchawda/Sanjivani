import os, django, json, base64
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.identity.models import UserSession, User
from apps.identity.services import AuthService

# Simulate login
user = User.objects.get(email='patient+apollo-indore@medadhere.test')
tokens = AuthService._issue_tokens(user, request=None)

access_token = tokens['access']
refresh_token = tokens['refresh']

print("=" * 80)
print("TOKEN DEBUG")
print("=" * 80)

# Parse JWT (don't verify signature for inspection)
def decode_jwt(token):
    parts = token.split('.')
    if len(parts) != 3:
        return None
    # Add padding if needed
    payload = parts[1]
    payload += '=' * (4 - len(payload) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(payload))
    except:
        return None

access_payload = decode_jwt(access_token)
refresh_payload = decode_jwt(refresh_token)

print(f"\n🔑 REFRESH TOKEN JTI: {refresh_payload.get('jti')}")
print(f"🔑 ACCESS TOKEN JTI:  {access_payload.get('jti')}")

# Check what's stored in DB
sessions = UserSession.objects.filter(user=user).order_by('-created_at')[:1]
if sessions:
    s = sessions[0]
    print(f"\n💾 STORED SESSION JTI: {s.jti}")
    print(f"✅ Match: {s.jti == refresh_payload.get('jti')}")
    print(f"✅ Match access: {s.jti == access_payload.get('jti')}")
