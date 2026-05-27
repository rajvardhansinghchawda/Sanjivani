# MedAdhere Postman API Guide

Use this guide to test the backend manually in Postman.

## Base URL

- Local Docker: `http://127.0.0.1:8000`
- If you run Django directly: `http://localhost:8000`

## Auth Setup

Most endpoints require a JWT access token.

1. Call `POST /api/v1/auth/login/`
2. Copy the `access` token from the response
3. Add this header to protected requests:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Expiry & Refresh

- **Access token expires in 15 minutes** → Use refresh token to get a new one
- **Refresh token expires in 30 days** → Login again if refresh expires

When you get `401 token_not_valid`:

1. Copy your `refresh` token from the login response
2. Call `POST /api/v1/auth/refresh/` with:

```json
{
  "refresh": "<refresh_token>"
}
```

3. Copy the new `access` from the response
4. Use the new `access` in your next request

## Seeded Test Accounts

Use these local/dev accounts for testing.

| Email | Password | Role | Patient ID |
|---|---|---|---|
| owner+apollo-indore@medadhere.test | Owner@12345 | TENANT_ADMIN | - |
| patient+apollo-indore@medadhere.test | Patient@12345 | PATIENT | e30fa80c-3bd2-46ea-993e-27cef6d802a4 |
| owner+clinic-demo@medadhere.test | Owner@12345 | TENANT_ADMIN | - |
| patient+clinic-demo@medadhere.test | Patient@12345 | PATIENT | b65dfc71-87d4-4340-96d5-638e8154217a |
| caregiver@medadhere.test | Caregiver@123 | CAREGIVER | - |
| pharmacist@medadhere.test | Pharma@123 | PHARMACIST | - |
| nurse@medadhere.test | Nurse@123 | NURSE | - |

For AI endpoint testing, start with this patient:

- Email: `patient+apollo-indore@medadhere.test`
- Password: `Patient@12345`

**IMPORTANT:** When testing AI endpoints:
1. Login first to get access token
2. Call `GET /api/v1/patients/me/` to get the actual patient ID
3. Use that patient ID in AI endpoint URLs

Don't use user ID in AI URLs — use the patient profile ID instead.

## 1. Auth APIs

### Register

`POST /api/v1/auth/register/`

```json
{
  "email": "patient.demo@example.com",
  "password": "StrongPass@123",
  "full_name": "Demo Patient",
  "phone_number": "+919999999999",
  "role": "PATIENT"
}
```

### Login

`POST /api/v1/auth/login/`

```json
{
  "email": "patient+apollo-indore@medadhere.test",
  "password": "Patient@12345"
}
```

### Refresh token

`POST /api/v1/auth/refresh/`

```json
{
  "refresh": "<refresh_token>"
}
```

### Logout

`POST /api/v1/auth/logout/`

```json
{
  "refresh": "<refresh_token>"
}
```

### Change password

`POST /api/v1/auth/password/change/`

```json
{
  "old_password": "Patient@12345",
  "new_password": "NewStrongPass@123"
}
```

### Request password reset

`POST /api/v1/auth/password/reset/`

```json
{
  "email": "patient+apollo-indore@medadhere.test"
}
```

### Confirm password reset

`PUT /api/v1/auth/password/reset/confirm/`

```json
{
  "token": "<reset_token>",
  "new_password": "NewStrongPass@123"
}
```

### MFA setup

`POST /api/v1/auth/mfa/setup/`

No body.

### MFA verify

`POST /api/v1/auth/mfa/verify/`

```json
{
  "user_id": "<uuid_from_login_or_profile>",
  "code": "123456"
}
```

### MFA backup codes

`POST /api/v1/auth/mfa/backup-codes/`

No body.

## 2. User APIs

### My profile

`GET /api/v1/users/me/`

`PATCH /api/v1/users/me/`

```json
{
  "full_name": "Apollo Patient Updated",
  "phone_number": "+919888888888",
  "preferred_language": "en",
  "profile_photo_url": "https://example.com/photo.jpg"
}
```

### My sessions

`GET /api/v1/users/me/sessions/`

### Revoke one session

`DELETE /api/v1/users/me/sessions/<session_id>/`

No body.

### Notification preferences

`GET /api/v1/users/me/notifications/`

`PATCH /api/v1/users/me/notifications/`

```json
{
  "push_enabled": true,
  "sms_enabled": true,
  "email_enabled": true,
  "whatsapp_enabled": false,
  "voice_call_enabled": false,
  "quiet_hours_start": "22:00:00",
  "quiet_hours_end": "07:00:00",
  "reminder_lead_mins": 30
}
```

