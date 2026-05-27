# Frontend ↔ Backend Integration Plan

## Overview

The project has a **React (Vite) frontend** and a **Django REST Framework backend** with ~26 app modules.

**Current State: ALL frontend pages use hardcoded mock data. Zero real API calls are wired up.**

The frontend has a well-designed `AgentBase` + Axios interceptor architecture ready for integration. The backend has comprehensive REST APIs already built. The task is to connect them.

---

## User Review Required

> [!IMPORTANT]
> **No changes have been made yet.** This document is a plan only. Please approve before any code is written.

> [!WARNING]
> The **base URL mismatch** is the #1 blocker. The frontend calls `/api/...` (no version prefix), but the backend serves all endpoints under `/api/v1/...`. A `.env` file fix and agent updates are needed.

---

## Part 1: Frontend Pages Inventory

| Page | Route | Role | Status |
|---|---|---|---|
| LandingPage | `/` | Public | Static, no API |
| DemoPage | `/demo` | Public | Static, no API |
| SmartDispenser | `/smart-dispenser` | Public | Static, no API |
| ConsultDoctors | `/consult-doctors` | Public | Static, no API |
| Login | `/login` | Auth | **MOCK** — uses setTimeout |
| RegisterPage | `/register` | Auth | **MOCK** — likely similar |
| PatientHome (Dashboard) | `/dashboard` | PATIENT | **MOCK** — hardcoded doses/stats |
| MedicineManagement | `/dashboard/medicines` | PATIENT | **MOCK** — hardcoded medicine list |
| Reports | `/dashboard/reports` | PATIENT | **MOCK** — likely hardcoded |
| Settings | `/dashboard/settings` | PATIENT | **MOCK** — likely hardcoded |
| DoctorPortal | `/doctor` | DOCTOR | **MOCK** — hardcoded patients |
| CaregiverPortal | `/caregiver` | CAREGIVER | **MOCK** — hardcoded patient data |

---

## Part 2: Backend API Inventory

| Module | Base Path | Key Endpoints |
|---|---|---|
| **Auth** | `/api/v1/auth/` | `login/`, `register/`, `logout/`, `refresh/`, `password/change/`, `mfa/setup/` |
| **Users** | `/api/v1/users/` | `me/`, `me/sessions/`, `me/notifications/` |
| **Patients** | `/api/v1/patients/` | `me/`, `me/conditions/`, `me/caregivers/`, `me/prescriptions/`, `me/prescriptions/{id}/schedules/` |
| **Medications** | `/api/v1/medications/` | list, create, detail, `interactions/check/` |
| **Caregivers** | `/api/v1/caregivers/` | `patients/`, `patients/{id}/adherence/`, `patients/{id}/alerts/` |
| **Reminders** | `/api/v1/reminders/` | `today/`, `upcoming/`, `{id}/log/`, `{id}/snooze/` |
| **Adherence** | `/api/v1/adherence/` | `summary/`, `timeline/`, `history/`, `export/` |
| **AI Engine** | `/api/v1/ai/` | `risk-score/{patient_id}/`, `insights/{patient_id}/`, `recommendations/{patient_id}/` |
| **IoT Devices** | `/api/v1/iot/` | `devices/`, `devices/{id}/status/`, `devices/{id}/events/`, `events/`, `heartbeat/` |
| **Notifications** | `/api/v1/notifications/` | list, `{id}/read/`, `read-all/` |
| **Vitals** | `/api/v1/vitals/` | `readings/`, `targets/` |
| **Gamification** | `/api/v1/gamification/` | `badges/`, `scores/`, `summary/` |
| **Doctor Portal** | `/api/v1/doctor/` | `profiles/`, `links/`, `prescriptions/` |
| **Subscriptions** | `/api/v1/subscriptions/` | `plans/`, `current/`, `upgrade/`, `invoices/` |

---

## Part 3: Gap Analysis

### ❌ Missing in Frontend (Backend has it, Frontend doesn't call it)

| Feature | Backend Endpoint | Frontend Gap |
|---|---|---|
| OTP Login | `POST /auth/login/otp/` | UI toggle exists but calls nothing |
| FCM Token Push | `POST /auth/fcm-token/` | Orchestrator has no FCM registration |
| MFA Setup/Verify | `POST /auth/mfa/setup/`, `mfa/verify/` | No MFA flow in UI at all |
| Password Reset | `POST /auth/password/reset/` | "Forgot Password?" link goes nowhere |
| Prescription Management | `GET/POST /patients/me/prescriptions/` | MedicineManagement adds to local state only |
| Prescription Schedules | `GET/POST /patients/me/prescriptions/{id}/schedules/` | Not wired |
| Caregiver Linking | `POST /patients/me/caregivers/invite/` | Settings page doesn't call this |
| Drug Interaction Check | `POST /medications/interactions/check/` | UI has no interaction warning |
| Today's Reminders | `GET /reminders/today/` | Dashboard uses hardcoded dose list |
| Dose Logging | `POST /reminders/{id}/log/` | "Mark Taken" button updates local state only |
| Adherence Summary | `GET /adherence/summary/` | Ring chart shows hardcoded 87% |
| Adherence Export | `GET /adherence/export/` | Reports page likely has no real download |
| AI Risk Score | `GET /ai/risk-score/{id}/` | No real AI data in dashboard |
| AI Insights | `GET /ai/insights/{id}/` | "Health Insights" section is static text |
| Vitals Logging | `POST /vitals/readings/` | No vitals input form |
| Gamification | `GET /gamification/summary/` | Streak is hardcoded as "12" |
| Notifications | `GET /notifications/` | No notification list/panel |
| IoT Device Linking | `POST /iot/devices/link/` | SmartDispenser page is fully static |
| Doctor Patient List | `GET /doctor/links/` | DoctorPortal uses hardcoded patients |
| Doctor Prescriptions | `GET /doctor/prescriptions/` | DoctorPortal uses hardcoded data |
| Caregiver Dashboard | `GET /caregivers/patients/` | CaregiverPortal uses hardcoded data |
| Subscription Plans | `GET /subscriptions/plans/` | Settings/subscription area likely static |

