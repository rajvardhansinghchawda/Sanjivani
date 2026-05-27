# 🧠 MedAdhere — Backend Skills Manifest
> **Stack:** Django 5.x · Django REST Framework · PostgreSQL (Multi-Schema) · Celery + Redis · JWT Auth  
> **Scope:** Backend only — all skills listed here are server-side Django capabilities

---

## 📐 SKILL TAXONOMY

```
SKILLS
├── 1. Project Architecture Skills
├── 2. Authentication & Security Skills
├── 3. Subscription & Billing Skills
├── 4. Patient & Clinical Data Skills
├── 5. Medication & Scheduling Skills
├── 6. Reminder & Notification Skills
├── 7. Adherence Tracking Skills
├── 8. AI / ML Integration Skills
├── 9. IoT & Hardware Device Skills
├── 10. Admin Panel Skills
├── 11. Background Job Skills
├── 12. API Design Skills
├── 13. Database Skills
└── 14. Observability & Audit Skills
```

---

## 1. PROJECT ARCHITECTURE SKILLS

### 1.1 Django App Layout
The backend is organized as a multi-app Django monorepo. Each app owns a single domain.

```
medadhere_backend/
├── config/                     # settings, urls, wsgi, asgi, celery.py
│   ├── settings/
│   │   ├── base.py             # shared settings
│   │   ├── development.py
│   │   ├── production.py
│   │   └── testing.py
│   ├── urls.py                 # root router
│   └── celery.py
├── apps/
│   ├── identity/               # users, sessions, MFA, devices
│   ├── clinical/               # patients, caregivers, medications, prescriptions
│   ├── scheduling/             # medication schedules, dose windows
│   ├── telemetry/              # adherence events, reminder logs, notifications
│   ├── ai_engine/              # risk scores, insights, recommendations
│   ├── iot/                    # devices, heartbeats, device events, hardware linking
│   ├── subscriptions/          # plans, user subscriptions, feature gates
│   ├── store/                  # hardware store, purchase orders, unique device IDs
│   ├── admin_panel/            # custom Django admin extensions
│   ├── notifications/          # push, SMS, WhatsApp, email, voice call dispatchers
│   └── audit/                  # HIPAA audit logs, consent records, data access
├── shared/
│   ├── models.py               # BaseModel with UUID PK + soft delete + versioning
│   ├── permissions.py          # SubscriptionGate, RolePermission, ObjectOwner
│   ├── pagination.py           # CursorPagination for high-volume telemetry endpoints
│   ├── exceptions.py           # DomainException, SubscriptionLimitError, etc.
│   ├── validators.py
│   └── utils/
│       ├── encryption.py       # AES-256 field encryption (PHI columns)
│       ├── uuid_generator.py
│       └── timezone_utils.py
└── tests/
```

### 1.2 PostgreSQL Multi-Schema Routing
Django does not natively support PostgreSQL schemas. We implement a **DatabaseRouter + search_path override** pattern.

```python
# config/db_routers.py
SCHEMA_APP_MAP = {
    'identity':      ['identity', 'auth'],
    'clinical':      ['clinical'],
    'telemetry':     ['telemetry'],
    'ai_engine':     ['ai_engine'],
    'iot':           ['iot'],
    'audit':         ['audit'],
    'subscriptions': ['subscriptions'],
    'store':         ['store'],
}

class MedAdhereDBRouter:
    def db_for_read(self, model, **hints): ...
    def db_for_write(self, model, **hints): ...
    def allow_migrate(self, db, app_label, **hints): ...
```

Each model's `Meta` class carries:
```python
class Meta:
    db_table = '"identity"."users"'   # schema.table syntax
    managed = True
```

### 1.3 Shared BaseModel
```python
# shared/models.py
import uuid
from django.db import models

class BaseModel(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)   # soft delete
    version    = models.PositiveIntegerField(default=1)        # optimistic lock

    objects = SoftDeleteManager()   # default excludes deleted_at IS NOT NULL

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        from django.utils import timezone
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at', 'updated_at'])
        AuditLog.log_delete(self, actor=user)
```

---

## 2. AUTHENTICATION & SECURITY SKILLS

### 2.1 JWT Authentication (SimpleJWT extended)
- Access token: 15 min TTL
- Refresh token: 30 days TTL, stored hashed in `identity.user_sessions`
- Token rotation: every refresh issues a new pair and invalidates old refresh
- Blacklisting via `access_token_hash` column (server-side revocation)
- `jti` (JWT ID) maps to `session.id` for revocation on password change

```python
# identity/authentication.py
class MedAdhereJWTAuthentication(JWTAuthentication):
    def get_validated_token(self, raw_token):
        token = super().get_validated_token(raw_token)
        # Check session not revoked
        session = UserSession.objects.filter(
            id=token['jti'],
            revoked_at__isnull=True,
            expires_at__gt=timezone.now()
        ).first()
        if not session:
            raise TokenError('Session revoked or expired')
        # Check issued before password change
        user = self.get_user(token)
        if user.password_changed_at and token['iat'] < user.password_changed_at.timestamp():
            raise TokenError('Token invalidated by password change')
        return token
```

### 2.2 Multi-Factor Authentication (MFA)
- **TOTP** (Google Authenticator / Authy) — `pyotp` library
- **SMS OTP** — via Twilio / MSG91 (configurable gateway)
- **Backup codes** — bcrypt-hashed, one-time use
- MFA enforcement configurable per subscription plan and per role

