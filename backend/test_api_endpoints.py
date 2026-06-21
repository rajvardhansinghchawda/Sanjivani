#!/usr/bin/env python
"""Test the ambulance API endpoints"""
import os
import sys
import django
import json
from django.test import Client
from django.urls import reverse

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

client = Client()

print("=" * 70)
print("Testing Ambulance API Endpoints")
print("=" * 70)

# Test 1: City-based search
print("\n1️⃣  City-based search (by city name):")
response = client.get('/api/ambulances/available/?city=Indore&type=icu')
print(f"   Status: {response.status_code}")
data = json.loads(response.content)
print(f"   Found: {data.get('count')} ambulances")
if data.get('ambulances'):
    for amb in data['ambulances']:
        print(f"     - {amb.get('vehicle_number')} ({amb.get('ambulance_type')})")

# Test 2: Nearby search (by coordinates)
print("\n2️⃣  Nearby search (by GPS coordinates, 15km radius):")
response = client.get('/api/ambulances/available/?lat=22.7200&lng=75.8580&radius=15&type=icu')
print(f"   Status: {response.status_code}")
data = json.loads(response.content)
print(f"   Found: {data.get('count')} ambulances")
if data.get('ambulances'):
    for amb in data['ambulances']:
        dist = amb.get('distance_km', 'N/A')
        print(f"     - {amb.get('vehicle_number')} ({amb.get('ambulance_type')}) - {dist}km away")

# Test 3: Nearby search without type filter
print("\n3️⃣  Nearby search (all ambulances, 10km radius):")
response = client.get('/api/ambulances/available/?lat=22.7196&lng=75.8577&radius=10')
print(f"   Status: {response.status_code}")
data = json.loads(response.content)
print(f"   Found: {data.get('count')} ambulances")
if data.get('ambulances'):
    for amb in data['ambulances']:
        dist = amb.get('distance_km', 'N/A')
        print(f"     - {amb.get('vehicle_number')} ({amb.get('ambulance_type')}) - {dist}km away")

# Test 4: Invalid coordinates (should return error)
print("\n4️⃣  Error test (invalid lat/lng):")
response = client.get('/api/ambulances/available/?lat=invalid&lng=invalid')
print(f"   Status: {response.status_code}")
data = json.loads(response.content)
print(f"   Error: {data.get('error', 'Unknown')}")

print("\n" + "=" * 70)
print("✅ API Testing Complete!")
print("=" * 70)