### Register device token

`POST /api/v1/users/me/devices/`

```json
{
  "fcm_token": "<fcm_token>",
  "apns_token": "",
  "device_type": "android",
  "device_name": "Pixel 8",
  "app_version": "1.0.0"
}
```

### Remove device token

`DELETE /api/v1/users/me/devices/<device_id>/`

No body.

## 3. Subscription APIs

All prices are in **Indian Rupees (₹)**.

### Plans

`GET /api/v1/subscriptions/plans/`

### Current subscription

`GET /api/v1/subscriptions/current/`

### Upgrade subscription

`POST /api/v1/subscriptions/upgrade/`

This endpoint requires `plan_id` in request body.

1. First call `GET /api/v1/subscriptions/plans/`
2. Copy one plan `id` from the response
3. Call upgrade with this body:

```json
{
  "plan_id": "<plan_uuid_from_plans_api>"
}
```

### Cancel subscription

`POST /api/v1/subscriptions/cancel/`

No body.

### Invoices

`GET /api/v1/subscriptions/invoices/`

### Webhooks

`POST /api/v1/subscriptions/webhook/razorpay/`

`POST /api/v1/subscriptions/webhook/stripe/`

These are webhook endpoints. Use the provider-specific signature headers and payloads from the payment gateway.

## 4. Patient APIs

### My patient profile

`GET /api/v1/patients/me/`

`PATCH /api/v1/patients/me/`

```json
{
  "date_of_birth": "1990-01-15",
  "gender": "male",
  "blood_group": "O+",
  "timezone": "Asia/Kolkata",
  "primary_language": "en",
  "emergency_contact_name": "John Doe",
  "emergency_contact_phone": "+919999999999",
  "cognitive_status": "normal",
  "has_vision_impairment": false,
  "has_hearing_impairment": false,
  "requires_assistance": false
}
```

### Hospitalize / discharge

`POST /api/v1/patients/me/hospitalize/`

```json
{
  "hospitalized_since": "2026-05-05T10:30:00Z",
  "discharge_expected_at": "2026-05-10T10:30:00Z",
  "hospital_name": "Apollo Hospital"
}
```

`POST /api/v1/patients/me/discharge/`

No body.

### Conditions

`GET /api/v1/patients/me/conditions/`

`POST /api/v1/patients/me/conditions/`

```json
{
  "icd10_code": "I10",
  "condition_name": "Hypertension",
  "severity": "moderate",
  "diagnosed_at": "2025-01-01",
  "notes": "Controlled with medication",
  "is_active": true
}
```

`DELETE /api/v1/patients/me/conditions/<condition_id>/`

No body.

### Caregivers

`GET /api/v1/patients/me/caregivers/`

`POST /api/v1/patients/me/caregivers/invite/`

```json
{
  "caregiver_email": "caregiver@medadhere.test",
  "permission_level": "full_access",
  "can_receive_alerts": true
}
```

`PATCH /api/v1/patients/me/caregivers/<link_id>/permissions/`

```json
{
  "permission_level": "manage_schedule",
  "can_receive_alerts": true
}
```

`DELETE /api/v1/patients/me/caregivers/<link_id>/`

No body.

### Prescriptions

`GET /api/v1/patients/me/prescriptions/`

`POST /api/v1/patients/me/prescriptions/`

```json
{
  "medication": "<medication_uuid>",
  "prescribed_by": "Dr. Smith",
  "dosage_value": 1,
  "dosage_unit": "tablet",
  "instructions": "Take after breakfast",
  "start_date": "2026-05-01",
  "end_date": "2026-06-01",
  "is_indefinite": false,
  "refill_alert_days": 5,
  "total_quantity": 30,
  "remaining_quantity": 30,
  "purpose": "Blood pressure control",
  "special_instructions": "Avoid alcohol",
  "photo_url": "",
  "notes": "Morning dose"
}
```

`PATCH /api/v1/patients/me/prescriptions/<prescription_id>/`

```json
{
  "instructions": "Take after dinner",
  "end_date": "2026-07-01",
  "is_indefinite": false,
  "refill_alert_days": 7,
  "notes": "Updated by doctor"
}
```

### Prescription schedules

`POST /api/v1/patients/me/prescriptions/<prescription_id>/schedules/`