```python
# Skill: MFA enforcement middleware
class MFAEnforcementMiddleware:
    """
    If user.mfa_config.is_required and not token.claims['mfa_verified']:
        return 403 with code MFA_REQUIRED
    """
```

### 2.3 Role-Based Access Control (RBAC)
Roles: `PATIENT | CAREGIVER | NURSE | PHARMACIST | ADMIN | SUPER_ADMIN`

```python
# shared/permissions.py

class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == UserRole.PATIENT

class CaregiverPermission(BasePermission):
    """
    Check patient_caregiver_links.permission_level for object-level access.
    Levels: view_only / log_doses / manage_schedule / full_access
    """
    def has_object_permission(self, request, view, obj):
        link = PatientCaregiverLink.objects.get(
            patient=obj, caregiver__user=request.user
        )
        required = view.required_permission_level   # declared on each ViewSet
        return PERMISSION_HIERARCHY[link.permission_level] >= PERMISSION_HIERARCHY[required]
```

### 2.4 Subscription Feature Gate (Permission)
```python
class SubscriptionGate(BasePermission):
    """
    Decorator-driven permission check against user's active subscription plan.
    Usage:
        @subscription_required(feature='ai_insights')
        def get(self, request): ...
    """
    FEATURE_MAP = {
        Feature.AI_INSIGHTS:        [Plan.FREEMIUM, Plan.PREMIUM],
        Feature.HARDWARE_LINKING:   [Plan.PREMIUM],
        Feature.CAREGIVER_ALERTS:   [Plan.FREEMIUM, Plan.PREMIUM],
        Feature.ADVANCED_REPORTS:   [Plan.PREMIUM],
        Feature.WHATSAPP_REMINDERS: [Plan.PREMIUM],
        Feature.VOICE_CALL:         [Plan.PREMIUM],
        Feature.EXPORT_DATA:        [Plan.PREMIUM],
        Feature.UNLIMITED_MEDS:     [Plan.FREEMIUM, Plan.PREMIUM],  # FREE = max 3
    }
```

### 2.5 PHI Field Encryption
All `(encrypted)` columns in schema use Django `EncryptedCharField`:
```python
# shared/utils/encryption.py
from cryptography.fernet import Fernet

class EncryptedTextField(models.TextField):
    """
    Transparent AES-256 (Fernet) encryption at application layer.
    Key stored in environment variable FIELD_ENCRYPTION_KEY (KMS-backed in prod).
    Searchable via SHA-256 hash stored in companion *_hash column.
    """
```

---

## 3. SUBSCRIPTION & BILLING SKILLS

### 3.1 Subscription Plans

| Feature | FREE | FREEMIUM | PREMIUM |
|---|---|---|---|
| Max medications | 3 | 10 | Unlimited |
| Reminders | Push only | Push + SMS | Push + SMS + WhatsApp + Voice |
| AI Risk Score | ❌ | Basic (weekly batch) | Full real-time |
| AI Insights | ❌ | 3 per week | Unlimited |
| Caregiver links | 1 (view only) | 3 | Unlimited |
| Hardware linking | ❌ | ❌ | ✅ |
| Adherence reports | 7 days | 30 days | 1 year |
| Data export | ❌ | ❌ | ✅ |
| Admin dashboard | ❌ | ❌ | ✅ |

### 3.2 Subscription Models
```python
# subscriptions/models.py

class SubscriptionPlan(BaseModel):
    name             = models.CharField(max_length=50)     # FREE / FREEMIUM / PREMIUM
    slug             = models.SlugField(unique=True)
    price_monthly    = models.DecimalField(max_digits=8, decimal_places=2)
    price_yearly     = models.DecimalField(max_digits=8, decimal_places=2)
    features         = models.JSONField()                  # {feature_key: bool/int}
    max_medications  = models.IntegerField(default=3)
    max_caregivers   = models.IntegerField(default=1)
    is_active        = models.BooleanField(default=True)

class UserSubscription(BaseModel):
    user             = models.OneToOneField(User, on_delete=models.PROTECT)
    plan             = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    status           = models.CharField(choices=SubStatus.choices, max_length=30)
    # ACTIVE / TRIALING / PAST_DUE / CANCELLED / EXPIRED
    started_at       = models.DateTimeField()
    expires_at       = models.DateTimeField(null=True)
    trial_ends_at    = models.DateTimeField(null=True)
    payment_gateway  = models.CharField(max_length=30)     # razorpay / stripe / manual
    gateway_sub_id   = models.CharField(max_length=200, unique=True, null=True)
    auto_renew       = models.BooleanField(default=True)

class SubscriptionInvoice(BaseModel):
    subscription     = models.ForeignKey(UserSubscription, on_delete=models.PROTECT)
    amount           = models.DecimalField(max_digits=10, decimal_places=2)
    currency         = models.CharField(max_length=3, default='INR')
    status           = models.CharField(choices=InvoiceStatus.choices, max_length=20)
    paid_at          = models.DateTimeField(null=True)
    gateway_invoice_id = models.CharField(max_length=200, unique=True)
    invoice_pdf_url  = models.URLField(null=True)
```

