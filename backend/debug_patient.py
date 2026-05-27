#!/usr/bin/env python
import requests
import json

BASE_URL = "http://localhost:8000"

print("=" * 60)
print("DEBUGGING PATIENT PROFILE")
print("=" * 60)

# Step 1: Login
login_response = requests.post(
    f"{BASE_URL}/api/v1/auth/login/",
    json={"email": "patient+apollo-indore@medadhere.test", "password": "Patient@12345"}
)

data = login_response.json()["data"]
access_token = data["access"]
user_id = data["user"]["id"]

print(f"User ID from login: {user_id}")

# Step 2: Check user profile
print("\n2️⃣ CHECK USER PROFILE")
headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

profile_response = requests.get(f"{BASE_URL}/api/v1/users/me/", headers=headers)
print(f"Status: {profile_response.status_code}")
if profile_response.status_code == 200:
    user_data = profile_response.json().get("data", {})
    print(f"User: {user_data.get('email')}")
    print(f"Role: {user_data.get('role')}")

# Step 3: Check patient profile
print("\n3️⃣ CHECK PATIENT PROFILE")

patient_response = requests.get(f"{BASE_URL}/api/v1/patients/me/", headers=headers)
print(f"Status: {patient_response.status_code}")
if patient_response.status_code == 200:
    patient_data = patient_response.json().get("data", {})
    print(f"Patient exists: YES")
    print(f"Patient ID: {patient_data.get('id')}")
else:
    result = patient_response.json()
    print(f"Patient exists: NO")
    print(f"Error: {result.get('error', {}).get('message')}")
