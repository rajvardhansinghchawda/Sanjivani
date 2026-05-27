#!/usr/bin/env python
import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("TESTING API WITH FIX")
print("=" * 60)

# Step 1: Login
print("\n1️⃣ LOGIN")
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/login/",
    json={"email": "patient+apollo-indore@medadhere.test", "password": "Patient@12345"}
)

print(f"Status: {login_response.status_code}")
if login_response.status_code != 200:
    print(json.dumps(login_response.json(), indent=2))
    exit(1)

data = login_response.json()["data"]
access_token = data["access"]
user_id = data["user"]["id"]  # Use the logged-in user's ID, not a hardcoded one

print(f"✅ Logged in")
print(f"   User ID: {user_id}")
print(f"   Access token: {access_token[:30]}...")

# Step 2: Test AI Insights with correct patient ID
print("\n2️⃣ TEST AI INSIGHTS")
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

ai_response = requests.get(
    f"{BASE_URL}/api/v1/ai/insights/{user_id}/",
    headers=headers
)

print(f"Status: {ai_response.status_code}")
if ai_response.status_code == 200:
    print("✅ AI Insights endpoint WORKS!")
    result = ai_response.json()
    if result.get("success"):
        insights = result.get("data", {})
        print(f"   Adherence Risk: {insights.get('adherence_risk')}")
        print(f"   Confidence: {insights.get('confidence_score')}")
    else:
        print(f"   Error: {result.get('error')}")
else:
    print(f"Status {ai_response.status_code}")
    print(json.dumps(ai_response.json(), indent=2))