### 3.3 Feature Gate Decorator
```python
# shared/decorators.py

def subscription_required(feature: str):
    """
    @subscription_required('ai_insights')
    class AIInsightsView(APIView): ...
    
    Returns HTTP 402 with upgrade_url if feature not in plan.
    """
    def decorator(cls):
        original_dispatch = cls.dispatch
        def dispatch(self, request, *args, **kwargs):
            gate = SubscriptionGate()
            if not gate.has_feature(request.user, feature):
                raise SubscriptionLimitError(
                    feature=feature,
                    current_plan=request.user.subscription.plan.slug,
                    upgrade_url='/api/v1/subscriptions/upgrade/'
                )
            return original_dispatch(self, request, *args, **kwargs)
        cls.dispatch = dispatch
        return cls
    return decorator
```

---

## 4. PATIENT & CLINICAL DATA SKILLS

### 4.1 Patient Profile CRUD
```python
# clinical/views.py

class PatientProfileView(RetrieveUpdateAPIView):
    """
    GET  /api/v1/patients/me/
    PUT  /api/v1/patients/me/
    """
    serializer_class = PatientProfileSerializer
    permission_classes = [IsAuthenticated, IsPatient]

    def get_object(self):
        return self.request.user.patient_profile
```

### 4.2 Caregiver Linking Flow
```python
# POST /api/v1/caregiver-links/invite/
# POST /api/v1/caregiver-links/{token}/accept/
# DELETE /api/v1/caregiver-links/{id}/
# PATCH  /api/v1/caregiver-links/{id}/permissions/

class CaregiverInviteService:
    """
    1. Patient sends invite with caregiver email + permission_level
    2. System creates a signed token (24h TTL) and emails caregiver
    3. Caregiver clicks link → registers/logs in → link activated
    4. Skill: validates subscription limit (max_caregivers per plan)
    """
    def send_invite(self, patient, caregiver_email, permission_level):
        sub = patient.user.subscription
        current_count = PatientCaregiverLink.objects.filter(patient=patient, is_active=True).count()
        if current_count >= sub.plan.max_caregivers:
            raise SubscriptionLimitError('caregiver_limit')
        token = self._generate_invite_token(patient, caregiver_email, permission_level)
        send_caregiver_invite_email.delay(caregiver_email, token, patient)
        return token
```

### 4.3 Patient Conditions (Comorbidities)
```python
# POST   /api/v1/clinical/conditions/
# GET    /api/v1/clinical/conditions/
# DELETE /api/v1/clinical/conditions/{id}/

# ICD-10 code validation via local lookup table
# Conditions feed into AI risk score calculation
```

---

## 5. MEDICATION & SCHEDULING SKILLS

### 5.1 Medication Registry
```python
class Medication(BaseModel):
    """clinical.medications — master drug registry"""
    name              = models.CharField(max_length=255)
    generic_name      = models.CharField(max_length=255, null=True)
    drug_class        = models.CharField(max_length=100)      # ACE inhibitor, SSRI, etc.
    form              = models.CharField(max_length=50)        # tablet, capsule, liquid, injection
    default_unit      = models.CharField(max_length=30)        # mg, ml, units
    requires_food     = models.BooleanField(default=False)
    refrigeration_req = models.BooleanField(default=False)
    controlled_sub    = models.BooleanField(default=False)     # Schedule H/X drugs
    barcode           = models.CharField(max_length=50, null=True, unique=True)
    photo_url         = models.URLField(null=True)
```

### 5.2 Prescription Engine
```python
class Prescription(BaseModel):
    """clinical.prescriptions — what doctor ordered"""
    patient           = models.ForeignKey(Patient, on_delete=models.PROTECT)
    medication        = models.ForeignKey(Medication, on_delete=models.PROTECT)
    prescribed_by     = models.CharField(max_length=255)       # doctor name
    dosage_value      = models.DecimalField(max_digits=7, decimal_places=3)
    dosage_unit       = models.CharField(max_length=30)
    instructions      = models.TextField(null=True)
    start_date        = models.DateField()
    end_date          = models.DateField(null=True)            # null = ongoing
    refill_alert_days = models.SmallIntegerField(default=7)    # days before running out
    total_quantity    = models.DecimalField(null=True)
    remaining_quantity= models.DecimalField(null=True)

class MedicationSchedule(BaseModel):
    """clinical.medication_schedules — WHEN to take"""
    prescription      = models.ForeignKey(Prescription, on_delete=models.PROTECT)
    frequency_type    = models.CharField(choices=FrequencyType.choices)
    # DAILY / WEEKLY / EVERY_N_DAYS / SPECIFIC_DAYS / AS_NEEDED / CUSTOM
    times_of_day      = models.JSONField()
    # [{"time": "08:00", "dose": 1.0, "with_food": true}, ...]
    days_of_week      = models.JSONField(null=True)            # [1,3,5] = Mon,Wed,Fri
    interval_days     = models.IntegerField(null=True)         # every N days
    timezone          = models.CharField(max_length=60)        # patient's local TZ
    is_active         = models.BooleanField(default=True)
```

