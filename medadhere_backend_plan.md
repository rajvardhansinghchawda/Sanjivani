# MedAdhere — Backend Implementation Plan
> Stack: Django 5.x · DRF · PostgreSQL · Celery + Redis · JWT
> AI/ML module EXCLUDED — integrated separately by AI team.

---

## BUILD ORDER

Phase 0  → Scaffold + shared/ + agenthandover.py
Phase 1  → Identity (auth)
Phase 2  → Subscriptions (feature gates)
Phase 3  → Clinical (patients, caregivers, medications, prescriptions)
Phase 4  → Scheduling (reminder generation)
Phase 5  → Telemetry (dose logging — core loop)
Phase 6  → Celery (reminder dispatch + escalation)
Phase 7  → Notifications (push/SMS/email/WhatsApp/voice)
Phase 8  → Audit (HIPAA trail)
Phase 9  → IoT (device linking + event ingestion)
Phase 10 → Store (hardware orders + device ID system)
Phase 11 → Admin Panel
Phase 12 → Security + Indexes + Health Check

---

## PHASE 0 — Project Scaffold

### Directory Layout
```
medadhere_backend/
├── config/
│   ├── settings/base.py, development.py, production.py, testing.py
│   ├── urls.py
│   ├── celery.py
│   └── wsgi.py / asgi.py
├── apps/
│   ├── identity/
│   ├── clinical/
│   ├── scheduling/
│   ├── telemetry/
│   ├── iot/
│   ├── subscriptions/
│   ├── store/
│   ├── notifications/
│   ├── audit/
│   └── admin_panel/
├── shared/
│   ├── models.py        # BaseModel
│   ├── permissions.py
│   ├── pagination.py
│   ├── exceptions.py
│   ├── response.py
│   ├── decorators.py
│   └── utils/
│       ├── encryption.py
│       ├── uuid_generator.py
│       └── timezone_utils.py
├── agenthandover.py
├── requirements.txt
└── manage.py
```

### shared/models.py — BaseModel
```python
class BaseModel(models.Model):
    id         = UUIDField(primary_key=True, default=uuid.uuid4)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    deleted_at = DateTimeField(null=True, blank=True)   # soft delete
    version    = PositiveIntegerField(default=1)
    objects    = SoftDeleteManager()
    class Meta: abstract = True
```

### shared/response.py
```python
# All API responses follow this shape:
# Success: { "success": true, "message": "", "data": {}, "meta": {} }
# Error:   { "success": false, "error": { "code": "", "message": "", "details": {} } }
```

### Bootstrap
- Call `bootstrap_agents()` in `CoreConfig.ready()` to register all agents.

---

## PHASE 1 — Identity App

### Models
- **User**: UUID PK, email, full_name, role (PATIENT/CAREGIVER/NURSE/PHARMACIST/ADMIN/SUPER_ADMIN), phone, is_email_verified, mfa_enabled, password_changed_at
- **UserSession**: user FK, jti, refresh_token_hash, device_type, ip, revoked_at, expires_at
- **MFAConfig**: user OneToOne, totp_secret (AES-256 encrypted), backup_codes JSON, is_required
- **NotificationPreferences**: user OneToOne, push/sms/email/whatsapp/voice_enabled, quiet_hours
- **UserDevice**: user FK, fcm_token, apns_token, device_type, app_version

### API Endpoints
```
POST   /api/v1/auth/register/
POST   /api/v1/auth/login/
POST   /api/v1/auth/logout/
POST   /api/v1/auth/refresh/
POST   /api/v1/auth/password/change/
POST   /api/v1/auth/password/reset/
PUT    /api/v1/auth/password/reset/confirm/
POST   /api/v1/auth/mfa/setup/
POST   /api/v1/auth/mfa/verify/
POST   /api/v1/auth/mfa/backup-codes/

GET    /api/v1/users/me/
PATCH  /api/v1/users/me/
GET    /api/v1/users/me/sessions/
DELETE /api/v1/users/me/sessions/{id}/
GET    /api/v1/users/me/notifications/
PATCH  /api/v1/users/me/notifications/
POST   /api/v1/users/me/devices/
DELETE /api/v1/users/me/devices/{id}/
```

