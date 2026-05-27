#!/usr/bin/env python
import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("TESTING WITH CORRECT PATIENT ID")
print("=" * 60)

# Step 1: Login
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/login/",
    json={"email": "patient+apollo-indore@medadhere.test", "password": "Patient@12345"}
)

data = login_response.json()["data"]
access_token = data["access"]

print(f"✅ Logged in")

# Get patient ID
headers = {"Authorization": f"Bearer {access_token}"}
patient_response = requests.get(f"{BASE_URL}/api/v1/patients/me/", headers=headers)
patient_id = patient_response.json().get("data", {}).get("id")

print(f"Patient ID: {patient_id}\n")

# Step 2: Test AI Insights with CORRECT patient ID
print("2️⃣ TEST AI INSIGHTS")
ai_response = requests.get(
    f"{BASE_URL}/api/v1/ai/insights/{patient_id}/",
    headers=headers
)

print(f"Status: {ai_response.status_code}")
if ai_response.status_code == 200:
    print("✅ AI Insights endpoint WORKS!")
    result = ai_response.json()
    if result.get("success"):
        insights = result.get("data", [])
        print("\n📊 INSIGHTS:")
        print(f"  Count: {len(insights)}")
        if insights:
            first = insights[0]
            print(f"  First Title: {first.get('title')}")
            print(f"  First Type: {first.get('type')}")
    else:
        print(f"Error: {result.get('error')}")
else:
    print(f"❌ Status {ai_response.status_code}")
    print(json.dumps(ai_response.json(), indent=2))
