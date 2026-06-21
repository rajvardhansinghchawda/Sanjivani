# Healthcare Management System - Complete Working Specification

**Purpose**: This document provides complete, detailed specifications for AI agents to recreate the Healthcare Management System from scratch. It includes architecture, database schema, API specifications, configuration, and implementation details.

**Target Audience**: AI Agents, Developers, DevOps Engineers

---

## 📑 Table of Contents

1. [Project Overview & Requirements](#1-project-overview--requirements)
2. [Technology Stack Details](#2-technology-stack-details)
3. [System Architecture](#3-system-architecture)
4. [Database Schema & Models](#4-database-schema--models)
5. [Backend Implementation](#5-backend-implementation)
6. [Frontend Implementation](#6-frontend-implementation)
7. [API Specifications](#7-api-specifications)
8. [Configuration Files](#8-configuration-files)
9. [Deployment Guide](#9-deployment-guide)
10. [Integration Points](#10-integration-points)

---

## 1. Project Overview & Requirements

### 1.1 Project Goals

This is a **Hospital & Emergency Management System** providing:
- Real-time emergency dispatch and ambulance tracking
- Hospital resource and bed management
- Patient health record management
- Multi-role user management with role-based access control
- AI-powered emergency routing decisions
- Real-time notifications via WebSockets
- Analytics and reporting dashboards

### 1.2 Functional Requirements

#### User Management
- Support 5 user roles: Reception Staff, Supervisor, Admin, Ambulance Driver, Patient
- Role-based access control (RBAC) on all endpoints
- JWT-based authentication with 8-hour access tokens, 7-day refresh tokens
- Email-based user registration and login
- Password reset workflow

#### Hospital Management
- CRUD operations for hospital profiles
- Multiple departments per hospital
- Hospital verification workflow (pending, verified, rejected states)
- Staff assignment to hospitals
- Hospital capacity and bed management

#### Bed Management
- Real-time bed availability tracking (Available, Occupied, Maintenance)
- Patient-to-bed assignment
- Ward and room organization
- Long occupancy alerts (>20 days)
- Occupancy analytics and reporting

#### Patient Management
- Complete patient profiles with contact information
- Medical assessment records
- Medical history tracking
- Patient-to-hospital assignments
- Patient search and filtering

#### Ambulance Management
- Fleet management with driver assignment
- Real-time GPS tracking
- Availability status tracking
- Vehicle registration and maintenance

#### Emergency Dispatch System
- Emergency call creation and tracking
- AI-powered ambulance assignment (using Google Gemini)
- Call status workflow: Pending → Assigned → In-Progress → Completed
- Geographic routing based on location
- Response time tracking

#### Resource Management
- Medical equipment and supply inventory
- Quantity tracking and expiry dates
- Cross-hospital resource sharing
- Resource mismatch alerts

#### Analytics & Reporting
- Dashboard with key metrics (total beds, occupancy %, calls/day, etc.)
- Occupancy trend charts
- Hospital performance metrics
- Call response time analytics
- Mobile-responsive dashboard

#### Notifications
- Real-time WebSocket notifications for status updates
- SMS notifications via Twilio
- Email notifications
- Notification history and preferences

#### Supervisor Tools
- Long occupancy alerts (beds occupied >20 days)
- Resource mismatch detection across hospitals
- Hospital verification workflows
- Missing resource update notifications

### 1.3 Non-Functional Requirements

- **Performance**: Support 1000+ concurrent WebSocket connections
- **Scalability**: Horizontal scaling via containerization (Docker)
- **Availability**: 99.5% uptime SLA
- **Security**: JWT authentication, HTTPS/TLS, secure password storage
- **Data Integrity**: ACID transactions on critical operations
- **Monitoring**: Logging and alerting for all critical flows
- **Mobile**: iOS/Android support via Capacitor (responsive web)

---

## 2. Technology Stack Details

### 2.1 Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Django | 4.2+ | Web framework |
| **API Framework** | Django REST Framework | 3.14+ | RESTful API development |
| **Database** | PostgreSQL | 12+ | Primary data store |
| **Cache** | Redis | 6+ | Session cache, rate limiting |
| **Message Broker** | Redis | (same as cache) | Celery task queue |
| **Task Queue** | Celery | 5.3+ | Async task processing |
| **Task Scheduler** | Celery Beat | (part of Celery) | Periodic task scheduling |
| **WebSockets** | Django Channels | 4.0+ | Real-time notifications |
| **WS Transport** | channels-redis | 4.1+ | Redis backing for Channels |
| **Authentication** | rest-framework-simplejwt | 5.2+ | JWT token management |
| **CORS** | django-cors-headers | 3.13+ | Cross-origin requests |
| **Filtering** | django-filter | 23.1+ | Advanced API filtering |
| **Environment** | python-dotenv | 1.0+ | Environment variable management |
| **AI/ML** | Google Generative AI | Latest | Gemini API for routing |
| **SMS** | Twilio | Latest | SMS notifications |
| **ASGI Server** | Daphne | 3.0+ | WebSocket support (production) |
| **WSGI Server** | Gunicorn | 21+ | Production HTTP server |

### 2.2 Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 19+ | UI framework |
| **Router** | React Router | 7+ | Client-side routing |
| **Build Tool** | Vite | 5+ | Fast development server |
| **Styling** | Tailwind CSS | 4+ | Utility-first CSS |
| **HTTP Client** | Axios | 1.13+ | API requests |
| **Maps** | Leaflet | 1.9+ | Interactive maps |
| **Maps React** | React-Leaflet | 5+ | Leaflet React integration |
| **Google Maps** | @react-google-maps/api | 2.20+ | Google Maps integration |
| **Charts** | Recharts | 3.8+ | Data visualization |
| **Animations** | GSAP | 3.14+ | Smooth animations |
| **Mobile** | Capacitor | 8+ | iOS/Android bridge |
| **Linting** | ESLint | 9+ | Code quality |
| **Package Manager** | npm | 9+ | Dependency management |

### 2.3 Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database Hosting** | PostgreSQL Server | Data persistence |
| **Caching/Broker** | Redis Server | Cache, task queue, WebSockets |
| **Container Runtime** | Docker | Containerization |
| **Orchestration** | Kubernetes (optional) | Container orchestration |
| **Reverse Proxy** | Nginx | Load balancing, static files |
| **SSL/TLS** | Let's Encrypt | HTTPS encryption |
| **Monitoring** | (Custom logging + ELK optional) | System monitoring |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CLIENT LAYER                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Web Browser │  │ iOS App      │  │ Android    │  │
│  │ (React SPA) │  │ (Capacitor)  │  │ (Capacitor)│  │
│  └──────┬──────┘  └──────┬───────┘  └────┬───────┘  │
└─────────┼──────────────────┼───────────────┼──────────┘
          │                  │               │
          └──────────────────┼───────────────┘
                             │ HTTP/WebSocket
                    ┌────────▼────────┐
                    │   GATEWAY LAYER │
                    │ (Nginx Reverse  │
                    │    Proxy)       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐        ┌─────▼──────┐       ┌────▼──────┐
   │ DRF API │        │ Channels   │       │   Static  │
   │(Django) │        │ WS (Daphne)│       │   Files   │
   │         │        │            │       │ (Nginx)   │
   └────┬────┘        └─────┬──────┘       └───────────┘
        │                   │
        │ ┌──────────────────┘
        │ │
   ┌────▼─┴────────────────────────────────────────┐
   │             APPLICATION LAYER                 │
   │  ┌────────────────────────────────────────┐   │
   │  │ Django Application (11 Django Apps)    │   │
   │  │ - Authentication, Hospitals, Beds,     │   │
   │  │   Patients, Ambulances, Calls,         │   │
   │  │   Supervisors, Analytics, Resources,   │   │
   │  │   Notifications                        │   │
   │  └────────────────────────────────────────┘   │
   │                                               │
   │  ┌────────────────────────────────────────┐   │
   │  │ Celery Worker (Async Tasks)           │   │
   │  │ - SMS notifications, AI routing        │   │
   │  └────────────────────────────────────────┘   │
   │                                               │
   │  ┌────────────────────────────────────────┐   │
   │  │ Celery Beat (Scheduled Tasks)         │   │
   │  │ - Occupancy checks, resource audits   │   │
   │  └────────────────────────────────────────┘   │
   └────┬──────────────────────────────────────────┘
        │
   ┌────┴──────────────────────────────────────────┐
   │             DATA LAYER                        │
   │                                               │
   │  ┌──────────────┐  ┌──────────────┐          │
   │  │ PostgreSQL   │  │ Redis        │          │
   │  │ (Primary DB) │  │ (Cache,      │          │
   │  │              │  │ Broker, WS)  │          │
   │  └──────────────┘  └──────────────┘          │
   └───────────────────────────────────────────────┘
        │
   ┌────┴──────────────────────────────────────────┐
   │          EXTERNAL SERVICES                    │
   │  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
   │  │ Twilio   │  │ Google   │  │ Email SMTP │  │
   │  │ (SMS)    │  │ Gemini   │  │ Provider   │  │
   │  │          │  │ (AI)     │  │            │  │
   │  └──────────┘  └──────────┘  └────────────┘  │
   └───────────────────────────────────────────────┘
```

### 3.2 Data Flow Diagram

#### Emergency Call Flow
```
Patient/Reception Staff
      ↓
  POST /api/calls/
      ↓
  Create Call (Celery Task)
      ↓
  Call AI Service (Gemini API)
  ├─ Analyze patient location
  ├─ Find nearest ambulances
  ├─ Check ambulance availability
      ↓
  Assign Ambulance (Celery Task)
      ↓
  Send SMS via Twilio
      ↓
  Notify via WebSocket (Channels)
      ↓
  Update Call Status
      ↓
  React Dashboard (Real-time update)
```

#### Notification Flow
```
Backend Event
      ↓
  Create Notification Record (DB)
      ↓
  Send to Channel Layer (Redis)
      ↓
  Django Channels Consumer
      ↓
  WebSocket Message to Client
      ↓
  React Component Update
      ↓
  SMS via Twilio (async)
      ↓
  Email via SMTP (async)
```

---

## 4. Database Schema & Models

### 4.1 Entity-Relationship Diagram (Conceptual)

```
┌──────────────┐
│    USER      │
├──────────────┤
│ id (PK, UUID)│
│ email        │
│ phone        │
│ full_name    │
│ role         │◄──┐
│ hospital_id  │   │
│ created_at   │   │
└──────────────┘   │
       │           │
       ├──────────────┐
       │              │
   AMBULANCE      HOSPITAL
       │              │
       └──────────────┘
                │
       ┌────────┼────────┐
       │        │        │
      BED    PATIENT  DEPARTMENT
       │        │        
       └────────┴──────────┐
                           │
                        CALL
                           │
                        RESOURCE
```

### 4.2 Complete Model Definitions

#### **User Model**
```python
class User(AbstractBaseUser, PermissionsMixin):
    Role = [
        ('reception', 'Reception Staff'),
        ('supervisor', 'Supervisor'),
        ('admin', 'Admin'),
        ('ambulance', 'Ambulance Driver'),
        ('patient', 'Patient')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    email = EmailField(unique=True)
    phone = CharField(max_length=15, unique=True, null=True, blank=True)
    full_name = CharField(max_length=150)
    role = CharField(max_length=20, choices=Role)
    hospital = ForeignKey('Hospital', null=True, on_delete=SET_NULL)
    is_active = BooleanField(default=True)
    is_staff = BooleanField(default=False)
    is_superuser = BooleanField(default=False)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']
    
    managers = UserManager()
```

#### **Hospital Model**
```python
class Hospital(Model):
    VerificationStatus = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    name = CharField(max_length=255)
    address = TextField()
    latitude = FloatField(null=True, blank=True)  # GPS coordinate
    longitude = FloatField(null=True, blank=True)  # GPS coordinate
    phone = CharField(max_length=15)
    total_beds = IntegerField(default=0)
    occupied_beds = IntegerField(default=0)
    verification_status = CharField(
        max_length=20,
        choices=VerificationStatus,
        default='pending'
    )
    is_active = BooleanField(default=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['verification_status', 'is_active'])
        ]
```

#### **Department Model**
```python
class Department(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    hospital = ForeignKey('Hospital', on_delete=CASCADE)
    name = CharField(max_length=100)
    head_of_department = ForeignKey(
        'User',
        null=True,
        on_delete=SET_NULL,
        related_name='departments_managed'
    )
    description = TextField(blank=True)
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('hospital', 'name')
```

#### **Bed Model**
```python
class Bed(Model):
    Status = [
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('maintenance', 'Maintenance')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    hospital = ForeignKey('Hospital', on_delete=CASCADE, related_name='beds')
    department = ForeignKey(
        'Department',
        null=True,
        on_delete=SET_NULL,
        related_name='beds'
    )
    ward_name = CharField(max_length=50)
    bed_number = CharField(max_length=10)
    status = CharField(max_length=20, choices=Status, default='available')
    patient = ForeignKey(
        'Patient',
        null=True,
        blank=True,
        on_delete=SET_NULL,
        related_name='bed_assignments'
    )
    check_in_date = DateTimeField(null=True, blank=True)
    check_out_date = DateTimeField(null=True, blank=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('hospital', 'ward_name', 'bed_number')
        indexes = [
            Index(fields=['hospital', 'status']),
            Index(fields=['patient'])
        ]
    
    def occupancy_duration(self):
        """Calculate days occupied"""
        if self.check_in_date:
            end = self.check_out_date or now()
            return (end - self.check_in_date).days
```

#### **Patient Model**
```python
class Patient(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    user = OneToOneField('User', on_delete=CASCADE, related_name='patient_profile')
    date_of_birth = DateField()
    medical_history = TextField(blank=True)
    blood_type = CharField(max_length=5, choices=[
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'), ('O+', 'O+'), ('O-', 'O-')
    ], null=True, blank=True)
    allergies = TextField(blank=True)
    emergency_contact = CharField(max_length=15)
    emergency_contact_name = CharField(max_length=150)
    current_hospital = ForeignKey(
        'Hospital',
        null=True,
        blank=True,
        on_delete=SET_NULL,
        related_name='patients'
    )
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

#### **PatientAssessment Model**
```python
class PatientAssessment(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    patient = ForeignKey('Patient', on_delete=CASCADE, related_name='assessments')
    hospital = ForeignKey('Hospital', on_delete=CASCADE)
    assessment_type = CharField(max_length=50)
    blood_pressure = CharField(max_length=10, blank=True)  # e.g., "120/80"
    heart_rate = IntegerField(null=True, blank=True)
    temperature = FloatField(null=True, blank=True)
    notes = TextField(blank=True)
    assessed_by = ForeignKey(
        'User',
        on_delete=SET_NULL,
        null=True,
        related_name='assessments'
    )
    assessment_date = DateTimeField(auto_now_add=True)
```

#### **Ambulance Model**
```python
class Ambulance(Model):
    Status = [
        ('available', 'Available'),
        ('in_use', 'In Use'),
        ('maintenance', 'Maintenance'),
        ('out_of_service', 'Out of Service')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    registration_number = CharField(max_length=20, unique=True)
    hospital = ForeignKey('Hospital', on_delete=CASCADE, related_name='ambulances')
    driver = ForeignKey(
        'User',
        limit_choices_to={'role': 'ambulance'},
        null=True,
        on_delete=SET_NULL,
        related_name='ambulances'
    )
    status = CharField(max_length=20, choices=Status, default='available')
    current_latitude = FloatField(null=True, blank=True)  # GPS tracking
    current_longitude = FloatField(null=True, blank=True)
    last_location_update = DateTimeField(null=True, blank=True)
    capacity = IntegerField(default=2)
    features = JSONField(default=dict)  # e.g., {"oxygen": true, "stretcher": true}
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

#### **Call Model** (Emergency Dispatch)
```python
class Call(Model):
    Status = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    patient = ForeignKey('Patient', on_delete=CASCADE, related_name='calls')
    source_hospital = ForeignKey(
        'Hospital',
        null=True,
        on_delete=SET_NULL,
        related_name='outgoing_calls'
    )
    destination_hospital = ForeignKey(
        'Hospital',
        null=True,
        on_delete=SET_NULL,
        related_name='incoming_calls'
    )
    ambulance = ForeignKey(
        'Ambulance',
        null=True,
        blank=True,
        on_delete=SET_NULL,
        related_name='calls'
    )
    status = CharField(max_length=20, choices=Status, default='pending')
    reason = CharField(max_length=255)
    description = TextField(blank=True)
    
    # Location coordinates
    pickup_latitude = FloatField()
    pickup_longitude = FloatField()
    dropoff_latitude = FloatField(null=True, blank=True)
    dropoff_longitude = FloatField(null=True, blank=True)
    
    # Timestamps
    created_at = DateTimeField(auto_now_add=True)
    assigned_at = DateTimeField(null=True, blank=True)
    completed_at = DateTimeField(null=True, blank=True)
    
    # Response metrics
    response_time_minutes = IntegerField(null=True, blank=True)
    dispatch_notes = TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['status', '-created_at']),
            Index(fields=['ambulance', 'status'])
        ]
```

#### **CallTimeline Model** (Audit Trail)
```python
class CallTimeline(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    call = ForeignKey('Call', on_delete=CASCADE, related_name='timeline')
    event_type = CharField(max_length=50)
    description = TextField()
    timestamp = DateTimeField(auto_now_add=True)
    changed_by = ForeignKey('User', null=True, on_delete=SET_NULL)
    
    class Meta:
        ordering = ['-timestamp']
```

#### **Resource Model**
```python
class Resource(Model):
    id = UUIDField(primary_key=True, default=uuid4)
    hospital = ForeignKey('Hospital', on_delete=CASCADE, related_name='resources')
    resource_type = CharField(max_length=100)  # e.g., "Oxygen Cylinder", "IV Stand"
    quantity = IntegerField()
    unit = CharField(max_length=20)  # e.g., "pieces", "liters"
    expiry_date = DateField(null=True, blank=True)
    location = CharField(max_length=255)  # e.g., "Storage Room A"
    is_consumable = BooleanField(default=True)
    last_audit_date = DateTimeField(null=True, blank=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('hospital', 'resource_type', 'location')
```

#### **Notification Model**
```python
class Notification(Model):
    NotificationType = [
        ('call_assigned', 'Call Assigned'),
        ('call_completed', 'Call Completed'),
        ('bed_available', 'Bed Available'),
        ('resource_alert', 'Resource Alert'),
        ('alert', 'Alert')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    user = ForeignKey('User', on_delete=CASCADE, related_name='notifications')
    notification_type = CharField(max_length=50, choices=NotificationType)
    title = CharField(max_length=255)
    message = TextField()
    related_object_type = CharField(max_length=50, blank=True)
    related_object_id = UUIDField(null=True, blank=True)
    is_read = BooleanField(default=False)
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['user', 'is_read', '-created_at'])
        ]
```

#### **VerificationRequest Model**
```python
class VerificationRequest(Model):
    Status = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ]
    
    id = UUIDField(primary_key=True, default=uuid4)
    hospital = ForeignKey('Hospital', on_delete=CASCADE, related_name='verification_requests')
    created_by = ForeignKey('User', on_delete=SET_NULL, null=True)
    status = CharField(max_length=20, choices=Status, default='pending')
    verification_document = FileField(upload_to='verifications/')
    submitted_at = DateTimeField(auto_now_add=True)
    verified_at = DateTimeField(null=True, blank=True)
    verified_by = ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=SET_NULL,
        related_name='verified_hospitals'
    )
    notes = TextField(blank=True)
```

---

## 5. Backend Implementation

### 5.1 Project Structure

```
backend/
├── manage.py                    # Django management CLI
├── requirements.txt             # Python dependencies
├── .env                        # Environment variables
│
├── config/                     # Django project configuration
│   ├── __init__.py
│   ├── settings.py            # Main settings file
│   ├── urls.py                # Root URL configuration
│   ├── wsgi.py                # WSGI entry point
│   ├── asgi.py                # ASGI entry point (WebSockets)
│   ├── celery.py              # Celery configuration
│   └── __pycache__/
│
├── core/                       # Core utilities
│   ├── __init__.py
│   ├── permissions.py         # Custom DRF permissions
│   ├── exceptions.py          # Custom API exceptions
│   ├── pagination.py          # Custom pagination classes
│   └── __pycache__/
│
└── apps/                       # Django applications
    ├── authentication/
    │   ├── models.py         # User model with role-based system
    │   ├── serializers.py    # User serializers (login, register, etc.)
    │   ├── views.py          # User management endpoints
    │   ├── urls.py           # Authentication URLs
    │   ├── permissions.py    # Auth-related permissions
    │   ├── helpers.py        # Email verification, password reset
    │   ├── tests.py          # Unit tests
    │   ├── migrations/       # Database migrations
    │   └── __init__.py
    │
    ├── hospitals/
    │   ├── models.py         # Hospital, Department models
    │   ├── serializers.py    # Hospital serializers
    │   ├── views.py          # Hospital CRUD endpoints
    │   ├── urls.py           # Hospital URLs
    │   ├── filters.py        # Advanced filtering
    │   ├── permissions.py    # Hospital permissions
    │   ├── admin.py          # Django admin config
    │   ├── tests.py          # Tests
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── beds/
    │   ├── models.py         # Bed model
    │   ├── serializers.py    # Bed serializers
    │   ├── views.py          # Bed endpoints + availability
    │   ├── urls.py           # Bed URLs
    │   ├── cache.py          # Redis caching logic
    │   ├── permissions.py
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── patients/
    │   ├── models.py         # Patient, PatientAssessment
    │   ├── serializers.py
    │   ├── views.py          # Patient endpoints
    │   ├── urls.py
    │   ├── filters.py
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── ambulances/
    │   ├── models.py         # Ambulance model
    │   ├── serializers.py
    │   ├── views.py          # Ambulance endpoints + GPS tracking
    │   ├── urls.py
    │   ├── cache.py          # Cache ambulance locations
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── calls/
    │   ├── models.py         # Call, CallTimeline models
    │   ├── serializers.py
    │   ├── views.py          # Call endpoints + dispatch
    │   ├── urls.py
    │   ├── services.py       # AI dispatch logic (Gemini)
    │   ├── agent.py          # AI agent for routing decisions
    │   ├── tasks.py          # Celery tasks (async dispatch, SMS)
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── supervisors/
    │   ├── models.py         # Optional: SupervisorAlert model
    │   ├── serializers.py
    │   ├── views.py          # Supervisor endpoints
    │   ├── urls.py
    │   ├── services.py       # Business logic for checks
    │   ├── tasks.py          # Celery Beat scheduled tasks
    │   │                     # - check_long_occupancy_beds
    │   │                     # - check_resource_mismatches
    │   │                     # - check_pending_verifications
    │   │                     # - check_transfer_delays
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── analytics/
    │   ├── models.py         # Analytics data models
    │   ├── views.py          # Dashboard endpoints
    │   ├── urls.py
    │   ├── helpers.py        # Analytics calculations
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── resources/
    │   ├── models.py         # Resource model
    │   ├── serializers.py
    │   ├── views.py          # Resource endpoints
    │   ├── urls.py
    │   ├── filters.py
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    ├── notifications/
    │   ├── models.py         # Notification model
    │   ├── serializers.py
    │   ├── views.py          # Notification endpoints
    │   ├── urls.py
    │   ├── consumers.py      # WebSocket consumers (Channels)
    │   ├── routing.py        # WebSocket routing
    │   ├── tasks.py          # Celery SMS/email tasks
    │   ├── tests.py
    │   ├── migrations/
    │   └── __init__.py
    │
    └── __init__.py
```

### 5.2 Django Settings Configuration (config/settings.py)

Key sections:

```python
# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT'),
        'ATOMIC_REQUESTS': True,  # ACID transactions
    }
}

# Redis Cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL'),
        'TIMEOUT': 300,
    }
}

# Celery Configuration
CELERY_BROKER_URL = env('CELERY_BROKER_URL')
CELERY_RESULT_BACKEND = env('REDIS_URL')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Celery Beat Schedule
CELERY_BEAT_SCHEDULE = {
    'check-long-occupancy': {
        'task': 'apps.supervisors.tasks.check_long_occupancy_beds',
        'schedule': crontab(minute=0),  # Every hour
    },
    'check-resource-mismatches': {
        'task': 'apps.supervisors.tasks.check_resource_mismatches',
        'schedule': crontab(minute=0, hour='*/4'),  # Every 4 hours
    },
    'check-verifications': {
        'task': 'apps.supervisors.tasks.check_pending_hospital_verifications',
        'schedule': crontab(minute=0, hour=9),  # Daily at 9am
    },
    'check-transfer-delays': {
        'task': 'apps.supervisors.tasks.check_transfer_delays',
        'schedule': crontab(minute=0, hour='*/2'),  # Every 2 hours
    },
    'check-missing-resource-updates': {
        'task': 'apps.supervisors.tasks.check_missing_resource_updates',
        'schedule': crontab(minute=0),  # Every hour
    },
}

# Django Channels (WebSockets)
ASGI_APPLICATION = 'config.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [env('REDIS_CHANNELS_URL', default='redis://localhost:6379/2')],
        },
    },
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# DRF Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',  # Vite dev server
    'http://localhost:3000',  # Alternative frontend
]

# Static & Media Files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

### 5.3 URL Configuration (config/urls.py)

```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/hospitals/', include('apps.hospitals.urls')),
    path('api/beds/', include('apps.beds.urls')),
    path('api/patients/', include('apps.patients.urls')),
    path('api/ambulances/', include('apps.ambulances.urls')),
    path('api/calls/', include('apps.calls.urls')),
    path('api/supervisors/', include('apps.supervisors.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/resources/', include('apps.resources.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

### 5.4 WebSocket Configuration (config/asgi.py)

```python
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from apps.notifications import routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(
        URLRouter(
            routing.websocket_urlpatterns
        )
    ),
})
```

### 5.5 Celery Configuration (config/celery.py)

```python
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('healthcare')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
```

### 5.6 Core Permissions (core/permissions.py)

```python
from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'admin'

class IsReceptionOrSupervisor(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role in ['reception', 'supervisor']

class IsAmbulanceDriver(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'ambulance'

class IsPatient(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'patient'

class IsOwnHospitalStaff(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.hospital == request.user.hospital
```

### 5.7 Key Views Examples

#### Authentication Views (apps/authentication/views.py)
```python
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer, LoginSerializer

class LoginView(TokenObtainPairView):
    """Custom JWT login endpoint"""
    serializer_class = LoginSerializer

class UserViewSet(viewsets.ModelViewSet):
    """User CRUD and management"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def current_user(self, request):
        """Get current logged-in user"""
        return Response(UserSerializer(request.user).data)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change user password"""
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not user.check_password(old_password):
            return Response({'detail': 'Invalid password'}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password changed'})
```

#### Hospital Views (apps/hospitals/views.py)
```python
from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Hospital, Department
from .serializers import HospitalSerializer, DepartmentSerializer
from .permissions import IsOwnHospitalStaff

class HospitalViewSet(viewsets.ModelViewSet):
    """Hospital CRUD operations"""
    queryset = Hospital.objects.all()
    serializer_class = HospitalSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['verification_status', 'is_active']
    search_fields = ['name', 'address']
    
    def get_queryset(self):
        """Filter based on user role"""
        user = self.request.user
        if user.role in ['reception', 'supervisor']:
            return Hospital.objects.filter(id=user.hospital.id)
        return Hospital.objects.all()
```

#### Call Views (apps/calls/views.py)
```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Call
from .serializers import CallSerializer
from .tasks import dispatch_ambulance_async

class CallViewSet(viewsets.ModelViewSet):
    """Emergency call management"""
    queryset = Call.objects.all()
    serializer_class = CallSerializer
    
    def create(self, request, *args, **kwargs):
        """Create emergency call with auto-dispatch"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        call = serializer.save()
        
        # Trigger async dispatch via Celery
        dispatch_ambulance_async.delay(str(call.id))
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark call as completed"""
        call = self.get_object()
        call.status = 'completed'
        call.completed_at = now()
        call.response_time_minutes = (call.completed_at - call.created_at).total_seconds() / 60
        call.save()
        return Response(CallSerializer(call).data)
```

### 5.8 Celery Tasks Examples (apps/calls/tasks.py)

```python
from celery import shared_task
from .services import dispatch_call_with_ai
from apps.notifications.tasks import send_sms_notification

@shared_task
def dispatch_ambulance_async(call_id):
    """
    Async task to dispatch ambulance using AI
    """
    from .models import Call
    call = Call.objects.get(id=call_id)
    
    # Use AI service to assign ambulance
    ambulance = dispatch_call_with_ai(call)
    
    if ambulance:
        call.ambulance = ambulance
        call.status = 'assigned'
        call.assigned_at = now()
        call.save()
        
        # Send SMS to ambulance driver
        send_sms_notification.delay(
            ambulance.driver.phone,
            f"Emergency dispatch: Patient at coordinates {call.pickup_latitude}, {call.pickup_longitude}"
        )
        
        # Create notification
        Notification.objects.create(
            user=ambulance.driver,
            notification_type='call_assigned',
            title='Emergency Dispatch',
            message='You have been assigned an emergency call'
        )
```

### 5.9 WebSocket Consumer (apps/notifications/consumers.py)

```python
from channels.generic.websocket import AsyncWebsocketConsumer
import json

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['user'].id
        self.room_group_name = f'user_{self.user_id}'
        
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
    
    async def notification_message(self, event):
        """Receive notification from group"""
        await self.send(text_data=json.dumps({
            'type': event['notification_type'],
            'message': event['message'],
            'data': event.get('data', {})
        }))
```

---

## 6. Frontend Implementation

### 6.1 Frontend Project Structure

```
frontend/hospital/
├── src/
│   ├── components/              # Reusable components
│   │   ├── Layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Footer.jsx
│   │   ├── Common/
│   │   │   ├── Modal.jsx
│   │   │   ├── Spinner.jsx
│   │   │   ├── Alert.jsx
│   │   │   └── Card.jsx
│   │   ├── Forms/
│   │   │   ├── LoginForm.jsx
│   │   │   ├── HospitalForm.jsx
│   │   │   └── PatientForm.jsx
│   │   ├── Maps/
│   │   │   ├── MapView.jsx
│   │   │   └── RealTimeTracking.jsx
│   │   └── Charts/
│   │       ├── OccupancyChart.jsx
│   │       ├── CallsChart.jsx
│   │       └── PerformanceMetrics.jsx
│   │
│   ├── pages/                   # Page components
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── ForgotPassword.jsx
│   │   ├── hospital/
│   │   │   ├── HospitalList.jsx
│   │   │   ├── HospitalDetail.jsx
│   │   │   └── HospitalForm.jsx
│   │   ├── beds/
│   │   │   ├── BedList.jsx
│   │   │   ├── BedAvailability.jsx
│   │   │   └── AssignBed.jsx
│   │   ├── patients/
│   │   │   ├── PatientList.jsx
│   │   │   ├── PatientProfile.jsx
│   │   │   └── PatientAssessment.jsx
│   │   ├── ambulances/
│   │   │   ├── AmbulanceFleet.jsx
│   │   │   ├── RealTimeTracking.jsx
│   │   │   └── DriverDashboard.jsx
│   │   ├── calls/
│   │   │   ├── EmergencyDispatch.jsx
│   │   │   ├── CallHistory.jsx
│   │   │   └── CallDetail.jsx
│   │   ├── dashboard/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── SupervisorDashboard.jsx
│   │   │   ├── ReceptionDashboard.jsx
│   │   │   ├── AmbulanceDashboard.jsx
│   │   │   └── PatientDashboard.jsx
│   │   └── analytics/
│   │       ├── Analytics.jsx
│   │       └── Reports.jsx
│   │
│   ├── services/                # API communication
│   │   ├── api.js              # Axios instance
│   │   ├── auth.js             # Auth endpoints
│   │   ├── hospitals.js        # Hospital endpoints
│   │   ├── calls.js            # Call endpoints
│   │   ├── websocket.js        # WebSocket connection
│   │   └── analytics.js        # Analytics endpoints
│   │
│   ├── context/                 # React Context for state
│   │   ├── AuthContext.jsx
│   │   ├── NotificationContext.jsx
│   │   └── DataContext.jsx
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useWebSocket.js
│   │   └── useFetch.js
│   │
│   ├── styles/                  # Global styles
│   │   ├── index.css
│   │   └── tailwind.css
│   │
│   ├── utils/                   # Utility functions
│   │   ├── formatters.js       # Date, currency formatting
│   │   ├── validators.js       # Form validation
│   │   └── helpers.js          # Common helpers
│   │
│   ├── App.jsx                 # Main app component
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles
│
├── public/                      # Static assets
│   ├── index.html
│   └── favicons/
│
├── package.json                # npm dependencies
├── vite.config.js              # Vite configuration
├── eslint.config.js            # ESLint rules
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
└── .env                        # Frontend environment variables
```

### 6.2 Key Dependencies (frontend/hospital/package.json)

```json
{
  "name": "hospital",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.1",
    "axios": "^1.13.6",
    "tailwindcss": "^4.2.1",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0",
    "@react-google-maps/api": "^2.20.8",
    "recharts": "^3.8.0",
    "gsap": "^3.14.2",
    "@capacitor/core": "^8.2.0",
    "@capacitor/cli": "^8.2.0",
    "@capacitor/android": "^8.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "vite": "^8.0.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react": "^7.0.1"
  }
}
```

### 6.3 API Service Layer (src/services/api.js)

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add JWT token to requests
api.interceptors.request.use(config => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => Promise.reject(error));

// Handle token refresh
api.interceptors.response.use(
    response => response,
    async error => {
        if (error.response?.status === 401) {
            const refresh_token = localStorage.getItem('refresh_token');
            if (refresh_token) {
                try {
                    const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
                        refresh: refresh_token
                    });
                    localStorage.setItem('access_token', response.data.access);
                    return api(error.config);
                } catch (err) {
                    localStorage.clear();
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
```

### 6.4 WebSocket Hook (src/hooks/useWebSocket.js)

```javascript
import { useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (onMessage) => {
    const ws = useRef(null);
    
    const connect = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;
        
        ws.current = new WebSocket(wsUrl);
        
        ws.current.onopen = () => {
            console.log('WebSocket connected');
        };
        
        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };
        
        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        ws.current.onclose = () => {
            // Reconnect after 3 seconds
            setTimeout(connect, 3000);
        };
    }, [onMessage]);
    
    useEffect(() => {
        connect();
        return () => ws.current?.close();
    }, [connect]);
    
    return ws;
};
```

### 6.5 Authentication Context (src/context/AuthContext.jsx)

```javascript
import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        // Check if user is logged in
        const token = localStorage.getItem('access_token');
        if (token) {
            api.get('/auth/current_user/')
                .then(res => setUser(res.data))
                .catch(() => localStorage.clear())
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);
    
    const login = async (email, password) => {
        const response = await api.post('/auth/login/', { email, password });
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        
        const userRes = await api.get('/auth/current_user/');
        setUser(userRes.data);
        return userRes.data;
    };
    
    const logout = () => {
        localStorage.clear();
        setUser(null);
    };
    
    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
```

### 6.6 Main App Component (src/App.jsx)

```javascript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import HospitalList from './pages/hospital/HospitalList';
import BedManagement from './pages/beds/BedList';
import EmergencyDispatch from './pages/calls/EmergencyDispatch';
import RealTimeTracking from './pages/ambulances/RealTimeTracking';

function ProtectedRoute({ element, requiredRole }) {
    const { user } = React.useContext(AuthContext);
    
    if (!user) return <Navigate to="/login" />;
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/unauthorized" />;
    }
    
    return element;
}

function App() {
    return (
        <AuthProvider>
            <NotificationProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route
                            path="/dashboard"
                            element={<ProtectedRoute element={<AdminDashboard />} />}
                        />
                        <Route
                            path="/hospitals"
                            element={<ProtectedRoute element={<HospitalList />} />}
                        />
                        <Route
                            path="/beds"
                            element={<ProtectedRoute element={<BedManagement />} />}
                        />
                        <Route
                            path="/emergency"
                            element={<ProtectedRoute
                                element={<EmergencyDispatch />}
                                requiredRole="reception"
                            />}
                        />
                        <Route
                            path="/tracking"
                            element={<ProtectedRoute
                                element={<RealTimeTracking />}
                                requiredRole="ambulance"
                            />}
                        />
                        <Route path="/" element={<Navigate to="/dashboard" />} />
                    </Routes>
                </BrowserRouter>
            </NotificationProvider>
        </AuthProvider>
    );
}

export default App;
```

### 6.7 Example Page: Emergency Dispatch (src/pages/calls/EmergencyDispatch.jsx)

```javascript
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import api from '../../services/api';

const EmergencyDispatch = () => {
    const [formData, setFormData] = useState({
        patient_id: '',
        pickup_latitude: 0,
        pickup_longitude: 0,
        dropoff_latitude: 0,
        dropoff_longitude: 0,
        reason: ''
    });
    const [loading, setLoading] = useState(false);
    const [map, setMap] = useState(null);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.post('/calls/', formData);
            alert('Emergency call created. Dispatching ambulance...');
            setFormData({
                patient_id: '',
                pickup_latitude: 0,
                pickup_longitude: 0,
                dropoff_latitude: 0,
                dropoff_longitude: 0,
                reason: ''
            });
        } catch (error) {
            alert('Error creating call: ' + error.response.data.detail);
        } finally {
            setLoading(false);
        }
    };
    
    const handleMapClick = (e) => {
        setFormData({
            ...formData,
            pickup_latitude: e.latlng.lat,
            pickup_longitude: e.latlng.lng
        });
    };
    
    return (
        <div className="flex gap-4 p-6">
            <div className="flex-1">
                <h1 className="text-3xl font-bold mb-4">Emergency Dispatch</h1>
                <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow">
                    <input
                        type="text"
                        placeholder="Patient ID"
                        value={formData.patient_id}
                        onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                        className="w-full border p-2 mb-3"
                    />
                    <textarea
                        placeholder="Reason for emergency"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        className="w-full border p-2 mb-3"
                    />
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                            type="number"
                            placeholder="Pickup Latitude"
                            value={formData.pickup_latitude}
                            onChange={(e) => setFormData({ ...formData, pickup_latitude: parseFloat(e.target.value) })}
                            className="border p-2"
                        />
                        <input
                            type="number"
                            placeholder="Pickup Longitude"
                            value={formData.pickup_longitude}
                            onChange={(e) => setFormData({ ...formData, pickup_longitude: parseFloat(e.target.value) })}
                            className="border p-2"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
                    >
                        {loading ? 'Dispatching...' : 'Dispatch Ambulance'}
                    </button>
                </form>
            </div>
            <div className="flex-1">
                <MapContainer
                    center={[28.704, 77.100]}
                    zoom={13}
                    style={{ height: '500px', width: '100%' }}
                    onClick={handleMapClick}
                    ref={setMap}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                    />
                    {formData.pickup_latitude && formData.pickup_longitude && (
                        <Marker position={[formData.pickup_latitude, formData.pickup_longitude]}>
                            <Popup>Pickup Location</Popup>
                        </Marker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default EmergencyDispatch;
```

---

## 7. API Specifications

### 7.1 Authentication Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login/` | User login with JWT | None |
| POST | `/api/auth/register/` | User registration | None |
| POST | `/api/auth/token/refresh/` | Refresh JWT token | None |
| GET | `/api/auth/current_user/` | Get logged-in user | JWT |
| POST | `/api/auth/change_password/` | Change password | JWT |
| POST | `/api/auth/logout/` | Logout / blacklist token | JWT |

### 7.2 Hospital Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/hospitals/` | List all hospitals | JWT |
| POST | `/api/hospitals/` | Create hospital | JWT (Admin) |
| GET | `/api/hospitals/{id}/` | Get hospital detail | JWT |
| PUT | `/api/hospitals/{id}/` | Update hospital | JWT (Admin/Supervisor) |
| DELETE | `/api/hospitals/{id}/` | Delete hospital | JWT (Admin) |
| GET | `/api/hospitals/{id}/departments/` | Get hospital departments | JWT |

### 7.3 Bed Management Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/beds/` | List beds | JWT |
| POST | `/api/beds/` | Create bed | JWT (Supervisor) |
| GET | `/api/beds/availability/` | Get available beds | JWT |
| GET | `/api/beds/{id}/occupancy/` | Get bed occupancy history | JWT |
| PUT | `/api/beds/{id}/assign/` | Assign patient to bed | JWT |
| PUT | `/api/beds/{id}/discharge/` | Discharge patient from bed | JWT |

### 7.4 Patient Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/patients/` | List patients | JWT |
| POST | `/api/patients/` | Create patient | JWT |
| GET | `/api/patients/{id}/` | Get patient details | JWT |
| PUT | `/api/patients/{id}/` | Update patient | JWT |
| POST | `/api/patients/{id}/assessments/` | Add assessment | JWT |
| GET | `/api/patients/{id}/assessments/` | Get patient assessments | JWT |

### 7.5 Ambulance Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/ambulances/` | List ambulances | JWT |
| POST | `/api/ambulances/` | Create ambulance | JWT (Admin) |
| GET | `/api/ambulances/{id}/track/` | Get ambulance real-time location | JWT |
| PUT | `/api/ambulances/{id}/location/` | Update ambulance GPS location | JWT (Driver) |
| PUT | `/api/ambulances/{id}/status/` | Update ambulance status | JWT (Driver) |

### 7.6 Emergency Calls Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/calls/` | List calls | JWT |
| POST | `/api/calls/` | Create emergency call | JWT (Reception) |
| GET | `/api/calls/{id}/` | Get call details | JWT |
| POST | `/api/calls/{id}/dispatch/` | Manually dispatch ambulance | JWT (Admin) |
| POST | `/api/calls/{id}/complete/` | Complete call | JWT (Driver) |
| GET | `/api/calls/{id}/timeline/` | Get call timeline | JWT |

### 7.7 Analytics Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/analytics/dashboard/` | Get dashboard metrics | JWT |
| GET | `/api/analytics/occupancy/` | Get bed occupancy trends | JWT |
| GET | `/api/analytics/calls/` | Get call statistics | JWT |
| GET | `/api/analytics/hospital/` | Get hospital performance | JWT |

### 7.8 Notification Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notifications/` | List user notifications | JWT |
| POST | `/api/notifications/{id}/read/` | Mark notification as read | JWT |
| DELETE | `/api/notifications/{id}/` | Delete notification | JWT |
| GET | `/ws/notifications/` | WebSocket connection | JWT (WS) |

---

## 8. Configuration Files

### 8.1 Environment Variables (.env)

```env
# Django
SECRET_KEY=django-insecure-your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# Database (PostgreSQL)
DB_NAME=healthcare_db
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
REDIS_CHANNELS_URL=redis://localhost:6379/2

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+16562554949

# Google APIs
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Webhooks
BASE_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app

# Email (Optional)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_email@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
```

### 8.2 Vite Configuration (frontend/hospital/vite.config.js)

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '/api')
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: false
    }
})
```

### 8.3 Tailwind Configuration (frontend/hospital/tailwind.config.js)

```javascript
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                primary: '#2563eb',
                success: '#059669',
                warning: '#d97706',
                error: '#dc2626'
            }
        }
    },
    plugins: []
}
```

---

## 9. Deployment Guide

### 9.1 Production Environment Setup

```bash
# 1. Install system dependencies
sudo apt-get update
sudo apt-get install -y python3.11 python3-pip postgresql redis-server nginx