### Key Services
- `UserRegistrationService` — create user → broadcast USER_REGISTERED
- `AuthService` — authenticate, create UserSession, return JWT pair
- `MFAService` — TOTP / SMS OTP / backup code verify
- `MedAdhereJWTAuthentication` — validates session not revoked, token not stale

---

## PHASE 2 — Subscriptions App

### Models
- **SubscriptionPlan**: name, slug, price_monthly, price_yearly, features (JSON), max_medications, max_caregivers
- **UserSubscription**: user OneToOne, plan FK, status, started_at, expires_at, auto_renew, gateway_sub_id
- **SubscriptionInvoice**: subscription FK, amount, currency, status, paid_at, gateway_invoice_id, pdf_url

### Feature Gate (data-driven — no deploy needed)
```python
# subscriptions/gates.py
def check_feature(user, feature_key) -> bool | int: ...
def check_medication_limit(user): ...  # raises SubscriptionLimitError

# shared/decorators.py
@subscription_required('ai_insights')   # returns HTTP 402 if not on plan
```

### API Endpoints
```
GET    /api/v1/subscriptions/plans/
GET    /api/v1/subscriptions/current/
POST   /api/v1/subscriptions/upgrade/
POST   /api/v1/subscriptions/cancel/
GET    /api/v1/subscriptions/invoices/
GET    /api/v1/subscriptions/invoices/{id}/
POST   /api/v1/subscriptions/webhook/razorpay/
POST   /api/v1/subscriptions/webhook/stripe/
```

---

## PHASE 3 — Clinical App

### Models
- **Patient**: user OneToOne, patient_code, timezone, primary_language, is_hospitalized, cognitive_status, vision/hearing impairment flags
- **PatientCondition**: patient FK, icd10_code, condition_name, severity, diagnosed_at
- **Caregiver**: user OneToOne, is_professional, license_number
- **PatientCaregiverLink**: patient FK, caregiver FK, permission_level, can_receive_alerts, invite_token, invite_expires_at
- **Medication**: name, generic_name, drug_class, form, unit, requires_food, barcode, photo_url
- **DrugInteraction**: medication_a FK, medication_b FK, severity, description
- **Prescription**: patient FK, medication FK, prescribed_by, dosage, instructions, start_date, end_date, refill_alert_days, remaining_quantity
- **MedicationSchedule**: prescription FK, frequency_type, times_of_day JSON, days_of_week JSON, interval_days, timezone, is_active

### API Endpoints
```
# Patient
GET    /api/v1/patients/me/
PUT    /api/v1/patients/me/
PATCH  /api/v1/patients/me/hospitalize/
PATCH  /api/v1/patients/me/discharge/
GET    /api/v1/patients/me/conditions/
POST   /api/v1/patients/me/conditions/
DELETE /api/v1/patients/me/conditions/{id}/

# Caregivers
GET    /api/v1/patients/me/caregivers/
POST   /api/v1/patients/me/caregivers/invite/
DELETE /api/v1/patients/me/caregivers/{id}/
PATCH  /api/v1/patients/me/caregivers/{id}/permissions/
POST   /api/v1/caregiver-links/{token}/accept/

# Caregiver-facing
GET    /api/v1/caregivers/patients/
GET    /api/v1/caregivers/patients/{id}/
GET    /api/v1/caregivers/patients/{id}/adherence/
GET    /api/v1/caregivers/patients/{id}/alerts/

# Medications
GET    /api/v1/medications/
GET    /api/v1/medications/{id}/

# Prescriptions
GET    /api/v1/patients/me/prescriptions/
POST   /api/v1/patients/me/prescriptions/
GET    /api/v1/patients/me/prescriptions/{id}/
PUT    /api/v1/patients/me/prescriptions/{id}/
DELETE /api/v1/patients/me/prescriptions/{id}/

# Schedules
GET    /api/v1/patients/me/prescriptions/{id}/schedules/
POST   /api/v1/patients/me/prescriptions/{id}/schedules/
PUT    /api/v1/patients/me/prescriptions/{id}/schedules/{sid}/
DELETE /api/v1/patients/me/prescriptions/{id}/schedules/{sid}/
```

---

## PHASE 4 — Scheduling App

### Models
- **ReminderJob**: schedule FK, scheduled_at (UTC), status (PENDING/SENT/TAKEN/MISSED/SKIPPED/CANCELLED), dose_value, sent_at, confirmed_at, escalation_status, lead_minutes

