# Seed Credentials And Inputs

This file records the inputs and secrets needed to run the seed commands described in the handover docs and backend plan.

## Core seed commands

| Command | Data file | Required credentials or inputs |
|---|---|---|
| `python manage.py seed_subscription_plans` | `medadhere_backend/seed_data/subscription_plans.json` | None |
| `python manage.py seed_medications_db` | `medadhere_backend/seed_data/medications.json` | None |
| `python manage.py seed_icd10_codes` | `medadhere_backend/seed_data/icd10_codes.json` | None |
| `python manage.py create_superadmin` | N/A | Admin email, password, full name. Defaults exist in the command, but production should override them. |
| `python manage.py generate_device_ids --product-id X --batch-size 1000` | `medadhere_backend/seed_data/device_id_batch_template.json` | A valid product UUID and the target batch size. |

## Extension seed commands

| Command | Data file | Required credentials or inputs |
|---|---|---|
| `python manage.py seed_pharmacy_partners` | `medadhere_backend/seed_data/pharmacy_partners.json` | Pharmacy API keys and webhook secrets for each partner. |
| `python manage.py seed_whatsapp_templates` | `medadhere_backend/seed_data/whatsapp_templates.json` | WhatsApp Business API template approval, sender configuration, and language coverage. |
| `python manage.py sync_openfda_interactions --batch-size 1000` | `medadhere_backend/seed_data/openfda_interactions.json` | OpenFDA access is public, but the backend should be allowed outbound HTTP. |
| `python manage.py generate_abha_test_data` | `medadhere_backend/seed_data/abha_test_data.json` | ABHA/ABDM sandbox credentials if the generator talks to a live sandbox. |
| `python manage.py export_cdsco_report --from 2024-01-01 --to 2024-12-31` | N/A | CDSCO report export parameters; no static secret is stored here. |
| `python manage.py create_tenant --name "Apollo Indore" --subdomain apollo-indore --plan HOSPITAL --admin-email admin@apollo.com` | `medadhere_backend/seed_data/tenant_examples.json` | Tenant admin email, tenant plan, and a valid owner account. |
| `python manage.py check_fhir_connections` | N/A | FHIR server URLs and OAuth tokens are stored per connection; the check command needs those records in the database. |

## Environment variables worth keeping out of source control

- `SECRET_KEY`
- `FIELD_ENCRYPTION_KEY`
- `REDIS_URL`
- `DATABASE_URL` if you move beyond the default SQLite setup
- Partner API keys and webhook secrets for pharmacy integrations
- WhatsApp Business API tokens and template identifiers
- ABHA / ABDM sandbox tokens if used in a live test environment

## Notes

- The JSON files are sample seed payloads, not live credentials.
- Replace any placeholder values before using them against non-development systems.
- Keep production secrets in environment variables or a secret manager, not in `credential.md`.