### 5.3 Schedule Generation Service
```python
class ScheduleGenerationService:
    """
    When a MedicationSchedule is created/updated:
    1. Calculate all dose windows for next 30 days
    2. Enqueue Celery reminder jobs for each window
    3. Store in telemetry.reminder_jobs table
    4. On schedule change: cancel existing future jobs, regenerate
    """
    def generate_upcoming_reminders(self, schedule: MedicationSchedule, days: int = 30):
        windows = self._compute_dose_windows(schedule, days)
        for window in windows:
            ReminderJob.objects.get_or_create(
                schedule=schedule,
                scheduled_at=window['scheduled_at'],
                defaults={'status': 'PENDING', 'dose_value': window['dose']}
            )
            send_reminder.apply_async(
                args=[window['reminder_job_id']],
                eta=window['scheduled_at'] - timedelta(minutes=schedule.lead_minutes)
            )
```

### 5.4 Medication Count Enforcement (Subscription)
```python
class PrescriptionCreateView(CreateAPIView):
    def perform_create(self, serializer):
        patient = self.request.user.patient_profile
        plan    = self.request.user.subscription.plan
        count   = Prescription.objects.filter(patient=patient, deleted_at__isnull=True).count()
        if count >= plan.max_medications:
            raise SubscriptionLimitError(
                f'Your {plan.name} plan allows max {plan.max_medications} medications. '
                f'Upgrade to add more.'
            )
        serializer.save(patient=patient)
```

---

## 6. REMINDER & NOTIFICATION SKILLS

### 6.1 Multi-Channel Notification Dispatcher
```python
# notifications/dispatcher.py

class NotificationDispatcher:
    """
    Routes a notification to the correct channel(s) based on:
    - User's notification_preferences
    - Subscription plan (WhatsApp / Voice = PREMIUM only)
    - Quiet hours
    - Channel-specific delivery status (retry on failure)
    """
    CHANNEL_PRIORITY = ['push', 'sms', 'whatsapp', 'email', 'voice']

    def dispatch(self, user, notification: NotificationPayload):
        prefs = user.notification_preferences
        channels = self._resolve_channels(user, prefs, notification.urgency)
        for channel in channels:
            task = CHANNEL_TASK_MAP[channel]
            task.delay(user_id=user.id, payload=notification.dict())

CHANNEL_TASK_MAP = {
    'push':      send_push_notification,      # FCM + APNs
    'sms':       send_sms_notification,       # Twilio / MSG91
    'whatsapp':  send_whatsapp_notification,  # WhatsApp Business API
    'email':     send_email_notification,     # SendGrid / SES
    'voice':     send_voice_call,             # Twilio Voice
}
```

### 6.2 Escalation Engine
```python
class EscalationEngine:
    """
    Triggered when: patient misses dose AND escalation_enabled=True
    
    Escalation ladder (configurable per patient):
    T+0   : Dose window opens
    T+15m : First reminder to patient
    T+30m : Second reminder to patient (different channel)
    T+60m : Alert to linked caregivers (can_receive_alerts=True)
    T+4h  : Alert to nurse / professional caregiver
    T+24h : Emergency contact notification
    """
    def run_escalation_check(self, reminder_job_id: str):
        job = ReminderJob.objects.get(id=reminder_job_id)
        if job.status == 'TAKEN':
            return  # already confirmed
        step = self._determine_escalation_step(job)
        self._dispatch_escalation(job, step)
        self._schedule_next_check(job, step)
```

### 6.3 Quiet Hours Guard
```python
def is_in_quiet_hours(user, send_at: datetime) -> bool:
    prefs = user.notification_preferences
    if not prefs.quiet_hours_start:
        return False
    local_time = send_at.astimezone(pytz.timezone(user.timezone)).time()
    return prefs.quiet_hours_start <= local_time or local_time <= prefs.quiet_hours_end
```

---

## 7. ADHERENCE TRACKING SKILLS

### 7.1 Dose Event Logging
```python
class AdherenceEvent(BaseModel):
    """telemetry.adherence_events — THE most important table"""
    patient          = models.ForeignKey(Patient, on_delete=models.PROTECT)
    prescription     = models.ForeignKey(Prescription, on_delete=models.PROTECT)
    reminder_job     = models.ForeignKey(ReminderJob, null=True, on_delete=models.SET_NULL)
    scheduled_at     = models.DateTimeField()
    taken_at         = models.DateTimeField(null=True)
    status           = models.CharField(choices=AdherenceStatus.choices)
    # TAKEN / MISSED / SKIPPED / TAKEN_LATE / TAKEN_EARLY
    log_method       = models.CharField()  # MANUAL / APP_BUTTON / IOT_PILLBOX / CAREGIVER
    device           = models.ForeignKey('iot.Device', null=True, on_delete=models.SET_NULL)
    notes            = models.TextField(null=True)
    late_minutes     = models.IntegerField(null=True)   # computed: taken_at - scheduled_at
    is_confirmed     = models.BooleanField(default=False)  # double-confirm for high-risk meds

# POST /api/v1/adherence/log/
# Idempotency: unique constraint on (prescription_id, scheduled_at)
```

