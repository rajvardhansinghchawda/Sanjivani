# Healthcare Management System

This repository contains a hospital and emergency coordination platform built with a Django REST backend and a React/Vite frontend. The system covers hospital inventory, beds, patients, ambulance dispatch, supervisor workflows, analytics, real-time notifications, and a voice-based AI assistant called Aarohi.

The active application lives under `backend/` and `frontend/hospital/`. The repo also includes seed scripts, AI testing docs, and generated API references that are used to populate and validate the system.

## Table of Contents

- [Project Summary](#project-summary)
- [System Architecture](#system-architecture)
- [Backend Design](#backend-design)
- [Frontend Design](#frontend-design)
- [API Surface](#api-surface)
- [Data Model and Workflows](#data-model-and-workflows)
- [AI Assistant and Calls](#ai-assistant-and-calls)
- [Setup](#setup)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Seeding and Verification](#seeding-and-verification)
- [Testing and Quality Checks](#testing-and-quality-checks)
- [Deployment Notes](#deployment-notes)
- [Agent Guide](#agent-guide)
- [Troubleshooting](#troubleshooting)
- [Repository Notes](#repository-notes)

## Project Summary

The platform is a role-based healthcare operations system for real-world hospital coordination. It is designed to:

- manage hospitals, departments, doctors, services, and equipment;
- track beds, admissions, discharges, occupancy, and long-stay alerts;
- register and search patients, including transfer requests and history;
- manage ambulance fleets, driver workflows, live tracking, and bookings;
- expose supervisor dashboards for verification, correction, and monitoring tasks;
- provide analytics on occupancy, admissions, transfers, alerts, and performance;
- push real-time notifications over WebSockets and scheduled background jobs;
- support a Twilio-based voice flow and a Groq-powered AI assistant for hospital lookup and emergency guidance.

## System Architecture

The application is organized into four layers:

1. Client layer: React pages for role-specific portals, dashboards, and public pages.
2. API layer: Django REST Framework endpoints grouped by domain app.
3. Async and real-time layer: Celery, Celery Beat, Django Channels, Redis, and Twilio webhooks.
4. Data and integration layer: PostgreSQL plus external services such as Groq, Twilio, and optional Google Maps.

### Runtime Diagram

```text
Browser / Mobile App
    -> React Router pages in frontend/hospital
    -> Axios API client with JWT refresh handling
    -> Django REST API under /api/*
    -> Domain apps: auth, hospitals, beds, patients, ambulances, calls, supervisors, analytics, resources
    -> PostgreSQL
    -> Redis for cache, Celery broker, and Channels layer
    -> Celery workers and Celery Beat schedules
    -> Twilio voice/SMS webhooks
    -> Groq AI agent for call handling
```

## Backend Design

The backend is a Django project in `backend/` with these core modules:

- `config/`: global settings, ASGI/WSGI entry points, and top-level URL routing
- `core/`: reusable cross-cutting code such as permissions
- `apps/authentication/`: registration, login, logout, token refresh, profile, and user management
- `apps/hospitals/`: hospital CRUD, public search, departments, services, doctors, duty schedules
- `apps/beds/`: bed availability, allocation, admit/discharge, equipment tracking, long occupancy checks
- `apps/patients/`: patient profiles, history, search, and transfer requests
- `apps/ambulances/`: ambulance booking, driver dashboard, tracking, rating, and fleet management
- `apps/calls/`: Twilio call initiation, webhooks, transfer alerts, and the Aarohi voice assistant
- `apps/supervisors/`: alerts, corrections, verification review, and monitoring workflows
- `apps/analytics/`: platform and hospital dashboards, trends, and operational reports
- `apps/resources/`: resource-sharing and inventory-related API endpoints
- `apps/notifications/`: real-time notification plumbing and WebSocket integration

### Backend Stack

- Django 4.2+ with Django REST Framework
- JWT auth via SimpleJWT
- PostgreSQL for persistence
- Redis for cache, broker, and channel layer
- Celery for async tasks and periodic checks
- Django Channels for WebSocket updates
- CORS enabled for the frontend
- Twilio for voice and messaging flows
- Groq for the AI assistant

### Important Settings Behavior

The runtime configuration in `backend/config/settings.py` shows how the services are wired:

- JWT access tokens last 8 hours and refresh tokens last 7 days.
- Redis is split across separate URLs or DB indexes for cache, Celery, and Channels.
- Celery Beat schedules hourly and multi-hour supervisory checks.
- Channels uses ASGI, not only WSGI, so WebSocket traffic works in production.
- The backend permits localhost and several ngrok-style tunneling domains for development.
- The default DRF permission is permissive, but individual views are expected to enforce role checks where needed.

## Frontend Design

The active frontend is `frontend/hospital/`, built with React 19 and Vite.

### Frontend Stack

- React 19 with React Router 7
- Vite for development and production builds
- Axios for API access
- Tailwind CSS 4 and PostCSS for styling
- GSAP for motion
- Recharts for dashboards and analytics charts
- Leaflet and React-Leaflet for map views
- `@react-google-maps/api` for Google Maps integration where needed
- Capacitor for mobile packaging

### Frontend Routing

The main app routes in `frontend/hospital/src/App.jsx` are:

- `/` landing page
- `/about` public information page
- `/signin` login page
- `/signup` registration page
- `/dashboard` general dashboard
- `/admin-portal` admin portal
- `/platform-admin` platform admin portal
- `/patient-portal` patient portal
- `/reception-portal` reception portal
- `/reception/bed-map` bed map view
- `/reception/resources` resource management view
- `/driver-portal` ambulance driver portal
- `/supervisor-portal` supervisor portal
- `/unauthorized` access-denied page

### Frontend API Client

The API client in `frontend/hospital/src/services/api.js` uses Axios with token refresh support.

- It reads the base URL from `VITE_API_BASE_URL`.
- If the variable is missing, it falls back to the current Cloudflare tunnel URL used by the project.
- It stores access and refresh tokens in localStorage under both legacy and current key names.
- It skips Authorization headers for login, register, and token refresh endpoints.
- If a request returns 401, it attempts a refresh and retries the original request.

This behavior matters because many pages depend on a seamless authenticated session, especially for portal views and dashboards.

## API Surface

The backend routes are grouped by domain and mounted under `/api/`.

### Authentication

Mounted at `/api/auth/`:

- `POST /register/`
- `POST /login/`
- `POST /logout/`
- `POST /token/refresh/`
- `GET /profile/`
- `POST /change-password/`
- `GET /users/`
- `GET /users/<uuid>/`

### Hospitals

Mounted at `/api/hospitals/`:

- public search and detail endpoints
- hospital management routes under `manage/`
- department CRUD under each hospital
- service catalog and hospital service assignment routes
- doctor and duty schedule routes
- on-duty lookups for current staff coverage

### Beds

Mounted at `/api/beds/`:

- bed types and availability endpoints
- hospital bed CRUD and bulk updates
- admit and discharge endpoints
- bed allocation history
- long occupancy monitoring
- equipment availability and equipment CRUD

### Patients

Mounted at `/api/patients/`:

- profile and registration endpoints
- search and detail views
- admission history and hospital patient lists
- transfer creation, inbox/outbox, response, completion, and global transfer listing

### Ambulances

Mounted at `/api/ambulances/`:

- public availability, booking, tracking, and rating
- driver dashboard, availability, location, trip actions, and trip history
- fleet management for staff/admin
- request listing and reception-facing status updates

### Supervisor Tools

Mounted at `/api/supervisor/`:

- dashboard and alert summaries
- alert creation, review, resolution, and hospital-specific alert views
- long occupancy monitoring
- resource availability and latest hospital resource status
- pending verifications and manual check triggers
- correction endpoints for beds, patients, and allocations

### Analytics

Mounted at `/api/analytics/`:

- platform dashboard
- bed utilisation and occupancy trend reports
- admissions and transfer analysis
- hospital performance reports
- ambulance analytics
- service utilisation and alert analytics
- staff-specific hospital reports

### Calls

Mounted at `/api/calls/`:

- transfer call initiation
- user-agent request initiation
- Twilio webhooks for transfer and agent flows
- agent greeting, language selection, and speech processing webhooks
- call status webhooks

### Resources

Mounted at `/api/resources/`:

- resource sharing request routes provided through a DRF router

## Data Model and Workflows

The project is organized around a few core domain concepts.

### Core Entities

- User: custom auth model with role, hospital association, contact details, and access control context
- Hospital: location, status, verification, capacity, departments, services, doctors, and inventory
- Department: hospital-specific operational unit such as ICU, emergency, or specialty care
- Bed: status, ward, occupancy, patient assignment, and historical tracking
- Patient: demographics, medical history, admissions, and transfer records
- Ambulance: fleet metadata, driver assignment, location tracking, and availability
- Call / Transfer: emergency dispatch, transfer requests, acknowledgements, and completion tracking
- Resource / Equipment: inventory, quantities, availability, expiry, and sharing workflows
- Alert: supervisor and monitoring events such as long occupancy and verification issues

### Main Workflows

#### Registration and Login

Users authenticate through the auth app, receive JWT tokens, and are redirected to a role-specific portal. The frontend stores the user profile and session state locally so it can restore the active portal after refresh.

#### Bed and Admission Management

Reception and staff can inspect availability, admit patients, discharge patients, and review long-occupancy records. The supervisor app and scheduled jobs are used to surface exceptions and corrections.

#### Transfer Requests

Patients can be registered and then moved through transfer workflows. Transfer requests are visible in incoming, outgoing, and all-transfers views, with responses and completion tracked through dedicated endpoints.

#### Ambulance Dispatch

Ambulances can be booked, tracked, rated, and managed by staff or drivers. Driver flows include dashboard status, live location, and trip action updates.

#### Analytics and Monitoring

The analytics app exposes aggregate views for the platform, while the supervisor app focuses on operational exceptions and corrective actions.

## AI Assistant and Calls

The call system is one of the most specific parts of the codebase.

### Aarohi Voice Assistant

`backend/apps/calls/agent.py` implements Aarohi, the healthcare voice assistant.

- It uses Groq for conversational responses.
- It reads live hospital availability from the database.
- It supports English and Hindi, including Hinglish-style input handling.
- It keeps responses short, natural, and phone-call friendly.
- It avoids repeating itself, caps conversation history, and adds guardrails around follow-up phrasing.
- It can build spoken hospital summaries and SMS-friendly text payloads.

### Twilio Integration

`backend/apps/calls/services.py` handles Twilio voice calls and TwiML generation.

- Transfer notification calls alert hospitals about patient transfers.
- Transfer alert calls support acknowledge or reject style flows.
- User-agent calls route to the Aarohi voice assistant.
- Language selection happens first, then speech recognition is enabled for the selected language.
- Voice prompts use natural-sounding Google neural voices through Twilio.

### Why This Matters

This is not just a standard CRUD system. The calls app coordinates real-time voice workflows, external telephony, AI reasoning, and database-backed hospital lookup, which makes it a central integration point for the entire platform.

## Setup

### Prerequisites

- Python 3.9 or newer
- Node.js 18 or newer
- npm 9 or newer
- PostgreSQL 12 or newer
- Redis 6 or newer
- Git
- A Python virtual environment tool such as `venv`

### Backend Installation

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Installation

```bash
cd frontend/hospital
npm install
```

## Configuration

Create `backend/.env` with values that match your environment.

```env
SECRET_KEY=your-secret-key
DEBUG=True

DB_NAME=healthcare_db
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432

REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
REDIS_CHANNELS_URL=redis://localhost:6379/2

ALLOWED_HOSTS=localhost,127.0.0.1

TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

GROQ_API_KEY=your-groq-key
BASE_WEBHOOK_URL=https://your-tunnel.example

GEMINI_API_KEY=your-google-gemini-key
```

Create `frontend/hospital/.env` if you need to override the API endpoint:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Running Locally

### Backend

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Celery Worker

```bash
cd backend
celery -A config worker -l info
```

### Celery Beat

```bash
cd backend
celery -A config beat -l info
```

### Frontend

```bash
cd frontend/hospital
npm run dev
```

### Common Local URLs

- Django admin: `http://localhost:8000/admin/`
- API root: `http://localhost:8000/api/`
- Vite frontend: `http://localhost:5173/`

## Seeding and Verification

The repository includes several seed and verification utilities in `backend/`.

- `seed_two_hospitals.py`: populates the database with two hospitals and supporting demo data
- `verify_seed_data.py`: validates that the seed data exists and reports counts
- `QUICK_START_SEED.md`: fast operational commands
- `AI_ASSISTANT_SEED_DATA.md`: seed data inventory and credentials
- `AI_TESTING_SCENARIOS.md`: scripted AI call test scenarios

Typical flow:

```bash
cd backend
python seed_two_hospitals.py
python verify_seed_data.py
```

## Testing and Quality Checks

### Backend

```bash
cd backend
python manage.py test
python manage.py test apps.hospitals
python manage.py test apps.calls
```

### Frontend

```bash
cd frontend/hospital
npm run lint
npm run build
```

### What to Verify

- authentication and token refresh
- role-based portal access
- hospital and bed flows
- transfer request lifecycle
- ambulance booking and tracking
- supervisor alerts and corrections
- analytics endpoints
- WebSocket notifications
- Twilio webhook handling
- AI assistant routing and language selection

## Deployment Notes

The codebase is set up for a production stack that can include:

- Nginx as the reverse proxy
- Gunicorn for HTTP requests
- Daphne or another ASGI server for WebSockets
- PostgreSQL and Redis as managed services or containers
- environment-specific webhook URLs for Twilio and tunnel-based development

When deploying, keep the following in mind:

- the backend depends on PostgreSQL, Redis, Twilio, and Groq configuration;
- the frontend needs the correct API base URL at build time;
- ASGI must be enabled for Channels-based real-time features;
- Celery worker and Beat processes are required for background workflows.

## Agent Guide

This section is for automated agents or developers who need to understand the repo quickly.

### Read First

1. `WORKING_SPECIFICATION.md` for the intended architecture and requirements.
2. `backend/config/settings.py` for actual runtime wiring.
3. `backend/config/urls.py` for API namespace structure.
4. `frontend/hospital/src/App.jsx` for portal routing.
5. `frontend/hospital/src/services/api.js` for auth and request handling.
6. `backend/apps/calls/agent.py` for the AI assistant behavior.

### Domain Map

- Authentication and roles: `backend/apps/authentication/`
- Hospital management: `backend/apps/hospitals/`
- Beds and equipment: `backend/apps/beds/`
- Patients and transfers: `backend/apps/patients/`
- Ambulances and drivers: `backend/apps/ambulances/`
- AI voice and telephony: `backend/apps/calls/`
- Supervisor operations: `backend/apps/supervisors/`
- Platform analytics: `backend/apps/analytics/`
- Inventory sharing: `backend/apps/resources/`
- Real-time notifications: `backend/apps/notifications/`

### Frontend Map

- Pages and portals: `frontend/hospital/src/pages/`
- API wrappers: `frontend/hospital/src/services/`
- Shared UI pieces: `frontend/hospital/src/components/`
- Config files: `frontend/hospital/src/config/`

### Working Rules for Changes

- Preserve the role-based routing model.
- Keep API contracts compatible with the existing Axios client and token refresh flow.
- Do not remove Channels, Celery, or Twilio assumptions without updating dependent code.
- If you change endpoints, update both backend URLs and the frontend service layer.
- For AI-related changes, validate both English and Hindi behavior.

## Troubleshooting

### Backend Does Not Start

- Confirm `backend/.env` exists and all required variables are set.
- Confirm PostgreSQL and Redis are running.
- Confirm the virtual environment is activated.

### Frontend Cannot Log In

- Confirm `VITE_API_BASE_URL` points to the correct backend.
- Check that JWT token keys exist in localStorage.
- Verify the backend auth endpoints are reachable.

### WebSockets Do Not Update

- Confirm ASGI is being used.
- Confirm Redis channel layers are configured.
- Confirm the frontend is connected to the correct environment.

### Twilio or Voice Flows Fail

- Confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, and `BASE_WEBHOOK_URL` are correct.
- Confirm your public webhook URL is reachable from Twilio.
- Check the `backend/apps/calls/` webhooks for the failing path.

### AI Assistant Returns Poor Answers

- Confirm `GROQ_API_KEY` is valid.
- Check whether the hospital data exists in the database.
- Review the seeded data and the call assistant prompts.

## Repository Notes

- The generated API reference is in `complete_api_reference.html`.
- The project documentation index is in `README_DOCUMENTATION_INDEX.md`.
- The setup summary for the seeded AI assistant is in `SETUP_COMPLETE_SUMMARY.md`.
- The workspace includes a root-level `package.json`, but the active frontend application is `frontend/hospital`.