```json
{
  "frequency_type": "DAILY",
  "times_of_day": ["08:00", "20:00"],
  "days_of_week": [],
  "interval_days": 1,
  "cycle_on_days": 0,
  "cycle_off_days": 0,
  "timezone": "Asia/Kolkata",
  "is_active": true,
  "lead_minutes": 30
}
```

`PATCH /api/v1/patients/me/prescriptions/<prescription_id>/schedules/<schedule_id>/`

Use the same fields as above.

## 5. Caregiver APIs

### Patient list

`GET /api/v1/caregivers/patients/`

### Patient detail and alerts

`GET /api/v1/caregivers/patients/<patient_id>/`

`GET /api/v1/caregivers/patients/<patient_id>/adherence/`

`GET /api/v1/caregivers/patients/<patient_id>/alerts/`

## 6. Reminder and Adherence APIs

### Reminder lists

`GET /api/v1/reminders/today/`

`GET /api/v1/reminders/upcoming/?days=7`

`GET /api/v1/reminders/<reminder_id>/`

### Log a reminder dose

`POST /api/v1/reminders/<reminder_id>/log/`

```json
{
  "status": "TAKEN",
  "taken_at": "2026-05-05T08:30:00Z",
  "with_food": true,
  "notes": "Taken after breakfast",
  "side_effects": "none",
  "mood_score": 8,
  "pain_score": 1,
  "latitude": 12.971599,
  "longitude": 77.594566
}
```

### Snooze a reminder

`POST /api/v1/reminders/<reminder_id>/snooze/`

```json
{
  "minutes": 10
}
```

### Manual dose entry

`POST /api/v1/adherence/manual/`

```json
{
  "prescription_id": "<prescription_uuid>",
  "taken_at": "2026-05-05T08:30:00Z",
  "dose_value": 1,
  "notes": "Forgot to tap reminder",
  "source": "APP"
}
```

### Adherence analytics

`GET /api/v1/adherence/summary/?days=30`

`GET /api/v1/adherence/timeline/?days=30`

`GET /api/v1/adherence/medications/?days=30`

`GET /api/v1/adherence/history/?days=7&status=TAKEN&prescription_id=<uuid>`

`GET /api/v1/adherence/history/<log_id>/`

`PATCH /api/v1/adherence/history/<log_id>/`

```json
{
  "notes": "Updated note",
  "side_effects": "mild nausea",
  "mood_score": 7,
  "pain_score": 2,
  "with_food": true
}
```

`GET /api/v1/adherence/export/?days=90&format=csv`

## 7. Telemetry, IoT, and Notifications

### Telemetry API

`POST /api/v1/iot-telemetry/ingest/`

```json
{
  "event_type": "dose_taken",
  "payload": {
    "device_id": "iot-1",
    "battery": 82,
    "signal": -61
  },
  "occurred_at": "2026-05-05T08:30:00Z",
  "idempotency_key": "abc-123",
  "sequence_no": 1
}
```

`GET /api/v1/iot-telemetry/devices/`

`GET /api/v1/iot-telemetry/devices/<device_id>/`

`GET /api/v1/iot-telemetry/<device_id>/resolve/`

### IoT Device APIs (User Management)
*Requires JWT Authorization header: `Bearer <access_token>`*

`GET /api/v1/iot/devices/`
List all linked devices.

`POST /api/v1/iot/devices/validate-code/`
Check if a code like `MEDA-ABCD` is valid before trying to link.
```json
{ "code": "MEDA-ABCD" }
```

`POST /api/v1/iot/devices/link/`
Link a device to the logged-in patient.
```json
{
  "unique_id": "MEDA-XXXX-XXXX-XXXX",
  "device_name": "My Smart Dispenser",
  "device_type": "CIRCULAR_PILL_DISPENSER"
}
```

`GET /api/v1/iot/devices/<device_id>/status/`
Get real-time status (battery, sensors, online/offline).

`GET /api/v1/iot/devices/<device_id>/compartments/`
List all 12 compartments and what medicine is inside.

`PUT /api/v1/iot/devices/<device_id>/compartments/`
Assign a prescription to a compartment and set schedule times.
```json
{
  "compartments": [
    {
      "compartment_num": 1,
      "prescription": "<uuid>",
      "scheduled_times": ["08:00", "20:00"]
    }
  ]
}
```

---

### IoT Firmware APIs (Device Communication)
*Requires Device Key header: `X-Device-Key: <device_api_key>`*
*Note: No JWT needed for these endpoints.*