### ScheduleGenerationService
- `generate_upcoming_reminders(schedule, days=30)` — DST-aware, stores UTC
- `on_schedule_updated(schedule)` — cancel future jobs + regenerate
- `on_timezone_change(patient, new_tz)` — cancel ALL future + regenerate all active schedules

### API Endpoints
```
GET    /api/v1/patients/me/schedule/today/
GET    /api/v1/patients/me/schedule/upcoming/
GET    /api/v1/patients/me/schedule/calendar/
```

---

## PHASE 5 — Telemetry App

### Models
- **AdherenceEvent**: patient FK, prescription FK, reminder_job FK (null), scheduled_at, taken_at, status, log_method (MANUAL/IOT_PILLBOX/CAREGIVER/API), device FK (null), late_minutes, is_confirmed
- **NotificationLog**: user FK, channel, type, status, sent_at, delivered_at, opened_at, provider_message_id

### Idempotency
```python
# unique_together = (prescription, scheduled_at)
AdherenceEvent.objects.get_or_create(prescription=p, scheduled_at=t, defaults={...})
```

### API Endpoints
```
POST   /api/v1/adherence/log/
GET    /api/v1/adherence/
GET    /api/v1/adherence/{id}/
POST   /api/v1/adherence/{id}/confirm/

GET    /api/v1/patients/me/adherence/rate/
GET    /api/v1/patients/me/adherence/streak/
GET    /api/v1/patients/me/adherence/heatmap/
GET    /api/v1/patients/me/adherence/summary/
GET    /api/v1/patients/me/reports/
GET    /api/v1/patients/me/reports/export/   (PREMIUM only)
```

---

## PHASE 6 — Celery Tasks

### Periodic (Beat)
| Task | Cron |
|---|---|
| check_subscription_expiries | 1:00 AM UTC daily |
| check_device_heartbeats | Every 5 minutes |
| send_refill_alerts | 9:00 AM UTC daily |
| purge_expired_sessions | Every hour |
| generate_weekly_adherence_reports | Monday 6:00 AM UTC |

### Event-driven
| Task | Trigger |
|---|---|
| send_reminder | ScheduleGenerationService (eta) |
| check_dose_taken | 15 min after send_reminder |
| run_escalation_step | T+15, T+30, T+60, T+240, T+1440 min |
| send_push / send_sms / send_email / send_whatsapp / send_voice | NotificationDispatcher |
| process_iot_event | DeviceEventIngestView |

### Escalation Ladder
```
T+0   → Dose window opens
T+15m → 1st patient reminder (push)
T+30m → 2nd patient reminder (SMS)
T+60m → Caregiver alert (can_receive_alerts=True)
T+4h  → Nurse / professional caregiver alert
T+24h → Emergency contact SMS
→ Ladder cancels immediately when patient logs dose
```

---

## PHASE 7 — Notifications App

### Channels
| Channel | Provider | Plan |
|---|---|---|
| push | FCM + APNs | All |
| sms | Twilio / MSG91 | Freemium+ |
| email | SendGrid / SES | Freemium+ |
| whatsapp | WhatsApp Business API | Premium |
| voice | Twilio Voice | Premium |

### NotificationDispatcher
- Resolves channels per: plan limits → user preferences → quiet hours
- Force channel override (e.g., email for security alerts)
- Multi-language templates (en, hi, mr, ta, te, bn, gu, kn, ml, pa, ur)
- Accessibility: vision impairment → force voice; hearing impairment → exclude voice

### API Endpoints
```
GET    /api/v1/notifications/
POST   /api/v1/notifications/{id}/read/
POST   /api/v1/notifications/read-all/
GET    /api/v1/notifications/unread-count/
```

---

## PHASE 8 — Audit App

### AuditLog Model
- actor FK (null), action, resource_type, resource_id, ip, user_agent, before_state JSON, after_state JSON, trace_id
- `AuditLogManager.delete()` raises `PermissionDenied` — IMMUTABLE
- DB: `REVOKE DELETE ON audit.audit_logs FROM app_user;`

---

## PHASE 9 — IoT App

### Models
- **Device**: user FK, unique_id_record OneToOne, device_name, api_key (unique), is_active, last_seen_at, battery_level, linked_patient FK
- **DeviceHeartbeat**: device FK, battery_level, firmware_version, wifi_strength, uptime_seconds
- **DeviceEvent**: device FK, event_uuid (unique — idempotency key), event_type, compartment_num, raw_payload, processed, adherence_event FK
- **DeviceCompartmentMapping**: device FK, compartment_number, prescription FK, next_scheduled_time

