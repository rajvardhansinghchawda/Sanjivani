"""Seed demo doctor accounts for MedAdhere.

Run from repo root:
    python medadhere_backend/scripts/seed_doctors.py

Idempotent — safe to run multiple times.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django  # noqa: E402
django.setup()

from django.db import transaction  # noqa: E402
from django.utils import timezone   # noqa: E402
from apps.identity.models import User, UserRole  # noqa: E402
from apps.doctor_portal.models import DoctorProfile  # noqa: E402


DOCTORS = [
    {
        'email':               'dr.sameer.patel@medadhere.test',
        'password':            'Doctor@12345',
        'full_name':           'Dr. Sameer Patel',
        'registration_number': 'MCI-2009-001',
        'specialization':      'Cardiologist',
        'hospital_name':       'AIIMS New Delhi',
        'experience_years':    15,
        'rating':              4.9,
        'review_count':        324,
        'consultation_fee':    500,
        'is_available':        True,
        'next_slot':           '11:30 AM Today',
        'languages':           ['Hindi', 'English'],
    },
    {
        'email':               'dr.meera.sharma@medadhere.test',
        'password':            'Doctor@12345',
        'full_name':           'Dr. Meera Sharma',
        'registration_number': 'MCI-2012-002',
        'specialization':      'Endocrinologist',
        'hospital_name':       'Fortis Hospital, Mumbai',
        'experience_years':    12,
        'rating':              4.8,
        'review_count':        218,
        'consultation_fee':    400,
        'is_available':        True,
        'next_slot':           '2:00 PM Today',
        'languages':           ['Hindi', 'English', 'Marathi'],
    },
    {
        'email':               'dr.arjun.reddy@medadhere.test',
        'password':            'Doctor@12345',
        'full_name':           'Dr. Arjun Reddy',
        'registration_number': 'MCI-2016-003',
        'specialization':      'General Physician',
        'hospital_name':       'Apollo Hospitals, Hyderabad',
        'experience_years':    8,
        'rating':              4.7,
        'review_count':        156,
        'consultation_fee':    300,
        'is_available':        True,
        'next_slot':           '4:30 PM Today',
        'languages':           ['Hindi', 'English', 'Telugu'],
    },
    {
        'email':               'dr.priya.nair@medadhere.test',
        'password':            'Doctor@12345',
        'full_name':           'Dr. Priya Nair',
        'registration_number': 'MCI-2014-004',
        'specialization':      'Pulmonologist',
        'hospital_name':       'Medanta, Gurugram',
        'experience_years':    10,
        'rating':              4.9,
        'review_count':        287,
        'consultation_fee':    600,
        'is_available':        False,
        'next_slot':           'Tomorrow 10:00 AM',
        'languages':           ['Hindi', 'English', 'Malayalam'],
    },
    {
        'email':               'dr.vikram.singh@medadhere.test',
        'password':            'Doctor@12345',
        'full_name':           'Dr. Vikram Singh',
        'registration_number': 'MCI-2004-005',
        'specialization':      'Diabetologist',
        'hospital_name':       'Max Hospital, Delhi',
        'experience_years':    20,
        'rating':              4.9,
        'review_count':        512,
        'consultation_fee':    700,
        'is_available':        True,
        'next_slot':           '12:00 PM Today',
        'languages':           ['Hindi', 'English', 'Punjabi'],
    },
    {
        'email':               'dr.kavita.joshi@medadhere.test',
        'password':            'Doctor@12345',
        'full_name':           'Dr. Kavita Joshi',
        'registration_number': 'MCI-2010-006',
        'specialization':      'Neurologist',
        'hospital_name':       'Narayana Health, Bangalore',
        'experience_years':    14,
        'rating':              4.8,
        'review_count':        198,
        'consultation_fee':    550,
        'is_available':        True,
        'next_slot':           '3:15 PM Today',
        'languages':           ['Hindi', 'English', 'Kannada'],
    },
]


def seed_doctors():
    created_count = 0
    updated_count = 0

    with transaction.atomic():
        for d in DOCTORS:
            user, user_created = User.objects.get_or_create(
                email=d['email'],
                defaults={
                    'full_name':        d['full_name'],
                    'role':             UserRole.DOCTOR,
                    'is_active':        True,
                    'is_email_verified': True,
                },
            )
            if user_created:
                user.set_password(d['password'])
                user.save(update_fields=['password'])
            elif user.role != UserRole.DOCTOR:
                user.role = UserRole.DOCTOR
                user.save(update_fields=['role'])

            profile, p_created = DoctorProfile.objects.update_or_create(
                user=user,
                defaults={
                    'registration_number': d['registration_number'],
                    'specialization':      d['specialization'],
                    'hospital_name':       d['hospital_name'],
                    'is_verified':         True,
                    'verified_at':         timezone.now(),
                    'experience_years':    d['experience_years'],
                    'rating':              d['rating'],
                    'review_count':        d['review_count'],
                    'consultation_fee':    d['consultation_fee'],
                    'is_available':        d['is_available'],
                    'next_slot':           d['next_slot'],
                    'languages':           d['languages'],
                },
            )

            if p_created:
                created_count += 1
                print(f'  CREATED  {d["full_name"]} <{d["email"]}>')
            else:
                updated_count += 1
                print(f'  UPDATED  {d["full_name"]} <{d["email"]}>')

    return created_count, updated_count


if __name__ == '__main__':
    print('Seeding demo doctors…')
    created, updated = seed_doctors()
    print(f'\nDone. Created: {created}  Updated: {updated}')
    print('\nAll doctor credentials (password: Doctor@12345):')
    for d in DOCTORS:
        print(f'  {d["email"]}')