# 2. Clone repository
git clone https://github.com/your-repo/healthcare.git
cd healthcare

# 3. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 4. Install Python dependencies
cd backend
pip install -r requirements.txt
pip install gunicorn daphne

# 5. Configure Django settings
cd ..
cp backend/.env.example backend/.env
# Edit .env with production settings

# 6. Create database
createdb -U postgres healthcare_db

# 7. Run migrations
cd backend
python manage.py migrate

# 8. Collect static files
python manage.py collectstatic --noinput

# 9. Create superuser
python manage.py createsuperuser
```

### 9.2 Systemd Service Files

**Django/Daphne Service** (`/etc/systemd/system/healthcare-daphne.service`)
```ini
[Unit]
Description=Healthcare Daphne Service
After=network.target

[Service]
Type=notify
User=www-data
WorkingDirectory=/var/www/healthcare/backend
ExecStart=/var/www/healthcare/venv/bin/daphne -b 0.0.0.0 -p 8000 config.asgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Celery Worker Service** (`/etc/systemd/system/healthcare-celery.service`)
```ini
[Unit]
Description=Healthcare Celery Worker
After=network.target

[Service]
Type=forking
User=www-data
WorkingDirectory=/var/www/healthcare/backend
ExecStart=/var/www/healthcare/venv/bin/celery -A config worker -l info --detach
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Beat Service** (`/etc/systemd/system/healthcare-beat.service`)
```ini
[Unit]
Description=Healthcare Celery Beat
After=network.target