### Authentication
- `DeviceAPIKeyAuthentication` reads `X-Device-Key` header

### API Endpoints
```
# User (JWT auth)
GET    /api/v1/iot/devices/
POST   /api/v1/iot/devices/link/           (PREMIUM only)
GET    /api/v1/iot/devices/{id}/
DELETE /api/v1/iot/devices/{id}/
GET    /api/v1/iot/devices/{id}/status/
GET    /api/v1/iot/devices/{id}/events/
PUT    /api/v1/iot/devices/{id}/compartments/

# Firmware (Device API Key auth)
POST   /api/v1/iot/events/                 (idempotent via event_uuid)
POST   /api/v1/iot/heartbeat/
```

---

## PHASE 10 — Store App

### Models
- **HardwareProduct**: name, sku, price, description, specs JSON, stock_count, is_available
- **HardwareOrder**: user FK, product FK, quantity, total_price, status, shipping_address JSON, payment_id, shipped_at, tracking_number
- **DeviceUniqueID**: unique_code (MEDA-XXXX-XXXX-XXXX), product FK, order FK (null), is_provisioned, manufactured_at

### API Endpoints
```
GET    /api/v1/store/products/
GET    /api/v1/store/products/{id}/
POST   /api/v1/store/orders/
GET    /api/v1/store/orders/
GET    /api/v1/store/orders/{id}/
POST   /api/v1/store/orders/{id}/cancel/
```

---

## PHASE 11 — Admin Panel

### Admin REST API (admin JWT)
```
GET    /admin/api/v1/metrics/overview/
GET    /admin/api/v1/metrics/adherence/
GET    /admin/api/v1/metrics/revenue/
GET    /admin/api/v1/users/
GET    /admin/api/v1/users/{id}/
PATCH  /admin/api/v1/users/{id}/deactivate/
GET    /admin/api/v1/subscriptions/
PATCH  /admin/api/v1/subscriptions/{id}/extend/
POST   /admin/api/v1/devices/generate-ids/
GET    /admin/api/v1/devices/inventory/
GET    /admin/api/v1/devices/export-ids/
GET    /admin/api/v1/notifications/delivery-rates/
GET    /admin/api/v1/audit-logs/
GET    /admin/api/v1/system/health/
GET    /admin/api/v1/system/jobs/
POST   /admin/api/v1/notifications/test/
```

---

## PHASE 12 — Security, Indexes, Health

### Rate Limits
- login: 5/5min per IP
- register: 3/hour per IP
- mfa_verify: 10/5min per user
- iot_events: 100/min per device

### Key Indexes
```sql
CREATE INDEX idx_adherence_patient_scheduled
  ON telemetry.adherence_events(patient_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_reminder_jobs_eta
  ON telemetry.reminder_jobs(scheduled_at)
  WHERE status = 'PENDING';

CREATE INDEX idx_devices_api_key
  ON iot.devices(api_key) WHERE is_active = TRUE;
```

### Redis Cache Keys
| Key | TTL |
|---|---|
| adherence:today:{patient_id} | 60s |
| risk_score:{patient_id} | 1hr |
| subscription:{user_id} | 5min |
| high_risk_patients:{patient_id} | 1hr |

### Health Check
```
GET /api/v1/health/
→ { db, redis, celery_workers, last_reminder_sent, last_beat_run }
```

---

## Management Commands
```bash
python manage.py seed_subscription_plans
python manage.py seed_medications_db
python manage.py seed_icd10_codes
python manage.py create_superadmin
python manage.py generate_device_ids --product-id X --batch-size 1000
```

---

## AI/ML Stubs (For AI Team)
| Stub | Location |
|---|---|
| RiskScoreEngine.compute_risk() | ai_engine/risk_scorer.py |
| InsightGeneratorService.generate_for_patient() | ai_engine/insight_generator.py |
| PatternDetectionService.detect() | ai_engine/services.py |
| ComplexityScorer.compute() | ai_engine/services.py |
| RiskAssessmentFallback.assess() | ai_engine/fallback.py |

All wired through AIAgent in agenthandover.py — AI team only fills internals.
