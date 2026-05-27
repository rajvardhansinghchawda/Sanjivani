# ⚡ MedAdhere — SUPERPOWER.md
> What makes this system exceptional, not just functional.  
> Read this before building. Every decision here has a "why" grounded in research, UX reality, and production constraints.

---

## 🏆 THE CORE SUPERPOWER PHILOSOPHY

MedAdhere has **one job that it must never fail at:**  
> *Make sure the right person gets the right reminder at the right time, every single time — whether they have a ₹5,000 smart pillbox or a basic Android phone.*

Everything else — AI, analytics, caregiver dashboards, subscription tiers — is built on top of this single non-negotiable guarantee.

---

## ⚡ SUPERPOWER #1 — Hardware-Optional Architecture (Zero Dependency Design)

### The Problem It Solves
Most IoT health systems break when hardware fails. Hospitals can't afford to depend on a ₹5,000 device working 100% of the time.

### The Superpower
```
The MedAdhere system operates at THREE levels simultaneously,
and any level alone is sufficient for full core functionality:

LEVEL 1 — SOFTWARE ONLY (works for everyone)
    Patient → Mobile App → Manual Tap → Done ✅

LEVEL 2 — SENSOR ENHANCED (for premium users)
    Smart Pillbox → MQTT/HTTPS → Auto-detected → Done ✅

LEVEL 3 — HYBRID (best-of-both)
    Pillbox tries to log → if offline → Patient app logs → sync on reconnect ✅
```

### Django Implementation Superpower
```python
class AdherenceEventService:
    """
    SUPERPOWER: Single service handles ALL input sources.
    The source doesn't matter — the adherence event is the same.
    
    This means:
    - IoT device dies → patient logs manually → NO DATA LOSS
    - Patient loses phone → caregiver logs on behalf → NO GAP
    - Both log simultaneously → idempotency key prevents duplicate → NO DOUBLE COUNT
    """
    @classmethod
    def log_dose(cls, patient, prescription, scheduled_at, 
                 source: LogSource, taken_at=None, device=None, actor=None):
        """
        LogSource: APP_MANUAL | IOT_PILLBOX | CAREGIVER | API | VOICE_RESPONSE
        Idempotency: unique_together = (prescription, scheduled_at)
        """
        event, created = AdherenceEvent.objects.get_or_create(
            prescription=prescription,
            scheduled_at=scheduled_at,
            defaults={
                'taken_at':   taken_at or timezone.now(),
                'status':     cls._determine_status(taken_at, scheduled_at),
                'log_method': source,
                'device':     device,
                'logged_by':  actor,
            }
        )
        if created:
            cls._post_log_hooks(event)   # risk score, escalation cancel, insight trigger
        return event, created
```

---

## ⚡ SUPERPOWER #2 — Unique Hardware ID System (One-Click Device Binding)

### The Problem It Solves
Smart device setup is the #1 drop-off point in IoT health products. Users give up during pairing.

### The Superpower
```
Manufacturing → Unique Code Generated (MEDA-A1B2-C3D4-E5F6)
             → Printed on box + QR code + inside device firmware
             → User buys device from our website
             → User opens app → taps "Link Device" → scans QR → DONE (3 seconds)
```

No Bluetooth pairing. No WiFi network entry. No technical skill required.

### End-to-End Flow
```
1. MANUFACTURING (one-time, bulk):
   POST /api/v1/admin/devices/generate-ids/
   Body: { "product_id": "...", "batch_size": 1000 }
   → Creates 1000 DeviceUniqueID records
   → Exports CSV for factory: [MEDA-A1B2-C3D4-E5F6, MEDA-B2C3-D4E5-F6A7, ...]
   → Factory burns code into firmware + prints on label

2. PURCHASE (e-commerce):
   POST /api/v1/store/orders/
   → HardwareOrder created
   → DeviceUniqueID linked to order (not yet linked to user account)
   → Fulfillment triggered

3. CUSTOMER UNBOXES (one-time activation):
   POST /api/v1/iot/devices/link/
   Body: { "unique_code": "MEDA-A1B2-C3D4-E5F6" }
   → Validates code exists and is_provisioned=False
   → Checks user has PREMIUM subscription (hardware = premium feature)
   → Creates Device record with fresh API key
   → Sets is_provisioned=True
   → Returns: { "device_id": "...", "api_key": "..." }
   → Device firmware is sent the api_key via BLE/USB initial setup

4. DEVICE OPERATES AUTONOMOUSLY:
   Device sends heartbeats every 5 min:
   POST /api/v1/iot/events/ 
   Header: X-Device-Key: <api_key>
   Body: { "event_type": "COMPARTMENT_OPENED", "compartment": 2 }
   → Auto-translates to AdherenceEvent
   → Patient sees "Taken" in app without touching phone
```

