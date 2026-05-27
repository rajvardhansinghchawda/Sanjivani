import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django
django.setup()

# Set up logging
import logging
logging.basicConfig(level=logging.DEBUG)

from rest_framework.test import APIClient
from apps.identity.models import User
from rest_framework_simplejwt.tokens import RefreshToken

# Get the caregiver user
user = User.objects.get(email='caregiver@medadhere.test')

# Create tokens
refresh = RefreshToken.for_user(user)
access_token_str = str(refresh.access_token)

print("Testing caregiver/patients endpoint...")
print(f"Access token: {access_token_str[:50]}...")

# Use DRF test client
client = APIClient()
client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token_str}')

# Test the endpoint
response = client.get('/api/v1/caregivers/patients/')
print(f"Status: {response.status_code}")
print(f"Response: {response.data if hasattr(response, 'data') else response.content}")
