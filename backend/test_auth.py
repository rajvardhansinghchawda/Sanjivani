import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
django.setup()

from rest_framework.test import APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken
from apps.identity.models import User
from apps.identity.authentication import MedAdhereJWTAuthentication

# Get the caregiver user
user = User.objects.get(email='caregiver@medadhere.test')

# Create tokens
refresh = RefreshToken.for_user(user)
access_token_str = str(refresh.access_token)

print("Testing access token authentication...")
print(f"Access token: {access_token_str[:50]}...")

# Create a test request with the Bearer token
factory = APIRequestFactory()
request = factory.get('/api/v1/caregivers/patients/', HTTP_AUTHORIZATION=f'Bearer {access_token_str}')

# Test authentication
auth = MedAdhereJWTAuthentication()
try:
    validated_user, token = auth.authenticate(request)
    print(f"✓ Authentication successful!")
    print(f"  User: {validated_user}")
    print(f"  Token type: {token.get('token_type') if hasattr(token, 'get') else 'N/A'}")
except Exception as e:
    print(f"✗ Authentication failed: {e}")
