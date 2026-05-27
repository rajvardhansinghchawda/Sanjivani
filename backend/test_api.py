#!/usr/bin/env python
import os
import django
import requests
import json

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.identity.models import UserSession, User
from django.utils import timezone

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("STEP 1: LOGIN")
print("=" * 60)

login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/login/",
    json={"email": "patient+apollo-indore@medadhere.test", "password": "Patient@12345"}
)

print(f"Status: {login_response.status_code}")
login_data = login_response.json()
print(json.dumps(login_data, indent=2))

if login_response.status_code != 200:
    print("\n❌ Login failed!")
    exit(1)

access_token = login_data.get("data", {}).get("access")
patient_id = "e30fa80c-3bd2-46ea-993e-27cef6d802a4"

if not access_token:
    print("\n❌ No access token in response!")
    exit(1)

print(f"\n✅ Got access token: {access_token[:50]}...")

print("\n" + "=" * 60)
print("STEP 1.5: CHECK DATABASE SESSIONS")
print("=" * 60)

user = User.objects.get(email='patient+apollo-indore@medadhere.test')
sessions = UserSession.objects.filter(user=user).order_by('-created_at')[:3]

print(f"\nFound {sessions.count()} sessions for {user.email}:")
for i, session in enumerate(sessions, 1):
    checks = {
        "not_revoked": session.revoked_at is None,
        "not_expired": session.expires_at > timezone.now(),
        "not_deleted": session.deleted_at is None,
    }
    status = "✅ VALID" if all(checks.values()) else "❌ INVALID"
    print(f"\nSession {i}: {status}")
    print(f"  JTI: {session.jti[:50]}...")
    print(f"  Revoked: {session.revoked_at}")
    print(f"  Expires: {session.expires_at}")
    print(f"  Checks: {checks}")

print("\n" + "=" * 60)
print("STEP 2: TEST AI INSIGHTS ENDPOINT")
print("=" * 60)

headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

ai_response = requests.get(
    f"{BASE_URL}/api/v1/ai/insights/{patient_id}/",
    headers=headers
)

print(f"Status: {ai_response.status_code}")
print(json.dumps(ai_response.json(), indent=2))

if ai_response.status_code == 200:
    print("\n✅ AI Insights endpoint works!")
else:
    print(f"\n❌ AI Insights failed with {ai_response.status_code}")

print("\n" + "=" * 60)
print("STEP 3: TEST AI RISK SCORE ENDPOINT")
print("=" * 60)

risk_response = requests.get(
    f"{BASE_URL}/api/v1/ai/risk-score/{patient_id}/",
    headers=headers
)

print(f"Status: {risk_response.status_code}")
print(json.dumps(risk_response.json(), indent=2))

if risk_response.status_code == 200:
    print("\n✅ AI Risk Score endpoint works!")
else:
    print(f"\n❌ AI Risk Score failed with {risk_response.status_code}")

print("\n" + "=" * 60)
print("STEP 4: TEST WITHOUT AUTHORIZATION HEADER (should fail)")
print("=" * 60)

bad_response = requests.get(
    f"{BASE_URL}/api/v1/ai/insights/{patient_id}/",
    headers={"Content-Type": "application/json"}
)

print(f"Status: {bad_response.status_code}")
print(json.dumps(bad_response.json(), indent=2))

if bad_response.status_code == 401:
    print("\n✅ Correctly returns 401 without Authorization header")
else:
    print(f"\n⚠️  Expected 401 but got {bad_response.status_code}")