`POST /api/v1/iot/events/`
Device sends events (BOOT, LID_OPENED, DOSE_TAKEN, etc.)
```json
{
  "event_uuid": "<unique_id_for_idempotency>",
  "event_type": "DEVICE_BOOT",
  "firmware_version": "1.0.0",
  "battery_level": 85,
  "stepper_status": "ok",
  "servo_status": "ok",
  "ultrasonic_status": "ok"
}
```

`POST /api/v1/iot/heartbeat/`
Sent every 5 minutes by ESP32.
```json
{
  "battery_level": 82,
  "wifi_strength": -61,
  "uptime_seconds": 3600,
  "firmware_version": "1.0.0"
}
```

`GET /api/v1/iot/devices/<device_id>/commands/`
Long-polling or periodic check for new commands from backend.
**Response Example:**
```json
{
  "commands": [
    {
      "command_id": "<uuid>",
      "type": "SYNC_SCHEDULE",
      "payload": { "schedule": [...] }
    }
  ]
}
```

### Notifications

`GET /api/v1/notifications/`

`POST /api/v1/notifications/read-all/` or `GET` depending on how your client is wired

`POST /api/v1/notifications/<notification_id>/read/` or `GET` depending on the client

`DELETE /api/v1/notifications/<notification_id>/`

No body for notification actions.

## 8. Store, Pharmacy, Doctor, Family, Vitals, Gamification, WhatsApp

### Store

`GET /api/v1/store/products/`

`GET /api/v1/store/products/<product_id>/`

`GET /api/v1/store/orders/`

`POST /api/v1/store/orders/`

```json
{
  "product_id": "<hardware_product_uuid>",
  "quantity": 1,
  "shipping_address": "Apollo Indore, Indore, MP",
  "payment_id": "pay_test_123"
}
```

`GET /api/v1/store/orders/<order_id>/`

`POST /api/v1/store/orders/<order_id>/cancel/`

No body.

### Pharmacy

`GET /api/v1/pharmacy/partners/`

`GET /api/v1/pharmacy/integration/`

`PATCH /api/v1/pharmacy/integration/`

```json
{
  "preferred_partner": "<partner_uuid>",
  "delivery_address": "Apollo Indore, Indore, MP",
  "saved_payment_method": "card_ending_4242",
  "auto_refill_enabled": true
}
```

`POST /api/v1/pharmacy/integration/auto-refill/`

```json
{
  "auto_refill_enabled": true
}
```

`GET /api/v1/pharmacy/refill-orders/`

`POST /api/v1/pharmacy/refill-orders/`

```json
{
  "prescription": "<prescription_uuid>",
  "partner": "<pharmacy_partner_uuid>",
  "quantity_ordered": 30,
  "notes": "Monthly refill"
}
```

`POST /api/v1/pharmacy/refill-orders/<order_id>/cancel/`

No body.

`POST /api/v1/pharmacy/webhook/<partner_slug>/`

```json
{
  "order_id": "partner-order-001",
  "status": "accepted"
}
```

This webhook also needs the `X-MedAdhere-Signature` header.

### Doctor portal

`GET /api/v1/doctor/profiles/`

`POST /api/v1/doctor/profiles/`

`GET /api/v1/doctor/links/`

`POST /api/v1/doctor/links/`

`GET /api/v1/doctor/prescriptions/`

`POST /api/v1/doctor/prescriptions/`

These are standard DRF router endpoints. Use the response schema from the list endpoints to mirror the body fields.

### Family

`GET /api/v1/family/groups/`

`POST /api/v1/family/groups/`

Use the router response schema for the exact fields.

### Vitals

`GET /api/v1/vitals/targets/`

`POST /api/v1/vitals/targets/`

`GET /api/v1/vitals/readings/`

`POST /api/v1/vitals/readings/`

Typical body:

```json
{
  "vital_type": "bp",
  "value_primary": 120,
  "value_secondary": 80,
  "unit": "mmHg",
  "recorded_at": "2026-05-05T08:30:00Z",
  "notes": "Morning reading"
}
```

### Gamification

`GET /api/v1/gamification/badges/`

`GET /api/v1/gamification/scores/`

`GET /api/v1/gamification/summary/`

`POST /api/v1/gamification/ping/`

```json
{
  "streak": true
}
```

### WhatsApp

`POST /api/v1/whatsapp/webhook/`

```json
{
  "from": "whatsapp:+919999999999",
  "message": "taken",
  "timestamp": "2026-05-05T08:30:00Z"
}
```

## 9. Admin APIs

Use a tenant admin account such as `owner+apollo-indore@medadhere.test`.

