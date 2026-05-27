"""Seed all MedAdhere reference data in a single run.

Run directly from the repo root:
    python medadhere_backend/scripts/seed_all_data.py

The script is idempotent where possible and writes a Markdown report to
reports/seed_all_report.md.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
SEED_DIR = BASE_DIR / 'seed_data'
REPORT_DIR = REPO_ROOT / 'reports'

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django  # noqa: E402


django.setup()

from django.db import transaction  # noqa: E402
from django.utils import timezone  # noqa: E402

from apps.clinical.models import DrugInteraction, Medication  # noqa: E402
from apps.identity.models import User, UserRole  # noqa: E402
from apps.clinical.models import Patient  # noqa: E402
from apps.subscriptions.models import SubscriptionPlan  # noqa: E402
from apps.tenants.models import Tenant, TenantAdmin  # noqa: E402


@dataclass
class StepResult:
    name: str
    created: int = 0
    updated: int = 0
    skipped: int = 0
    notes: str = ''


def load_json(filename: str) -> Any:
    path = SEED_DIR / filename
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def ensure_superadmin(email: str, password: str, full_name: str) -> StepResult:
    result = StepResult(name='superadmin')
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'full_name': full_name,
            'role': UserRole.SUPER_ADMIN,
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
            'is_email_verified': True,
        },
    )
    if created:
        user.set_password(password)
        user.save(update_fields=['password'])
        result.created = 1
        return result

    changed_fields = []
    if user.full_name != full_name:
        user.full_name = full_name
        changed_fields.append('full_name')
    if user.role != UserRole.SUPER_ADMIN:
        user.role = UserRole.SUPER_ADMIN
        changed_fields.append('role')
    if not user.is_staff:
        user.is_staff = True
        changed_fields.append('is_staff')
    if not user.is_superuser:
        user.is_superuser = True
        changed_fields.append('is_superuser')
    if not user.is_active:
        user.is_active = True
        changed_fields.append('is_active')
    if not user.is_email_verified:
        user.is_email_verified = True
        changed_fields.append('is_email_verified')
    if changed_fields:
        user.save(update_fields=changed_fields)
        result.updated = 1
    return result


def seed_subscription_plans() -> StepResult:
    result = StepResult(name='subscription_plans')
    for item in load_json('subscription_plans.json'):
        _, created = SubscriptionPlan.objects.update_or_create(
            slug=item['slug'],
            defaults={
                'name': item['name'],
                'price_monthly': item['price_monthly'],
                'price_yearly': item['price_yearly'],
                'features': item.get('features', {}),
                'max_medications': item.get('max_medications', 5),
                'max_caregivers': item.get('max_caregivers', 1),
            },
        )
        if created:
            result.created += 1
        else:
            result.updated += 1
    return result


def seed_medications() -> StepResult:
    result = StepResult(name='medications')
    for item in load_json('medications.json'):
        _, created = Medication.objects.update_or_create(
            name=item['name'],
            defaults={
                'generic_name': item.get('generic_name'),
                'drug_class': item.get('drug_class'),
                'form': item.get('form', 'TABLET'),
                'default_unit': item.get('default_unit', 'mg'),
                'strength': item.get('strength'),
                'requires_food': item.get('requires_food', False),
                'refrigeration_required': item.get('refrigeration_required', False),
                'is_controlled_substance': item.get('is_controlled_substance', False),
                'barcode': item.get('barcode'),
                'photo_url': item.get('photo_url'),
                'description': item.get('description'),
                'side_effects': item.get('side_effects'),
                'is_verified': item.get('is_verified', True),
            },
        )
        if created:
            result.created += 1
        else:
            result.updated += 1
    return result


def seed_drug_interactions() -> StepResult:
    result = StepResult(name='drug_interactions')
    interactions = load_json('openfda_interactions.json')
    for item in interactions:
        med_a = Medication.objects.filter(name=item['drug_a']).first()
        med_b = Medication.objects.filter(name=item['drug_b']).first()
        if not med_a or not med_b:
            result.skipped += 1
            continue
        _, created = DrugInteraction.objects.update_or_create(
            medication_a=med_a,
            medication_b=med_b,
            defaults={
                'severity': item['severity'],
                'description': item['description'],
                'source': item.get('source', 'OPENFDA'),
            },
        )
        if created:
            result.created += 1
        else:
            result.updated += 1
    return result


def seed_tenants(owner_user: User | None) -> StepResult:
    result = StepResult(name='tenants')
    for item in load_json('tenant_examples.json'):
        tenant, created = Tenant.objects.update_or_create(
            subdomain=item['subdomain'],
            defaults={
                'name': item['name'],
                'plan': item.get('plan', 'CLINIC'),
                'max_patients': item.get('max_patients', 500),
                'is_active': item.get('is_active', True),
                'schema_name': item['subdomain'].replace('-', '_'),
            },
        )
        if created:
            result.created += 1
        else:
            result.updated += 1

        if owner_user:
            TenantAdmin.objects.update_or_create(
                tenant=tenant,
                user=owner_user,
                defaults={'is_primary': True},
            )
    return result


def seed_reference_files() -> StepResult:
    """Track reference-only seed files that do not have backing models yet."""
    skipped_files = [
        'icd10_codes.json',
        'pharmacy_partners.json',
        'whatsapp_templates.json',
        'abha_test_data.json',
        'device_id_batch_template.json',
    ]
    result = StepResult(name='reference_only', skipped=len(skipped_files))
    result.notes = ', '.join(skipped_files)
    return result


CREDENTIALS: list[dict] = []


def seed_sample_accounts() -> StepResult:
    """Create one sample account per tenant (tenant admin + patient) and a few role users.
    Writes credential entries to `CREDENTIALS` for later dumping.
    """
    result = StepResult(name='sample_accounts')

    # Per-tenant: create an owner/admin and a patient
    for tenant in Tenant.objects.all():
        # Tenant admin
        admin_email = f'owner+{tenant.subdomain}@medadhere.test'
        admin_password = 'Owner@12345'
        admin_user, created = User.objects.get_or_create(
            email=admin_email,
            defaults={
                'full_name': f'{tenant.name} Owner',
                'role': UserRole.ADMIN,
                'is_active': True,
                'is_email_verified': True,
            },
        )
        if created:
            admin_user.set_password(admin_password)
            admin_user.save(update_fields=['password'])
            result.created += 1
        else:
            result.updated += 1

        TenantAdmin.objects.update_or_create(
            tenant=tenant, user=admin_user, defaults={'is_primary': True}
        )
        CREDENTIALS.append({'email': admin_email, 'password': admin_password, 'role': 'TENANT_ADMIN', 'tenant': tenant.subdomain})

        # Patient
        patient_email = f'patient+{tenant.subdomain}@medadhere.test'
        patient_password = 'Patient@12345'
        patient_user, p_created = User.objects.get_or_create(
            email=patient_email,
            defaults={
                'full_name': f'{tenant.name} Patient',
                'role': UserRole.PATIENT,
                'is_active': True,
                'is_email_verified': True,
            },
        )
        if p_created:
            patient_user.set_password(patient_password)
            patient_user.save(update_fields=['password'])
            result.created += 1
        else:
            result.updated += 1

        # Ensure Patient profile
        Patient.objects.get_or_create(user=patient_user, defaults={'hospital_name': tenant.name})
        CREDENTIALS.append({'email': patient_email, 'password': patient_password, 'role': 'PATIENT', 'tenant': tenant.subdomain})

    # Add a few cross-tenant role users for API testing
    role_users = [
        ('caregiver@medadhere.test', UserRole.CAREGIVER, 'Caregiver@123'),
        ('pharmacist@medadhere.test', UserRole.PHARMACIST, 'Pharma@123'),
        ('nurse@medadhere.test', UserRole.NURSE, 'Nurse@123'),
    ]
    for email, role, pwd in role_users:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'full_name': role.title(), 'role': role, 'is_active': True, 'is_email_verified': True},
        )
        if created:
            user.set_password(pwd)
            user.save(update_fields=['password'])
            result.created += 1
        else:
            result.updated += 1
        CREDENTIALS.append({'email': email, 'password': pwd, 'role': role})

    return result


def write_credentials(credentials: list[dict]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    cred_path = REPORT_DIR / 'seed_credentials.md'
    with cred_path.open('w', encoding='utf-8') as handle:
        handle.write('# Seeded Credentials\n\n')
        handle.write('Use these accounts for API testing. Passwords are plaintext for local/dev only.\n\n')
        handle.write('| Email | Password | Role | Tenant |\n')
        handle.write('|---|---|---|---|\n')
        for c in credentials:
            tenant = c.get('tenant', '')
            handle.write(f"| {c['email']} | {c['password']} | {c['role']} | {tenant} |\n")
    return cred_path


def write_report(results: list[StepResult], admin_email: str) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORT_DIR / 'seed_all_report.md'
    total_created = sum(item.created for item in results)
    total_updated = sum(item.updated for item in results)
    total_skipped = sum(item.skipped for item in results)

    with report_path.open('w', encoding='utf-8') as handle:
        handle.write('# Seed All Report\n\n')
        handle.write(f'Generated at: {timezone.now().isoformat()}\n\n')
        handle.write(f'Admin user: `{admin_email}`\n\n')
        handle.write('| Step | Created | Updated | Skipped | Notes |\n')
        handle.write('|---|---:|---:|---:|---|\n')
        for item in results:
            handle.write(
                f'| {item.name} | {item.created} | {item.updated} | {item.skipped} | {item.notes} |\n'
            )
        handle.write('\n')
        handle.write(f'Total created: {total_created}\n\n')
        handle.write(f'Total updated: {total_updated}\n\n')
        handle.write(f'Total skipped: {total_skipped}\n')

    return report_path


def main() -> int:
    parser = argparse.ArgumentParser(description='Seed MedAdhere data in a single run.')
    parser.add_argument('--admin-email', default='admin@medadhere.com')
    parser.add_argument('--admin-password', default='Admin@12345')
    parser.add_argument('--admin-name', default='Platform Admin')
    args = parser.parse_args()

    results: list[StepResult] = []

    with transaction.atomic():
        admin_result = ensure_superadmin(args.admin_email, args.admin_password, args.admin_name)
        results.append(admin_result)

        results.append(seed_subscription_plans())
        results.append(seed_medications())
        results.append(seed_drug_interactions())
        results.append(seed_tenants(User.objects.filter(email=args.admin_email).first()))
        results.append(seed_reference_files())
        results.append(seed_sample_accounts())

    report_path = write_report(results, args.admin_email)
    cred_path = write_credentials(CREDENTIALS)

    print('Seed complete.')
    for item in results:
        print(f'- {item.name}: created={item.created}, updated={item.updated}, skipped={item.skipped}')
    print(f'Report written to: {report_path}')
    print(f'Credentials written to: {cred_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
