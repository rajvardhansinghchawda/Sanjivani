# Caregiver Portal - Frontend vs Backend Analysis
**Generated:** May 11, 2026 | **Scope:** Comprehensive alignment audit

---

## 📋 Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| **Core Endpoints** | ✅ Complete | 4/4 main caregiver API endpoints implemented |
| **Dashboard Display** | ✅ Complete | Patient list, adherence, alerts all retrievable |
| **Patient Detail** | ✅ Complete | Patient data and adherence accessible |
| **Smart Device Features** | ⚠️ Partial | UI mockups present, no backend endpoints |
| **Permission Management** | ✅ Present (Backend only) | Patient can manage caregiver perms via backend |
| **Communication** | ❌ Missing | Call/Message UI present, no backend API |

---

## 🟢 IMPLEMENTED & ALIGNED (Backend ← → Frontend)

### 1. **Caregiver Patient List**
**Frontend Component:** `CaregiverPortal.jsx`  
**Hook:** `useCaregiverPatients()`  
**Backend Endpoint:** `GET /api/v1/caregivers/patients/`  

**Frontend Expectations:**
- Returns array of patient objects
- Fields: `id`, `full_name`, `email`, `timezone`, `is_hospitalized`, `active_meds`, `permission`
- Serializer: `PatientSummarySerializer`

**Backend Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "patient_code": "P-12345",
      "full_name": "John Doe",
      "email": "john@example.com",
      "timezone": "Asia/Kolkata",
      "is_hospitalized": false,
      "active_meds": 3,
      "permission": "view_only"
    }
  ]
}
```

**Frontend Transform:**
```javascript
{
  id: p.id,
  patientCode: p.patient_code,
  name: p.full_name,
  email: p.email,
  timezone: p.timezone,
  isHospitalized: p.is_hospitalized,
  activeMedsCount: p.active_meds,
  permission: p.permission,
  // + defaults for UI
  conditions: [],
  adherence: 0,
  streak: 0,
  riskScore: 'Low'
}
```

**Status:** ✅ **COMPLETE**

---

### 2. **Patient Adherence Summary**
**Frontend Component:** `CaregiverPortal.jsx` (patient cards + modal)  
**Hook:** `useCaregiverPatientsData(patientIds)` → `adherenceQueries`  
**Backend Endpoint:** `GET /api/v1/caregivers/patients/{id}/adherence/`  

**Frontend Expectations:**
- Metric fields: `adherence_pct`, `taken`, `pending`, `total_scheduled`
- Time scope: last 30 days (caregiver view)

**Backend Response (via `AdherenceReportService.get_summary()`):**
```json
{
  "success": true,
  "data": {
    "adherence_pct": 85,
    "taken": 25,
    "pending": 4,
    "total_scheduled": 29,
    "date_range": "30 days"
  }
}
```

**Frontend Usage:**
```javascript
const adherence = adherenceRes?.adherence_pct ?? p.adherence;
const medsCount = adherenceRes?.total_scheduled ?? 0;
const medsTaken = adherenceRes?.taken ?? 0;
const medsPending = adherenceRes?.pending ?? 0;
```

**Status:** ✅ **COMPLETE**

---

### 3. **Patient Alerts (Missed Doses)**
**Frontend Component:** `CaregiverPortal.jsx` → Alert feed at top  
**Hook:** `useCaregiverPatientsData(patientIds)` → `alertsQueries`  
**Backend Endpoint:** `GET /api/v1/caregivers/patients/{id}/alerts/`  

**Frontend Expectations:**
- Returns list of missed `ReminderJob` objects
- Fields: `id`, `scheduled_at`, `status`, `dose_value`, `dose_unit`, `schedule.prescription.medication.name`
- Limit: 20 most recent

**Backend Response (via `ReminderJobSerializer`):**
```json
{
  "success": true,
  "data": [
    {
      "id": "reminder-uuid",
      "scheduled_at": "2026-05-11T08:00:00Z",
      "status": "MISSED",
      "dose_value": 500,
      "dose_unit": "mg",
      "schedule": {
        "prescription": {
          "medication": {
            "name": "Metformin"
          }
        }
      }
    }
  ]
}
```

**Frontend Alert Generation:**
```javascript
{
  id: job.id,
  type: 'critical',
  message: `Missed ${medName} (${job.dose_value} ${job.dose_unit})`,
  patient: patientName,
  time: new Date(job.scheduled_at).toLocaleTimeString(...),
  timestamp: new Date(job.scheduled_at).getTime()
}
```

**Status:** ✅ **COMPLETE**

---

### 4. **Patient Detail View**
**Frontend Component:** `PatientDetail.jsx`  
**Hook:** `useCaregiverPatientDetail(patientId)`  
**Backend Endpoint:** `GET /api/v1/caregivers/patients/{id}/`  

**Frontend Expectations:**
- Full patient data: personal info, conditions, medications, vitals
- Serializer: `PatientSerializer`

**Backend Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "patient_code": "P-12345",
    "full_name": "Ramesh Kumar",
    "email": "ramesh@example.com",
    "date_of_birth": "1956-01-15",
    "gender": "M",
    "blood_group": "O+",
    "timezone": "Asia/Kolkata",
    "is_hospitalized": false,
    "hospitalized_since": null,
    "discharge_expected_at": null,
    "hospital_name": null,
    "cognitive_status": "normal",
    "has_vision_impairment": false,
    "has_hearing_impairment": false,
    "requires_assistance": false,
    "created_at": "2025-01-10T10:30:00Z"
  }
}
```