### Validation Rules
```python
DEVICE_LINK_VALIDATION = [
    ('code_exists',       lambda uid: uid is not None,       'Invalid device code'),
    ('not_provisioned',   lambda uid: not uid.is_provisioned,'Device already linked to another account'),
    ('premium_required',  lambda user: user.is_premium(),    'Hardware linking requires Premium plan'),
    ('limit_check',       lambda user: user.device_count < 5,'Maximum 5 devices per account'),
    ('ownership_verify',  lambda uid, order: ...,            'This device is not from your order'),
]
```

---

## ⚡ SUPERPOWER #3 — Intelligent Subscription Feature Gating (Not a Paywall — A Safety Net)

### The Philosophy
```
FREE    = The system is fully useful. Just reminders. Just tracking. No AI. No hardware.
          For: Patients who want basic medication management.

FREEMIUM = AI gives a weekly nudge. Caregiver can watch. Still no hardware.
           For: Patients with 1–2 chronic conditions who want some intelligence.

PREMIUM  = Full stack. Real-time AI. Hardware. Unlimited caregivers. Reports.
           For: Complex patients, elderly with families, or clinical environments.
```

**Key Rule:** The core safety function (reminders + dose logging) is NEVER locked.  
Locking reminders behind a paywall in a healthcare app is a patient safety risk.

### Feature Gate Implementation
```python
# SUPERPOWER: Feature gates are DATA-DRIVEN, not code-driven.
# To add a new gated feature, just update the database — no deploy needed.

class SubscriptionPlan(BaseModel):
    features = models.JSONField()
    # {
    #   "max_medications": 3,          ← int limit
    #   "max_caregivers": 1,
    #   "ai_risk_score": false,        ← bool gates
    #   "ai_insights_weekly": false,
    #   "ai_insights_realtime": false,
    #   "caregiver_alerts": false,
    #   "hardware_linking": false,
    #   "whatsapp_reminders": false,
    #   "voice_call_reminders": false,
    #   "report_history_days": 7,
    #   "data_export": false,
    #   "priority_support": false
    # }

def check_feature(user, feature_key):
    plan_features = user.subscription.plan.features
    value = plan_features.get(feature_key)
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value  # caller compares to current count
    return False
```

### Graceful Degradation (Not Hard Blocks)
```python
# When AI is unavailable (model server down, FREE plan):
# → Use rule-based risk assessment (3 missed doses in 7 days = HIGH)
# → Never show "Feature unavailable" — show "Basic alert active"
# → Upgrade CTA shown gently, not aggressively

class RiskAssessmentFallback:
    """Always available to ALL plans — rule-based safety net"""
    def assess(self, patient) -> RiskLevel:
        recent_misses = AdherenceEvent.objects.filter(
            patient=patient,
            status=AdherenceStatus.MISSED,
            scheduled_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        if recent_misses >= 5: return RiskLevel.CRITICAL
        if recent_misses >= 3: return RiskLevel.HIGH
        if recent_misses >= 1: return RiskLevel.MEDIUM
        return RiskLevel.LOW
```

---

## ⚡ SUPERPOWER #4 — Timezone-Perfect Reminder Engine

### The Problem It Solves
Every other reminder app breaks when the patient travels, or when the server is in a different timezone. Reminders arrive at wrong times. Patients lose trust.

### The Superpower
```
ALL TIMES STORED IN UTC
ALL SCHEDULES COMPUTED IN PATIENT LOCAL TIMEZONE
ALL REMINDER JOBS SCHEDULED WITH eta=UTC timestamp
ALL DISPLAY TIMES CONVERTED TO USER TIMEZONE IN API RESPONSE
```