### 7.2 Adherence Rate Calculator
```python
class AdherenceCalculatorService:
    """
    Called by: dashboard, AI engine, admin reports
    """
    def calculate_rate(self, patient, start_date, end_date, medication=None):
        """Returns adherence % for a date range, optionally per medication"""
        query = AdherenceEvent.objects.filter(
            patient=patient,
            scheduled_at__date__range=[start_date, end_date],
            status__in=[AdherenceStatus.TAKEN, AdherenceStatus.TAKEN_LATE, 
                        AdherenceStatus.MISSED, AdherenceStatus.SKIPPED]
        )
        if medication:
            query = query.filter(prescription__medication=medication)
        total = query.count()
        taken = query.filter(status__in=[AdherenceStatus.TAKEN, AdherenceStatus.TAKEN_LATE]).count()
        return round((taken / total * 100), 2) if total > 0 else None

    def calculate_streak(self, patient):
        """Current consecutive days with 100% adherence"""
        ...

    def get_weekly_heatmap(self, patient, weeks=12):
        """Returns {date: adherence_rate} dict for calendar heatmap"""
        ...
```

---

## 8. AI / ML INTEGRATION SKILLS

> All AI features are **advisory only** — never auto-change dosage or override clinical decisions.

### 8.1 Risk Score Engine
```python
# ai_engine/risk_scorer.py

class RiskScoreEngine:
    """
    Inputs: adherence history, schedule complexity, conditions, demographics
    Output: risk_score (0.0–1.0), risk_level (LOW/MEDIUM/HIGH/CRITICAL), explanation

    FREE plan   : No access
    FREEMIUM    : Weekly batch risk score (last 7 days data)
    PREMIUM     : Real-time score on every dose event
    """
    FEATURE_WEIGHTS = {
        'missed_rate_7d':      0.30,
        'missed_rate_30d':     0.20,
        'schedule_complexity': 0.15,
        'condition_severity':  0.15,
        'cognitive_status':    0.10,
        'is_elderly':          0.05,
        'streak_days':        -0.05,   # negative = reduces risk
    }

    def compute_risk(self, patient_id: str) -> RiskScoreResult:
        features = self._extract_features(patient_id)
        score    = self._weighted_score(features)
        level    = self._classify_level(score)
        reasons  = self._generate_explanation(features)
        return RiskScoreResult(score=score, level=level, reasons=reasons)
```

### 8.2 AI Insight Generator
```python
# ai_engine/insight_generator.py

class InsightGeneratorService:
    """
    Produces personalized textual insights for patients and caregivers.
    FREEMIUM: 3 insights/week, only basic pattern insights
    PREMIUM:  Unlimited, includes predictive and actionable insights
    
    Insight types:
    - PATTERN_DETECTION    : "You tend to miss evening doses on weekdays"
    - TIMING_OPTIMIZATION  : "Taking metformin 30 min before meals improves absorption"
    - RISK_WARNING         : "Your adherence dropped 20% this week — consider reviewing schedule"
    - POSITIVE_REINFORCEMENT: "Great job! 14-day streak on Lisinopril!"
    - REFILL_REMINDER      : "Metformin supply runs out in 7 days"
    """
    def generate_for_patient(self, patient_id: str, plan: str) -> list[Insight]:
        ...
```

### 8.3 AI Model Registry
```python
class AIModelVersion(BaseModel):
    """ai_engine.model_registry — track which ML model is active"""
    model_name    = models.CharField(max_length=100)
    version       = models.CharField(max_length=20)    # semver
    artifact_path = models.TextField()                 # S3/GCS path
    is_active     = models.BooleanField(default=False)
    accuracy      = models.DecimalField(max_digits=5, decimal_places=4)
    deployed_at   = models.DateTimeField(null=True)
    # Only one active per model_name at a time (unique partial index)
```

---

## 9. IoT & HARDWARE DEVICE SKILLS

### 9.1 Hardware-Optional Architecture
The system is **fully functional without any hardware**. Hardware (smart pillbox) is an enhancement layer, not a dependency.

```
Without Hardware:
    Patient → Mobile App → Manual Dose Log → AdherenceEvent

With Hardware:
    Smart Pillbox → MedAdhere IoT Agent → POST /api/v1/iot/events/
                                        → AdherenceEvent (log_method=IOT_PILLBOX)
```

### 9.2 Device Unique ID System
When a customer purchases hardware from the MedAdhere store:

```python
# store/models.py

class HardwareProduct(BaseModel):
    name         = models.CharField(max_length=200)    # "MedAdhere Smart Pillbox Pro"
    sku          = models.CharField(max_length=50, unique=True)
    price        = models.DecimalField(max_digits=10, decimal_places=2)
    description  = models.TextField()
    specifications = models.JSONField()
    stock_count  = models.IntegerField(default=0)
    is_available = models.BooleanField(default=True)

class HardwareOrder(BaseModel):
    user         = models.ForeignKey(User, on_delete=models.PROTECT)
    product      = models.ForeignKey(HardwareProduct, on_delete=models.PROTECT)
    quantity     = models.IntegerField(default=1)
    total_price  = models.DecimalField(max_digits=10, decimal_places=2)
    status       = models.CharField(choices=OrderStatus.choices)
    # PENDING / PAID / PROCESSING / SHIPPED / DELIVERED / CANCELLED
    shipping_address = models.JSONField()
    payment_id   = models.CharField(max_length=200, null=True)
    shipped_at   = models.DateTimeField(null=True)
    delivered_at = models.DateTimeField(null=True)

class DeviceUniqueID(BaseModel):
    """
    Generated at manufacturing time, 1 per physical device.
    Format: MEDA-XXXX-XXXX-XXXX (16 char hex, grouped)
    Printed on device label + QR code on box.
    """
    unique_code      = models.CharField(max_length=25, unique=True)
    hardware_product = models.ForeignKey(HardwareProduct, on_delete=models.PROTECT)
    order            = models.ForeignKey(HardwareOrder, null=True, on_delete=models.SET_NULL)
    is_provisioned   = models.BooleanField(default=False)   # set True on first activation
    manufactured_at  = models.DateTimeField()
    provisioned_at   = models.DateTimeField(null=True)

    @classmethod
    def generate(cls, product, batch_size=1) -> list['DeviceUniqueID']:
        """Bulk generate Unique IDs for manufacturing batches"""
        ids = []
        for _ in range(batch_size):
            code = cls._format_code(secrets.token_hex(8).upper())
            ids.append(cls(unique_code=code, hardware_product=product))
        return cls.objects.bulk_create(ids)

    @staticmethod
    def _format_code(hex_str: str) -> str:
        """MEDA-XXXX-XXXX-XXXX"""
        return f"MEDA-{hex_str[0:4]}-{hex_str[4:8]}-{hex_str[8:12]}"
```