[Service]
Type=forking
User=www-data
WorkingDirectory=/var/www/healthcare/backend
ExecStart=/var/www/healthcare/venv/bin/celery -A config beat -l info --detach
Restart=always

[Install]
WantedBy=multi-user.target
```

### 9.3 Nginx Configuration (`/etc/nginx/sites-available/healthcare`)

```nginx
upstream django {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    client_max_body_size 100M;
    
    # Static files
    location /static/ {
        alias /var/www/healthcare/backend/staticfiles/;
    }
    
    # Media files
    location /media/ {
        alias /var/www/healthcare/backend/media/;
    }
    
    # API & WebSocket
    location / {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket upgrade
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 10. Integration Points

### 10.1 Third-Party API Integrations

#### Google Gemini API (AI Dispatch)
- **Purpose**: Analyze emergency calls and suggest best ambulance
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
- **Prompt Template**:
  ```
  You are an emergency dispatch AI. Given:
  - Patient location (lat, lng)
  - Available ambulances with their locations
  - Hospital bed availability
  
  Suggest the best ambulance to dispatch and hospital to route to.
  Response format: JSON with ambulance_id, hospital_id, reason
  ```

#### Twilio SMS API
- **Purpose**: Send SMS notifications to ambulance drivers and users
- **Integration**:
  ```python
  from twilio.rest import Client
  
  client = Client(account_sid, auth_token)
  message = client.messages.create(
      body="Emergency dispatch: ...",
      from_="+16562554949",
      to=driver_phone
  )
  ```

#### Google Maps API
- **Purpose**: Interactive maps in frontend
- **Integration**: React Google Maps library for rendering maps, directions, etc.

#### Email Service (Optional SMTP)
- Purpose: Email notifications
- Integration: Django's built-in email backend

### 10.2 WebSocket Communication Flow

```
Client (React) ←→ Nginx (Reverse Proxy) ←→ Daphne (ASGI)
                                              ↓
                                        Django Channels
                                              ↓
                                        Redis Channel Layer
                                              ↓
                                        Other Clients
```

### 10.3 Data Flow Between Microservices

#### Async Task Processing
```
HTTP Request → Django View → Celery Task Queue → Celery Worker → Task Execution → Notification
```

#### Real-time Updates
```
Database Change → Django Signal → Redis Channels → WebSocket → Client UI Update
```

---

## 11. Summary & Quick Start

### For AI Agents Building This System:

1. **Set up backend**: Django + DRF with 11 apps following the structure
2. **Configure database**: PostgreSQL with custom User model and 4 role types
3. **Implement models**: Refer to Section 4.2 for complete schema
4. **Create API endpoints**: Use DRF viewsets with permissions and filtering
5. **Setup async tasks**: Celery for SMS, AI routing, scheduled checks
6. **Implement WebSockets**: Django Channels for real-time notifications
7. **Build frontend**: React with Vite, Tailwind CSS, Leaflet maps
8. **Configure services**: Twilio, Google Gemini integration
9. **Deploy**: Use Daphne + Gunicorn + Nginx + Postgres + Redis

---

**Document Version**: 1.0  
**Last Updated**: March 2026  
**Completeness**: 95% - Ready for implementation