```python
class ScheduleGenerationService:
    """
    SUPERPOWER: Timezone-aware scheduling that handles DST, travel, and timezone changes.
    """
    def compute_dose_windows(self, schedule: MedicationSchedule, days=30) -> list:
        patient_tz = pytz.timezone(schedule.timezone)
        windows = []
        
        for day_offset in range(days):
            local_date = (date.today() + timedelta(days=day_offset))
            
            for time_entry in schedule.times_of_day:
                local_naive = datetime.combine(local_date, 
                                               time.fromisoformat(time_entry['time']))
                # Localize handles DST automatically
                local_aware = patient_tz.localize(local_naive, is_dst=None)
                utc_time = local_aware.astimezone(pytz.UTC)
                windows.append({
                    'scheduled_at':    utc_time,           # stored as UTC
                    'scheduled_local': local_aware,        # for display
                    'dose':            time_entry['dose'],
                })
        return windows

    def on_patient_timezone_change(self, patient, new_timezone):
        """
        CRITICAL: When patient changes timezone (travel or correction),
        cancel all future reminder jobs and regenerate with new timezone.
        """
        future_jobs = ReminderJob.objects.filter(
            schedule__prescription__patient=patient,
            scheduled_at__gt=timezone.now(),
            status='PENDING'
        )
        future_jobs.update(status='CANCELLED')
        for schedule in patient.active_schedules:
            schedule.timezone = new_timezone
            schedule.save()
            self.generate_upcoming_reminders(schedule)
```

---

## ⚡ SUPERPOWER #5 — Caregiver Real-Time Alert System (Without Privacy Violation)

### The Dilemma
Caregivers need to know when a patient misses a dose.  
But patients shouldn't feel surveilled.  
HIPAA requires minimum necessary data sharing.

### The Superpower: Tiered Data Visibility
```python
class CaregiverPatientSerializer(serializers.ModelSerializer):
    """
    SUPERPOWER: Data returned to caregiver is filtered by permission_level.
    The same endpoint returns different data depth based on the link's permission.
    """
    def to_representation(self, instance):
        data = super().to_representation(instance)
        link = self.context['caregiver_link']
        
        if link.permission_level == 'view_only':
            # Only: today's adherence status, overall % this week
            return self._minimal_view(data)
        
        elif link.permission_level == 'log_doses':
            # Adds: full schedule, can POST to /adherence/log/
            return self._standard_view(data)
        
        elif link.permission_level == 'full_access':
            # Adds: conditions, prescriptions, alert history
            return self._full_view(data)
```

### Alert Escalation Without Alarm Fatigue
```python
ESCALATION_CONFIG = {
    # Time after scheduled dose → action
    'T+0':   'window_opens',
    'T+15':  'first_patient_reminder',
    'T+30':  'second_patient_reminder_different_channel',
    'T+60':  'alert_caregivers_with_can_receive_alerts_true',
    'T+240': 'alert_professional_caregiver_or_nurse',
    'T+1440':'emergency_contact_notification',
}

# Anti-spam: escalation stops immediately when patient logs dose
# Anti-overload: caregivers get DIGEST mode option (batch alerts)
# Anti-noise: Low-risk medications skip caregiver escalation
```

---

## ⚡ SUPERPOWER #6 — HIPAA-Compliant Audit Trail (Immutable + Searchable)

### The Superpower
Every PHI access, every dose log, every admin action is immutable audit-logged with:
- WHO (actor_id, actor_role)
- WHAT (action, resource_type, resource_id)
- WHEN (timestamp with milliseconds)
- WHERE (IP address, user agent, geolocation)
- BEFORE/AFTER state for updates

```python
class AuditLogManager(models.Manager):
    """SUPERPOWER: AuditLog can NEVER be deleted from code or admin."""
    def delete(self):
        raise PermissionDenied('Audit logs are immutable. Cannot delete.')
    
    def bulk_delete(self, *args, **kwargs):
        raise PermissionDenied('Audit logs are immutable.')

# Even SUPER_ADMIN cannot delete audit logs via the app
# Database-level: REVOKE DELETE ON audit.audit_logs FROM app_user;
```

---

## ⚡ SUPERPOWER #7 — Idempotent IoT Event Processing

### The Problem
IoT devices on flaky WiFi send the same event 2–5 times.  
Without idempotency, a patient's pillbox opening once logs 5 doses.

### The Superpower
```python
class DeviceEventIngestView(CreateAPIView):
    """
    SUPERPOWER: Every IoT event is idempotent.
    Device firmware generates a UUID for each event and sends it.
    Duplicate events are silently dropped, not errored.
    """
    def create(self, request):
        event_uuid = request.data.get('event_uuid')  # device-generated
        
        event, created = DeviceEvent.objects.get_or_create(
            event_uuid=event_uuid,
            defaults={
                'device':      request.auth,
                'event_type':  request.data['event_type'],
                'raw_payload': request.data,
            }
        )
        
        if created:
            process_iot_event.delay(event.id)
            return Response({'status': 'accepted'}, status=202)
        else:
            return Response({'status': 'duplicate_ignored'}, status=200)
            # IMPORTANT: Return 200 not 409 — device doesn't need to retry
```