### Metrics

`GET /admin/api/v1/metrics/overview/`

`GET /admin/api/v1/metrics/adherence/`

### Users

`GET /admin/api/v1/users/`

`GET /admin/api/v1/users/<user_id>/`

`POST /admin/api/v1/users/<user_id>/deactivate/`

### Subscriptions

`GET /admin/api/v1/subscriptions/`

`POST /admin/api/v1/subscriptions/<subscription_id>/extend/`

### Devices and notifications

`POST /admin/api/v1/devices/generate-ids/`

`GET /admin/api/v1/devices/inventory/`

`GET /admin/api/v1/notifications/delivery-rates/`

`POST /admin/api/v1/notifications/test/`

### System jobs

`GET /admin/api/v1/system/jobs/`

### Audit logs

`GET /admin/api/v1/audit-logs/`

No body is needed for these admin GETs. For the POST actions, use the object or ID shown in the list response.

## 10. Analytics, ABHA, Reports, Geofence, Pharmacovigilance

### Analytics

`GET /api/v1/analytics/caregiver/summary/`

`GET /api/v1/analytics/caregiver/cohort/`

### ABHA

`GET /api/v1/abha/sync/`

No body.

### Insurance reports

`POST /api/v1/reports/share/`

```json
{
  "patient_id": "<patient_uuid>",
  "recipient_email": "insurer@example.com",
  "report_type": "adherence_summary",
  "days": 30
}
```

`GET /api/v1/reports/access/<token>/`

### Geofence

`GET /api/v1/geofence/zones/`

`POST /api/v1/geofence/zones/`

`POST /api/v1/geofence/event/`

```json
{
  "event_type": "zone_entered",
  "latitude": 12.971599,
  "longitude": 77.594566,
  "device_id": "HW-1001"
}
```

### Pharmacovigilance

`GET /api/v1/pharmacovigilance/reports/`

`POST /api/v1/pharmacovigilance/reports/`

Typical body:

```json
{
  "report_type": "side_effect",
  "description": "Mild nausea after dose",
  "severity": "low",
  "medication_name": "Amlodipine"
}
```

## 11. AI APIs

### Health

`GET /api/v1/ai/health/`

No body.

### Risk score

`GET /api/v1/ai/risk-score/<patient_id>/`

Optional query string:

```http
?refresh=true
```

### Insights

`GET /api/v1/ai/insights/<patient_id>/`

### Recommendations

`GET /api/v1/ai/recommendations/<patient_id>/`

### Retrain model

`POST /api/v1/ai/retrain/`

No body.

### Model registry

`GET /api/v1/ai/models/`

## 12. Quick Manual Test Order

If you want the fastest smoke test in Postman, do this order:

1. `POST /api/v1/auth/login/`
2. `GET /api/v1/users/me/`
3. `GET /api/v1/patients/me/`
4. `GET /api/v1/adherence/summary/`
5. `GET /api/v1/ai/risk-score/e30fa80c-3bd2-46ea-993e-27cef6d802a4/`
6. `GET /api/v1/ai/insights/e30fa80c-3bd2-46ea-993e-27cef6d802a4/`
7. `GET /api/v1/ai/recommendations/e30fa80c-3bd2-46ea-993e-27cef6d802a4/`

If you are testing write endpoints, start with:

1. `PATCH /api/v1/users/me/`
2. `POST /api/v1/users/me/devices/`
3. `POST /api/v1/patients/me/conditions/`
4. `POST /api/v1/patients/me/prescriptions/`
5. `POST /api/v1/reminders/<reminder_id>/log/`
6. `POST /api/v1/adherence/manual/`

## 13. Troubleshooting Auth Issues

| Error | Reason | Fix |
|---|---|---|
| `401 token_not_valid` | Access token expired (15 min) | Refresh with `POST /auth/refresh/` |
| `401` on AI endpoint | Token not in Authorization header | Add header: `Authorization: Bearer <token>` |
| `401` after refresh | Refresh token expired (30 days) | Login again with email/password |
| `400` on login | Email/password wrong | Check seeded credentials table above |
| `403` on endpoint | Missing subscription plan or role | Login with different user (e.g., admin) |

## 14. Notes

- Most list/detail `GET` endpoints do not need a body.
- For `PATCH` and `POST`, send only the fields shown in the body examples.
- Some endpoints are permission-gated by role or subscription plan.
- If you get `403` or `402`, log in with a different seeded account or a tenant admin account.
- If you get `401`, refresh your token and resend the request.