### 9.3 Device Linking Flow
```python
# iot/views.py

class DeviceLinkView(CreateAPIView):
    """
    POST /api/v1/iot/devices/link/
    Body: { "unique_code": "MEDA-A1B2-C3D4-E5F6", "device_name": "My Pillbox" }
    
    Requires: PREMIUM subscription
    """
    permission_classes = [IsAuthenticated, IsPremiumSubscriber]

    def create(self, request, *args, **kwargs):
        code = request.data['unique_code']
        uid  = get_object_or_404(DeviceUniqueID, unique_code=code)
        if uid.is_provisioned:
            return Response({'error': 'Device already linked to another account'}, status=409)
        device = Device.objects.create(
            user=request.user,
            unique_id_record=uid,
            device_name=request.data.get('device_name', 'Smart Pillbox'),
            firmware_version=request.data.get('firmware_version'),
            api_key=secrets.token_urlsafe(32),   # device uses this for IoT events
        )
        uid.is_provisioned = True
        uid.provisioned_at = timezone.now()
        uid.save()
        AuditLog.log(actor=request.user, action='DEVICE_LINKED', target=device)
        return Response(DeviceSerializer(device).data, status=201)

class DeviceEventIngestView(CreateAPIView):
    """
    POST /api/v1/iot/events/
    Auth: Device API Key (in X-Device-Key header, not JWT)
    Called by: physical pillbox firmware
    Translates hardware event → AdherenceEvent
    """
    authentication_classes = [DeviceAPIKeyAuthentication]

    def create(self, request, *args, **kwargs):
        device  = request.auth  # resolved from X-Device-Key
        payload = request.data
        # payload: { "compartment": 1, "event_type": "OPENED", "timestamp": "..." }
        iot_event = DeviceEvent.objects.create(device=device, raw_payload=payload)
        AdherenceEventService.log_from_iot(device, iot_event)
        return Response({'status': 'ok'}, status=200)
```

### 9.4 Device Models
```python
# iot/models.py

class Device(BaseModel):
    user             = models.ForeignKey(User, on_delete=models.PROTECT)
    unique_id_record = models.OneToOneField(DeviceUniqueID, on_delete=models.PROTECT)
    device_name      = models.CharField(max_length=200)
    device_type      = models.CharField(default='SMART_PILLBOX')
    firmware_version = models.CharField(max_length=50, null=True)
    api_key          = models.CharField(max_length=64, unique=True)  # for device auth
    is_active        = models.BooleanField(default=True)
    last_seen_at     = models.DateTimeField(null=True)
    battery_level    = models.SmallIntegerField(null=True)   # 0–100 %
    linked_patient   = models.ForeignKey(Patient, null=True, on_delete=models.SET_NULL)

class DeviceHeartbeat(BaseModel):
    device           = models.ForeignKey(Device, on_delete=models.CASCADE)
    battery_level    = models.SmallIntegerField()
    firmware_version = models.CharField(max_length=50)
    wifi_strength    = models.SmallIntegerField(null=True)
    ip_address       = models.GenericIPAddressField(null=True)
    uptime_seconds   = models.IntegerField(null=True)

class DeviceEvent(BaseModel):
    device           = models.ForeignKey(Device, on_delete=models.CASCADE)
    event_type       = models.CharField()   # COMPARTMENT_OPENED / DOOR_CLOSED / ALERT / etc.
    compartment_num  = models.SmallIntegerField(null=True)
    raw_payload      = models.JSONField()
    processed        = models.BooleanField(default=False)
    adherence_event  = models.ForeignKey('telemetry.AdherenceEvent', null=True, 
                                          on_delete=models.SET_NULL)
```

---

## 10. ADMIN PANEL SKILLS

### 10.1 Django Admin — Custom Admin Site
```python
# admin_panel/admin_site.py

class MedAdhereAdminSite(admin.AdminSite):
    site_header = 'MedAdhere Admin'
    site_title  = 'MedAdhere'
    index_title = 'Platform Administration'

medadhere_admin = MedAdhereAdminSite(name='medadhere_admin')
```

