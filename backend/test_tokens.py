import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from apps.identity.models import User

# Get the caregiver user
try:
    user = User.objects.get(email='caregiver@medadhere.test')
except User.DoesNotExist:
    print("User not found")
    exit(1)

# Create tokens
refresh = RefreshToken.for_user(user)
access = refresh.access_token

print("Access Token Payload:")
print("  token_type:", access.get('token_type'))
print("  jti:", access.get('jti'))
print("  user_id:", access.get('user_id'))

print("\nRefresh Token Payload:")
print("  token_type:", refresh.get('token_type'))
print("  jti:", refresh.get('jti'))
print("  user_id:", refresh.get('user_id'))