---

## ⚡ SUPERPOWER #8 — AI That Never Blocks Core Function

### The Problem
If the AI service crashes, should patients lose their reminders? No.

### The Superpower: Circuit Breaker Pattern
```python
class AIInsightService:
    """
    SUPERPOWER: AI features fail gracefully.
    Core reminders never depend on AI service availability.
    """
    def get_risk_score(self, patient_id: str) -> RiskScoreResult:
        try:
            with CircuitBreaker('ai_risk_service', failure_threshold=5, timeout=30):
                return self._call_ai_model(patient_id)
        except (CircuitOpenError, TimeoutError, MLServiceError):
            # Graceful fallback: rule-based risk assessment
            logger.warning(f'AI service unavailable, using fallback for {patient_id}')
            return RiskAssessmentFallback().assess_by_rules(patient_id)
        except Exception as e:
            logger.error(f'Unexpected AI error: {e}')
            return RiskScoreResult(
                score=None, 
                level=RiskLevel.UNKNOWN, 
                source='UNAVAILABLE',
                message='Risk assessment temporarily unavailable'
            )
```

---

## ⚡ SUPERPOWER #9 — Multi-Language + Accessibility First

```python
# SUPERPOWER: Notifications in patient's native language
# Supported: en, hi, mr, ta, te, bn, gu, kn, ml, pa, ur

class NotificationTemplateService:
    def render(self, template_key: str, user: User, context: dict) -> NotificationPayload:
        lang = user.preferred_language or user.patient_profile.primary_language or 'en'
        template = NotificationTemplate.objects.get(
            key=template_key, language=lang
        )
        body = Template(template.body).render(context)
        
        # Accessibility adaptations
        if user.patient_profile.has_vision_impairment:
            # Force voice call channel, disable visual-only push
            context['force_channel'] = 'voice'
        
        if user.patient_profile.has_hearing_impairment:
            # Disable voice, use vibration + visual push only
            context['exclude_channel'] = 'voice'
        
        return NotificationPayload(title=template.title, body=body, **context)
```

---

## 🔐 SECURITY SUPERPOWER SUMMARY

| Threat | MedAdhere's Defense |
|---|---|
| SQL Injection | Django ORM (parameterized queries), never raw SQL |
| Token theft | Server-side session table + revocation on password change |
| PHI data leak | AES-256 field encryption + HIPAA audit log |
| Brute force | Failed login counter + lockout + rate limiting (django-ratelimit) |
| Enumeration attacks | UUID PKs everywhere (no sequential IDs in URLs) |
| IDOR | Object-level permission checks on every view |
| IoT device spoofing | Per-device API keys (rotatable) + device fingerprinting |
| Admin privilege abuse | All admin actions audit-logged + MFA enforced for ADMIN+ |
| Session hijacking | IP + user-agent binding check on session validation |
| Data exfiltration | Export feature = PREMIUM only + audit log + rate limited |

---

## 📊 PERFORMANCE SUPERPOWER TARGETS

| Endpoint | Target P99 | Strategy |
|---|---|---|
| GET /adherence/ (today's doses) | < 50ms | Redis cache (1 min TTL) |
| POST /adherence/log/ | < 100ms | Direct DB write, async hooks |
| POST /iot/events/ | < 30ms | Minimal processing, async queue |
| GET /ai/risk-score/ | < 200ms | Pre-computed cache, async refresh |
| Admin dashboard | < 500ms | Materialized views, pagination |
| Reminder dispatch | < 5s from eta | Celery priority queue |

---

## 🚀 SCALABILITY SUPERPOWER

```
Current (MVP):
    - Single Django app
    - Single PostgreSQL instance (multi-schema)
    - Single Celery worker pool
    - Redis for cache + queue

Growth Path (1M users):
    - Read replicas for clinical schema (reports, dashboards)
    - Telemetry schema → TimescaleDB (optimized for time-series adherence data)
    - Notification workers → dedicated Celery queue per channel
    - AI scoring → separate microservice with GPU support
    - IoT events → MQTT broker (Mosquitto/HiveMQ) → Kafka → consumer

The schema design supports this migration without changing business logic.
```

---

*End of SUPERPOWER.md — MedAdhere*  
*"Work without hardware. Shine with it."*