### 10.2 User Management Admin
```python
@admin.register(User, site=medadhere_admin)
class UserAdmin(UserAdmin):
    list_display  = ['email', 'full_name', 'role', 'subscription_plan', 
                     'is_active', 'last_login_at', 'created_at']
    list_filter   = ['role', 'is_active', 'is_email_verified', 
                     'subscription__plan__name']
    search_fields = ['email', 'full_name', 'phone_number']
    actions       = [
        'activate_users', 'deactivate_users',
        'force_password_reset', 'revoke_all_sessions',
        'export_to_csv'
    ]
    readonly_fields = ['last_login_at', 'last_login_ip', 'failed_login_count']

    def subscription_plan(self, obj):
        try:
            return obj.subscription.plan.name
        except: return 'No Plan'
    subscription_plan.short_description = 'Plan'
```

### 10.3 Subscription & Revenue Admin
```python
@admin.register(UserSubscription, site=medadhere_admin)
class UserSubscriptionAdmin(ModelAdmin):
    list_display  = ['user', 'plan', 'status', 'started_at', 
                     'expires_at', 'payment_gateway', 'auto_renew']
    list_filter   = ['plan', 'status', 'payment_gateway', 'auto_renew']
    search_fields = ['user__email', 'gateway_sub_id']
    date_hierarchy = 'started_at'
    actions       = ['cancel_subscriptions', 'extend_30_days', 
                     'upgrade_to_premium', 'downgrade_to_free']
    
    # Custom changelist with revenue summary card
    change_list_template = 'admin/subscription_changelist.html'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'plan')
```

### 10.4 Adherence Analytics Admin
```python
@admin.register(AdherenceEvent, site=medadhere_admin)
class AdherenceEventAdmin(ModelAdmin):
    list_display  = ['patient', 'medication_name', 'status', 
                     'scheduled_at', 'taken_at', 'late_minutes', 'log_method']
    list_filter   = ['status', 'log_method', 'scheduled_at']
    search_fields = ['patient__user__email', 'prescription__medication__name']
    date_hierarchy = 'scheduled_at'
    # Read-only — clinical records are immutable in admin
    readonly_fields = [f.name for f in AdherenceEvent._meta.fields]
```

### 10.5 Hardware & Device Admin
```python
@admin.register(DeviceUniqueID, site=medadhere_admin)
class DeviceUniqueIDAdmin(ModelAdmin):
    list_display  = ['unique_code', 'hardware_product', 'is_provisioned', 
                     'provisioned_at', 'order']
    list_filter   = ['is_provisioned', 'hardware_product']
    search_fields = ['unique_code']
    actions       = ['generate_device_ids', 'export_qr_sheet']

    def generate_device_ids(self, request, queryset):
        """Bulk generate IDs — redirects to custom form"""
        ...

@admin.register(HardwareOrder, site=medadhere_admin)
class HardwareOrderAdmin(ModelAdmin):
    list_display  = ['user', 'product', 'quantity', 'total_price', 
                     'status', 'shipped_at', 'delivered_at']
    list_filter   = ['status', 'product']
    search_fields = ['user__email']
    actions       = ['mark_shipped', 'mark_delivered', 'cancel_orders']
    date_hierarchy = 'created_at'
```

### 10.6 Notification & Alert Admin
```python
@admin.register(NotificationLog, site=medadhere_admin)
class NotificationLogAdmin(ModelAdmin):
    list_display  = ['user', 'channel', 'type', 'status', 
                     'sent_at', 'delivered_at', 'opened_at']
    list_filter   = ['channel', 'status', 'type']
    search_fields = ['user__email']
    # Delivery rate metrics dashboard via custom changelist template
```

### 10.7 Custom Admin Dashboard Views (URLs)
```python
# admin_panel/urls.py — registered on medadhere_admin

urlpatterns = [
    path('dashboard/',          AdminDashboardView.as_view(),     name='dashboard'),
    path('analytics/',          AnalyticsDashboardView.as_view(), name='analytics'),
    path('adherence-report/',   AdherenceReportView.as_view(),    name='adherence_report'),
    path('revenue/',            RevenueReportView.as_view(),      name='revenue'),
    path('device-ids/generate/',GenerateDeviceIDsView.as_view(),  name='generate_device_ids'),
    path('device-ids/export/',  ExportDeviceIDsView.as_view(),    name='export_device_ids'),
    path('notifications/test/', TestNotificationView.as_view(),   name='test_notification'),
    path('ai/insights/run/',    TriggerAIBatchView.as_view(),     name='run_ai_batch'),
    path('audit/',              AuditLogView.as_view(),           name='audit_log'),
    path('system/health/',      SystemHealthView.as_view(),       name='system_health'),
]
```

### 10.8 Admin REST API (for admin SPA frontend)
```python
# admin_panel/api/ — separate DRF router, admin JWT required

router = DefaultRouter()
router.register('metrics/overview',     OverviewMetricsViewSet)
router.register('metrics/adherence',    AdherenceMetricsViewSet)
router.register('metrics/revenue',      RevenueMetricsViewSet)
router.register('users',                AdminUserViewSet)
router.register('subscriptions',        AdminSubscriptionViewSet)
router.register('devices',              AdminDeviceViewSet)
router.register('notifications',        AdminNotificationViewSet)
router.register('ai/risk-scores',       AdminRiskScoreViewSet)
router.register('audit-logs',           AdminAuditLogViewSet)
router.register('system/jobs',          AdminCeleryJobViewSet)
```

---

## 11. BACKGROUND JOB SKILLS (Celery)