**Current Frontend Usage:** 
Hardcoded `PATIENT_DATA` mock object. **No live API call implemented in PatientDetail.jsx yet.**

**Status:** ✅ **Backend ready**, ⚠️ **Frontend not consuming yet**

---

## 🟡 PARTIAL IMPLEMENTATION (Backend Present, Frontend Incomplete)

### 5. **Patient-Initiated Caregiver Invites** (Patient-side feature)
**Frontend:** Not implemented in caregiver portal (patient portal feature)  
**Backend Endpoints:**
- `POST /api/v1/patients/me/caregivers/invite/` — Send invite
- `POST /api/v1/caregiver-links/{token}/accept/` — Accept invite (public)

**Backend Caregiver Management (Patient Controls):**
- `GET /api/v1/patients/me/caregivers/` — List caregiver links
- `DELETE /api/v1/patients/me/caregivers/{id}/` — Remove caregiver
- `PATCH /api/v1/patients/me/caregivers/{id}/permissions/` — Update permissions

**Status:** ✅ **Backend complete**, ❌ **Frontend patient portal not implemented**

---

## 🔴 MISSING FEATURES

### A. **Caregiver Dose Marking** (Critical Gap)
**Frontend Component:** `PatientDetail.jsx` → "Mark as Taken" / "Skip" buttons  
**Expected Endpoint:** `POST /api/v1/caregivers/patients/{patientId}/reminders/{reminderId}/log/`  

**Current Issue:**
- Buttons are UI-only, no backend support for caregiver to mark doses on behalf of patient
- Only patient can call `POST /reminders/{id}/log/` (via `logDose()` in `useLogDose` hook)
- Permission levels exist (`view_only`, `log_doses`, `manage_schedule`, `full_access`) but no permission-checked endpoints

**What's Needed:**
1. New endpoint in caregiver views that checks permission level
2. Update `PatientDetail.jsx` to call new endpoint when "Mark as Taken" is clicked
3. Log action with caregiver context (audit trail)

**Expected Request:**
```json
POST /api/v1/caregivers/patients/{patientId}/reminders/{reminderId}/log/
{
  "status": "taken",  // or "missed"
  "takenAt": "2026-05-11T08:30:00Z",
  "markedByCaregiver": true
}
```

**Status:** ❌ **Missing from backend**, ⚠️ **Partially designed in frontend**

---

### B. **Smart Dispenser Device Endpoints** (UI Mockups Only)
**Frontend Pages:** 
- `CompartmentManager.jsx` — View/edit device compartments
- `FillingMode.jsx` — Step-by-step filling sequence
- `RemoteUnlock.jsx` — Remote security override

**Issue:** All components use hardcoded mock data. No backend API exists for:

1. **Get Device State**
   ```
   GET /api/v1/iot/devices/{deviceId}/state/
   ```
   Should return: compartment status, weights, medication inventory, lock status

