#!/usr/bin/env python
"""
One-shot password reset script.
Run from the backend directory:
    python reset_password.py

This connects to the Neon database using the .env credentials,
finds the user by email, and resets the password.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

# Load .env manually before Django setup
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import django
django.setup()

from apps.identity.models import User

TARGET_EMAIL   = 'antigravitykeliye003@gmail.com'
NEW_PASSWORD   = 'Admin@12345'

try:
    user = User.objects.get(email=TARGET_EMAIL)
    user.set_password(NEW_PASSWORD)
    user.is_active         = True
    user.is_email_verified = True
    user.save(update_fields=['password', 'is_active', 'is_email_verified'])
    print(f"[OK] Password reset for: {user.email}")
    print(f"     Role       : {user.role}")
    print(f"     Full name  : {user.full_name}")
    print(f"     New password: {NEW_PASSWORD}")
except User.DoesNotExist:
    print(f"[ERROR] No user found with email: {TARGET_EMAIL}")
    print("Listing all existing emails:")
    for u in User.objects.all().values('email', 'role', 'is_active')[:20]:
        print(f"  - {u['email']}  role={u['role']}  active={u['is_active']}")
    sys.exit(1)