```python
# All tasks in respective apps' tasks.py

# PERIODIC (Celery Beat)
CELERYBEAT_SCHEDULE = {
    'nightly-risk-scoring':        every day at 02:00 AM UTC  → batch_risk_score_all_patients
    'weekly-adherence-report':     every Monday 06:00 AM UTC  → generate_weekly_reports
    'session-cleanup':             every hour                 → purge_expired_sessions
    'refill-alerts':               every day at 09:00 AM UTC  → check_refill_thresholds
    'heartbeat-monitor':           every 5 minutes            → check_device_heartbeats
    'subscription-expiry-check':   every day at 01:00 AM UTC  → handle_expiring_subscriptions
}

# EVENT-DRIVEN
send_reminder              → triggered by ScheduleGenerationService (eta-based)
escalation_check           → triggered by send_reminder if no confirmation within window
send_push_notification     → triggered by NotificationDispatcher
send_sms_notification      → triggered by NotificationDispatcher
send_whatsapp_notification → triggered by NotificationDispatcher
process_iot_event          → triggered by DeviceEventIngestView
generate_ai_insight        → triggered on high-risk score detection
```

---

## 12. API DESIGN SKILLS

### 12.1 URL Structure
```
/api/v1/
    auth/
        login/                  POST  — JWT login
        register/               POST  — registration
        logout/                 POST  — revoke session
        refresh/                POST  — new access token
        mfa/setup/              POST  — TOTP setup
        mfa/verify/             POST  — TOTP verify
        password/change/        POST
        password/reset/         POST, PUT
    users/
        me/                     GET, PATCH
        me/notifications/       GET, PATCH
    patients/
        me/                     GET, PUT
        me/conditions/          GET, POST, DELETE
        me/medications/         GET, POST, PUT, DELETE
        me/schedules/           GET, POST, PUT, DELETE
        me/adherence/           GET
        me/adherence/log/       POST
        me/insights/            GET
        me/risk-score/          GET
        me/caregivers/          GET, POST, DELETE
        me/reports/             GET
    caregivers/
        patients/               GET         — linked patients
        patients/{id}/          GET         — patient detail
        patients/{id}/adherence/GET
        patients/{id}/alerts/   GET
    subscriptions/
        plans/                  GET
        current/                GET
        upgrade/                POST
        cancel/                 POST
        invoices/               GET
    store/
        products/               GET
        products/{id}/          GET
        orders/                 GET, POST
        orders/{id}/            GET
    iot/
        devices/                GET
        devices/link/           POST
        devices/{id}/           GET, DELETE
        devices/{id}/status/    GET
        events/                 POST        — device firmware endpoint
    admin/api/v1/
        (see section 10.8)
```

### 12.2 API Response Standard
```python
# shared/response.py
class APIResponse:
    @staticmethod
    def success(data, message='', status=200, meta=None):
        return Response({
            'success': True,
            'message': message,
            'data': data,
            'meta': meta or {},
        }, status=status)

    @staticmethod
    def error(message, code, status=400, errors=None):
        return Response({
            'success': False,
            'error': {'code': code, 'message': message, 'details': errors or {}}
        }, status=status)
```

---

## 13. DATABASE SKILLS

### 13.1 Migration Strategy
```bash
python manage.py makemigrations identity clinical telemetry ai_engine iot subscriptions store audit
python manage.py migrate --database=default
```

### 13.2 Performance Indexes (key ones)
```sql
-- Most critical indexes for query performance
CREATE INDEX idx_adherence_patient_scheduled 
    ON telemetry.adherence_events(patient_id, scheduled_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_reminder_jobs_eta 
    ON telemetry.reminder_jobs(scheduled_at)
    WHERE status = 'PENDING';

CREATE INDEX idx_devices_api_key 
    ON iot.devices(api_key)
    WHERE is_active = TRUE;
```

### 13.3 Database Seeding
```bash
python manage.py seed_subscription_plans     # creates FREE / FREEMIUM / PREMIUM plans
python manage.py seed_medications_db         # loads WHO essential medicines list
python manage.py seed_icd10_codes            # loads ICD-10 disease codes
python manage.py create_superadmin           # creates initial admin user
```

---

## 14. OBSERVABILITY & AUDIT SKILLS

### 14.1 HIPAA Audit Log
```python
class AuditLog(BaseModel):
    """audit.audit_logs — immutable, append-only"""
    actor          = models.ForeignKey(User, on_delete=models.PROTECT, null=True)
    action         = models.CharField(max_length=100)
    # LOGIN / LOGOUT / VIEW_PHI / UPDATE_PROFILE / LOG_DOSE / LINK_DEVICE / etc.
    resource_type  = models.CharField(max_length=100)
    resource_id    = models.UUIDField()
    ip_address     = models.GenericIPAddressField()
    user_agent     = models.TextField(null=True)
    before_state   = models.JSONField(null=True)    # for updates
    after_state    = models.JSONField(null=True)
    # AuditLog.objects NEVER has a delete() method — immutable by design
```

### 14.2 Health Check Endpoint
```python
GET /api/v1/health/
# Returns: DB connection, Redis, Celery worker count, last job run times
```

---

*End of SKILLS.md — MedAdhere Backend*  
*Stack: Django 5.x · DRF · PostgreSQL · Celery · Redis*