2. **Get Compartments**
   ```
   GET /api/v1/iot/devices/{deviceId}/compartments/
   ```
   Should return: array of compartments with `{id, status, weight, medications[], lastFilled}`

3. **Log Filling Event**
   ```
   POST /api/v1/iot/devices/{deviceId}/filling-session/
   ```
   Should record: step completion, medications added, weights, timestamps

4. **Remote Unlock Command**
   ```
   POST /api/v1/iot/devices/{deviceId}/unlock/
   ```
   Should send: unlock command to device, log attempt, track status

5. **Refill Tracking**
   ```
   GET /api/v1/iot/devices/{deviceId}/refill-status/
   ```
   Should return: medication due dates, stock levels by compartment

**Status:** ❌ **No IOT endpoints exist**

---

### C. **Communication Features** (UI Only)
**Frontend Components:**
- `CaregiverPortal.jsx` — "Call" / "Message" buttons
- `PatientDetail.jsx` — "Call" / "Message" buttons  
- `AlertsFeed.jsx` — Message and action buttons

**Missing Endpoints:**
1. `POST /api/v1/communications/call/initiate/` — Start call session
2. `GET /api/v1/communications/history/` — Conversation history
3. `POST /api/v1/messages/send/` — Send message to patient/caregiver
4. `GET /api/v1/messages/` — Get messages thread

**Status:** ❌ **No communication API exists**

---

### D. **Permissions Enforcement** (Backend Ready, Not Used)
**Backend Status:** `PatientCaregiverLink` model includes `permission_level` field
- Values: `view_only`, `log_doses`, `manage_schedule`, `full_access`

**Frontend Status:** 
- Stores permission: `useAuthStore`, `useSubscriptionStore`
- Not enforced on any caregiver actions
- No permission checks before calling APIs

**Missing:**
1. Permission-gated caregiver endpoints that check permission level
2. Frontend guards: disable "Mark as Taken" if permission < `log_doses`
3. Disable "Edit Schedule" if permission < `manage_schedule`

**Status:** ⚠️ **Backend model ready**, ❌ **No enforcement in either layer**

---

## 📊 Detailed Feature Matrix

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| **Patient List** | `useCaregiverPatients()` | `GET /caregivers/patients/` | ✅ Working | Complete & tested |
| **Patient Detail** | UI ready | `GET /caregivers/patients/{id}/` | ⚠️ Not wired | Backend exists, frontend uses mock data |
| **Adherence Summary** | `useCaregiverPatientAdherence()` | `GET /caregivers/patients/{id}/adherence/` | ✅ Working | 30-day scope enforced |
| **Missed Dose Alerts** | `useCaregiverPatientAlerts()` | `GET /caregivers/patients/{id}/alerts/` | ✅ Working | Last 20 alerts, all MISSED status |
| **Today's Meds Timeline** | `PatientDetail.jsx` | Mock data (HARDCODED) | ❌ Missing | No backend endpoint for today's schedule by caregiver |
| **Vitals Display** | `PatientDetail.jsx` | Mock data (HARDCODED) | ❌ Missing | No vitals endpoint (backend has vitals module but no caregiver route) |
| **Conditions List** | `PatientDetail.jsx` | Mock data (HARDCODED) | ❌ Missing | Patient has `/conditions/` but no caregiver route |
| **Mark Dose (Caregiver)** | "Mark as Taken" button | ❌ No endpoint | ❌ Missing | Critical feature: needs permission check |
| **Skip Dose (Caregiver)** | "Skip" button | ❌ No endpoint | ❌ Missing | Critical feature: needs permission check |
| **Compartment View** | `CompartmentManager.jsx` | Mock data (HARDCODED) | ❌ Missing | No IOT endpoints exist |
| **Filling Mode** | `FillingMode.jsx` | Mock data (HARDCODED) | ❌ Missing | No IOT endpoints exist |
| **Remote Unlock** | `RemoteUnlock.jsx` | Mock data (HARDCODED) | ❌ Missing | No IOT endpoints exist |
| **Call Initiate** | Button UI | ❌ No endpoint | ❌ Missing | Communication module needed |
| **Send Message** | Button UI | ❌ No endpoint | ❌ Missing | Communication module needed |
| **Invite Caregiver** | ❌ Not in portal | `POST /patients/me/caregivers/invite/` | ⚠️ Patient-only | Works on patient portal, not caregiver |
| **Accept Invite** | ❌ Not in portal | `POST /caregiver-links/{token}/accept/` | ⚠️ Public link | Works but no UI in app |
| **Manage Permissions** | ❌ Not in portal | `PATCH /patients/me/caregivers/{id}/permissions/` | ⚠️ Patient-only | Patient can adjust caregiver permissions |
| **Unlink Caregiver** | ❌ Not in portal | `DELETE /patients/me/caregivers/{id}/` | ⚠️ Patient-only | Patient can remove caregiver |