### ❌ Missing in Backend (Frontend expects it, Backend doesn't have it)

| Feature | Frontend Expects | Backend Gap |
|---|---|---|
| Today's Schedule endpoint | `GET /patients/me/adherence/today/` | Backend adherence URLs have `summary/`, `timeline/`, `history/` — **no `today/` endpoint** |
| Adherence Rate endpoint | `GET /patients/me/adherence/rate/` | No `rate/` endpoint found |
| Adherence Heatmap | `GET /patients/me/adherence/heatmap/` | No `heatmap/` endpoint found |
| Adherence Streak | `GET /patients/me/adherence/streak/` | No `streak/` endpoint found |
| Patient-scoped AI | `GET /patients/me/ai/risk-score/` | AI engine uses `/api/v1/ai/risk-score/{id}/` — needs patient-scoped shortcut |
| Patient-scoped adherence | `GET /patients/{id}/adherence/today/` | No per-patient adherence under `/patients/{id}/` |
| Auth login response shape | `{ access, user }` expected | Need to verify backend returns `user` object in login response |
| Google OAuth | Frontend has "Sign in with Google" button | No OAuth endpoint in backend auth URLs |

---

## Part 4: URL Prefix Mismatch

> [!CAUTION]
> **Critical Fix Required First**
> Frontend `axios.js`: `baseURL = 'http://localhost:8000/api'`
> Backend serves: `/api/v1/...`
> All agent files call: `/auth/login/`, `/patients/me/...` etc.
>
> **Result**: Every API call will 404 until the base URL is corrected to `/api/v1` OR the agents are updated.

---

## Part 5: Integration Phases (Proposed)

### Phase 1 — Foundation (No user-visible change)
1. Fix `VITE_API_URL` to point to `http://localhost:8000/api/v1` in `.env`
2. Create `frontend/.env` and `frontend/.env.example`
3. Verify backend login response shape matches `{ access, user }` frontend expectation

### Phase 2 — Authentication (Login/Register)
4. Wire `Login.jsx` → `authAgent.loginWithPassword()` (remove mock setTimeout)
5. Wire `RegisterPage.jsx` → `authAgent.register()`
6. Wire token refresh flow (already set up in `axios.js`, just needs real endpoint to work)
7. Wire logout button in sidebar → `authAgent.logout()`

### Phase 3 — Patient Dashboard
8. Create missing backend endpoints: `adherence/today/`, `adherence/rate/`, `adherence/streak/`, `adherence/heatmap/`
9. Wire `Home.jsx` → `useTodaySchedule()` hook (already defined)
10. Wire "Mark Taken" button → `useLogDose()` mutation (already defined)
11. Wire adherence ring → `useAdherenceRate()` hook (already defined)
12. Wire streak → `useStreak()` hook (already defined)

### Phase 4 — Medicine Management
13. Wire `MedicineManagement.jsx` → `GET /patients/me/prescriptions/`
14. Wire Add form → `POST /patients/me/prescriptions/`
15. Wire delete/pause → `PATCH/DELETE /patients/me/prescriptions/{id}/`

### Phase 5 — Doctor & Caregiver Portals
16. Wire `DoctorPortal.jsx` → `GET /api/v1/doctor/links/` (patient list)
17. Wire `CaregiverPortal.jsx` → `GET /api/v1/caregivers/patients/`
18. Wire caregiver adherence view → `GET /caregivers/patients/{id}/adherence/`

### Phase 6 — AI, Vitals, Gamification
19. Wire AI risk score and insights to dashboard
20. Wire vitals readings/targets
21. Wire gamification badges and streak

### Phase 7 — IoT & Notifications
22. Wire `SmartDispenser.jsx` → IoT device endpoints
23. Wire notification panel to `/api/v1/notifications/`

---

## Verification Plan

- After each phase, start both servers (`npm run dev` + `python manage.py runserver`) and test the wired flows
- Check browser Network tab for 200 responses (not 404s from URL mismatch)
- Confirm auth token is being sent in `Authorization: Bearer` header