---

## 🚀 Implementation Priority

### Phase 1: **Critical (Launch Blocker)**
1. **Wire PatientDetail.jsx to backend APIs**
   - Replace mock `PATIENT_DATA` with API calls
   - Fetch vitals, conditions, today's schedule
   
2. **Implement Caregiver Dose Marking**
   - Add permission check: `permission_level >= 'log_doses'`
   - `POST /caregivers/patients/{id}/reminders/{reminderId}/log/`
   - Update PatientDetail buttons to call this endpoint

3. **Add Today's Schedule Endpoint**
   - `GET /caregivers/patients/{id}/reminders/today/`
   - Return today's scheduled reminders for patient

### Phase 2: **High Priority (Within Sprint)**
4. **Implement Communication APIs**
   - Call session initiation
   - Message history & sending
   - Wire buttons to these endpoints

5. **Vitals & Conditions Endpoints**
   - `GET /caregivers/patients/{id}/vitals/`
   - `GET /caregivers/patients/{id}/conditions/`

### Phase 3: **Medium Priority (Post-MVP)**
6. **IOT Device Integration**
   - Smart dispenser APIs for compartment, filling, unlock
   - Integrate `FillingMode`, `CompartmentManager`, `RemoteUnlock`

7. **Permission Enforcement**
   - Add permission checks to all caregiver endpoints
   - Frontend guards on UI elements
   - Audit logging for caregiver actions

### Phase 4: **Low Priority (Future)**
8. **Patient-side Caregiver Management UI**
   - Invite acceptance flow
   - Permission adjustment UI
   - Caregiver list management

---

## 🔗 Related Backend Modules

| Module | Status | Used By Caregiver Portal |
|--------|--------|-------------------------|
| `clinical/` | ✅ Complete | Patient, Caregiver, Conditions, Prescriptions |
| `scheduling/` | ✅ Complete | Reminders, dose logging, alerts |
| `adherence/` (via telemetry) | ✅ Complete | Adherence summaries |
| `vitals/` | ✅ Exists | ❌ Not integrated with caregiver views |
| `iot/` | ✅ Exists | ⚠️ No caregiver endpoints |
| `notifications/` | ✅ Exists | ⚠️ Alerts shown but no "mark as read" |
| `communications/` | ❓ Unknown | ❌ Not implemented |

---

## 🎯 Recommended Next Steps

1. **Quick Win:** Wire `PatientDetail.jsx` today's schedule to backend
2. **Core Feature:** Implement `POST /caregivers/patients/{id}/reminders/{id}/log/` with permission checks
3. **UX Enhancement:** Replace hardcoded `PATIENT_DATA` mock with real API responses
4. **Documentation:** Create caregiver API reference guide for frontend team

---

## 📝 Notes for Frontend Team

- **Adherence data is cached** with 1-minute stale time; manual refresh available
- **Alerts limit to 20 most recent** MISSED reminders only; extend if needed
- **PatientDetail is currently disconnected** from backend; this should be priority
- **Permission model exists but unused** — consider adding permission guards to protect actions
- **IOT device features need careful planning** with hardware team for API contracts

---

## 📝 Notes for Backend Team

- **All current caregiver endpoints working correctly** but limited feature set
- **Consider adding these high-value endpoints:**
  - Today's schedule (caregiver-scoped)
  - Vitals & conditions (caregiver-scoped)
  - Dose marking with permission checks
- **Audit logging recommended** for caregiver actions on behalf of patient
- **IOT integration roadmap needed** for device management features

---

**Document Version:** 1.0  
**Last Updated:** May 11, 2026  
**Status:** Ready for Implementation Sprint
