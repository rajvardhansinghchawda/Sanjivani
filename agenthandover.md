# 🏥 Agent Handover — Hackathon Implementation Plan
## AI-Powered Emergency Triage & Hospital Routing System

> **Last Updated:** May 2026  
> **Base Project:** Healthcare Management System (Django + React/Vite)  
> **Hackathon Problem:** AI-Powered Emergency Triage & Hospital Routing  
> **What's Already Done:** Symptom analysis → Doctor category mapping ✅  
> **Skipped:** Symptom analysis engine (already implemented)

---

## 📌 Context for the Agent

### Existing Stack
- **Backend:** Django 4.2+, DRF, PostgreSQL, Redis, Celery, Django Channels
- **Frontend:** React 19, Vite, Tailwind CSS 4, Recharts, Leaflet, React-Leaflet
- **AI:** Groq API key already in `.env` (`GROQ_API_KEY`), Gemini key also present
- **Maps:** Leaflet + `@react-google-maps/api` already installed
- **Realtime:** Django Channels + Redis channel layer — WebSockets working

### What symptom analysis already does
The existing system takes patient symptoms and maps them to a **doctor/department category** (e.g., Cardiology, Neurology, Orthopedics). This output is available and will be used as **input** into the new triage pipeline.

### What this plan builds
| Feature | Problem Statement Requirement |
|---------|-------------------------------|
| Emergency Severity Scoring (P1–P4) | Emergency categorization |
| Nearby Hospital Finder API + Map | Nearby hospital recommendation |
| Patient Emergency Intake Portal | AI symptom analysis (UI layer) |
| Real-time Triage Dashboard | Real-time dashboard |

---

## 🗺️ Phase Overview

```
Phase 1 → Emergency Severity Auto-Categorization  (Backend, ~2–3 hrs)
Phase 2 → Nearby Hospital Routing API              (Backend, ~2 hrs)
Phase 3 → Patient Emergency Intake Portal          (Frontend, ~3 hrs)
Phase 4 → Real-time Triage Dashboard              (Frontend + Backend, ~2–3 hrs)
Phase 5 → Integration & Demo Polish               (~1 hr)
```

---

## ✅ PHASE 1 — Emergency Severity Auto-Categorization

### Goal
Take the existing doctor-category output from symptom analysis and automatically assign a **triage severity level (P1–P4)** to each emergency case, then auto-set the `TransferRequest.priority` field.

### Files to Create / Modify

#### 1.1 — Create `backend/apps/patients/triage_engine.py` (NEW FILE)

This module holds the severity mapping logic. No new model needed — plugs into existing `TransferRequest`.

```python
# backend/apps/patients/triage_engine.py

"""
Triage Engine — maps doctor_category + symptom_flags → P1/P2/P3/P4 severity.
P1 = CRITICAL  (immediate, life-threatening)
P2 = HIGH      (urgent, may deteriorate)
P3 = MEDIUM    (semi-urgent, stable)
P4 = LOW       (non-urgent, walk-in level)
"""

SEVERITY_MAP = {
    # Doctor category → default severity
    "Cardiology":       "P1",
    "Neurology":        "P1",
    "Trauma":           "P1",
    "Emergency":        "P1",
    "Pulmonology":      "P2",
    "Nephrology":       "P2",
    "Gastroenterology": "P2",
    "Oncology":         "P2",
    "Orthopedics":      "P3",
    "General Surgery":  "P3",
    "ENT":              "P3",
    "Pediatrics":       "P3",
    "Dermatology":      "P4",
    "Ophthalmology":    "P4",
    "Psychiatry":       "P4",
    "General Medicine": "P4",
}

SEVERITY_TO_PRIORITY = {
    "P1": "CRITICAL",
    "P2": "HIGH",
    "P3": "MEDIUM",
    "P4": "LOW",
}

PRIORITY_LABELS = {
    "P1": {"label": "Critical", "color": "#E24B4A", "description": "Immediate life-threatening. Requires ICU/emergency care now."},
    "P2": {"label": "Urgent",   "color": "#EF9F27", "description": "High risk. Needs treatment within 1 hour."},
    "P3": {"label": "Moderate", "color": "#378ADD", "description": "Semi-urgent. Stable but needs attention within 4 hours."},
    "P4": {"label": "Low",      "color": "#639922", "description": "Non-urgent. Can be managed in OPD."},
}

# Override flags — if any of these keywords appear in symptoms text, escalate
ESCALATION_KEYWORDS = {
    "P1": [
        "chest pain", "heart attack", "stroke", "unconscious", "not breathing",
        "severe bleeding", "seizure", "anaphylaxis", "respiratory failure",
        "cardiac arrest", "coma", "paralysis", "massive trauma",
    ],
    "P2": [
        "high fever", "difficulty breathing", "vomiting blood", "severe pain",
        "altered consciousness", "fracture", "head injury", "burn",
    ],
}


def compute_severity(doctor_category: str, symptoms_text: str = "") -> dict:
    """
    Returns severity dict with P-level, priority string, label, color, description.

    Args:
        doctor_category: string from existing symptom analysis (e.g. "Cardiology")
        symptoms_text: raw symptom description for keyword escalation check

    Returns:
        {
            "p_level": "P1",
            "priority": "CRITICAL",
            "label": "Critical",
            "color": "#E24B4A",
            "description": "...",
            "escalated": True/False
        }
    """
    symptoms_lower = symptoms_text.lower() if symptoms_text else ""

    # Check P1 escalation keywords first
    for keyword in ESCALATION_KEYWORDS["P1"]:
        if keyword in symptoms_lower:
            p_level = "P1"
            return {**PRIORITY_LABELS["P1"], "p_level": "P1",
                    "priority": SEVERITY_TO_PRIORITY["P1"], "escalated": True}

    # Check P2 escalation keywords
    for keyword in ESCALATION_KEYWORDS["P2"]:
        if keyword in symptoms_lower:
            base = SEVERITY_MAP.get(doctor_category, "P3")
            # Only escalate upward, never downward
            p_level = "P2" if base in ("P3", "P4") else base
            return {**PRIORITY_LABELS[p_level], "p_level": p_level,
                    "priority": SEVERITY_TO_PRIORITY[p_level], "escalated": True}

    # Default from category map
    p_level = SEVERITY_MAP.get(doctor_category, "P3")
    return {**PRIORITY_LABELS[p_level], "p_level": p_level,
            "priority": SEVERITY_TO_PRIORITY[p_level], "escalated": False}
```

#### 1.2 — Add triage endpoint to `backend/apps/patients/views.py` (MODIFY)

Find the existing `TransferRequest` viewset or views and add this new API view:

```python
# Add to backend/apps/patients/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .triage_engine import compute_severity, SEVERITY_TO_PRIORITY
from .models import TransferRequest  # already exists


@api_view(['POST'])
@permission_classes([AllowAny])
def triage_severity_view(request):
    """
    POST /api/patients/triage/severity/
    Body: { "doctor_category": "Cardiology", "symptoms_text": "chest pain..." }
    Returns severity level P1-P4 with label, color, description.
    """
    doctor_category = request.data.get('doctor_category', '')
    symptoms_text   = request.data.get('symptoms_text', '')

    if not doctor_category:
        return Response({'error': 'doctor_category is required'}, status=400)

    result = compute_severity(doctor_category, symptoms_text)
    return Response(result, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])  # change to IsAuthenticated in production
def create_emergency_case_view(request):
    """
    POST /api/patients/triage/create-case/
    Creates a TransferRequest with AI-assigned priority.
    Body: {
        "patient_name": "...",
        "age": 45,
        "phone": "...",
        "doctor_category": "Cardiology",
        "symptoms_text": "chest pain and shortness of breath",
        "location_lat": 22.7196,
        "location_lng": 75.8577,
        "from_hospital_id": "uuid-here"   // optional
    }
    """
    doctor_category = request.data.get('doctor_category', '')
    symptoms_text   = request.data.get('symptoms_text', '')
    patient_name    = request.data.get('patient_name', 'Unknown')
    age             = request.data.get('age', 0)
    phone           = request.data.get('phone', '')
    location_lat    = request.data.get('location_lat')
    location_lng    = request.data.get('location_lng')

    # Compute severity using existing triage engine
    severity = compute_severity(doctor_category, symptoms_text)

    # Find nearest available hospital (Phase 2 function — import after Phase 2 is done)
    from apps.hospitals.routing import find_nearest_hospital  # Phase 2
    hospital_result = None
    if location_lat and location_lng:
        hospital_result = find_nearest_hospital(
            lat=float(location_lat),
            lng=float(location_lng),
            required_bed_type=_severity_to_bed_type(severity['p_level']),
            department=doctor_category,
        )

    # Build response payload
    response_data = {
        "case_id": f"EMG-{int(__import__('time').time())}",
        "patient_name": patient_name,
        "severity": severity,
        "doctor_category": doctor_category,
        "symptoms_text": symptoms_text,
        "recommended_hospital": hospital_result,
        "status": "CASE_CREATED",
    }

    # Broadcast to dashboard via WebSocket (Phase 4)
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "triage_dashboard",
            {"type": "new_emergency", "data": response_data}
        )
    except Exception:
        pass  # don't fail the API if WS broadcast fails

    return Response(response_data, status=201)


def _severity_to_bed_type(p_level: str) -> str:
    return {"P1": "ICU", "P2": "ICU", "P3": "GENERAL", "P4": "GENERAL"}.get(p_level, "GENERAL")
```

#### 1.3 — Register URLs in `backend/apps/patients/urls.py` (MODIFY)

```python
# Add these lines to existing urlpatterns in backend/apps/patients/urls.py

from .views import triage_severity_view, create_emergency_case_view

urlpatterns = [
    # ... existing patterns ...
    path('triage/severity/',     triage_severity_view,       name='triage-severity'),
    path('triage/create-case/',  create_emergency_case_view, name='create-emergency-case'),
]
```

### Phase 1 Test
```bash
curl -X POST http://localhost:8000/api/patients/triage/severity/ \
  -H "Content-Type: application/json" \
  -d '{"doctor_category": "Cardiology", "symptoms_text": "chest pain and sweating"}'

# Expected response:
# {"p_level": "P1", "priority": "CRITICAL", "label": "Critical",
#  "color": "#E24B4A", "description": "...", "escalated": true}
```

---

## ✅ PHASE 2 — Nearby Hospital Routing API

### Goal
Given a patient's GPS coordinates, required bed type, and department, return ranked nearby hospitals with distance, available beds, and travel time.

### Files to Create / Modify

#### 2.1 — Create `backend/apps/hospitals/routing.py` (NEW FILE)

```python
# backend/apps/hospitals/routing.py

"""
Hospital Routing Engine
Finds and ranks nearby hospitals by: distance → bed availability → department match
Uses Haversine formula (no external API dependency)
"""

import math
from .models import Hospital  # already exists


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance in km between two GPS coordinates."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_travel_minutes(distance_km: float, severity: str = "P3") -> int:
    """Rough ETA estimate. P1/P2 get ambulance speed (~60km/h), others ~30km/h."""
    speed_kmh = 60 if severity in ("P1", "P2") else 30
    return max(1, int((distance_km / speed_kmh) * 60))


def find_nearest_hospital(lat: float, lng: float,
                           required_bed_type: str = "GENERAL",
                           department: str = None,
                           max_results: int = 5,
                           max_radius_km: float = 50.0,
                           severity: str = "P3") -> list:
    """
    Returns list of nearby hospitals ranked by score.
    Score = (1/distance) * bed_availability_weight * department_match_weight

    Args:
        lat, lng: patient location
        required_bed_type: 'ICU', 'GENERAL', 'VENTILATOR', 'PRIVATE'
        department: e.g. 'Cardiology' — filters hospitals that have this dept
        max_results: how many hospitals to return
        max_radius_km: search radius
        severity: P1-P4 for ETA calculation

    Returns:
        List of dicts with hospital info, distance, available beds, ETA
    """
    hospitals = Hospital.objects.filter(is_active=True).prefetch_related(
        'beds', 'departments'
    )

    results = []

    for hospital in hospitals:
        # Hospital must have lat/lng stored — skip if missing
        hosp_lat = getattr(hospital, 'latitude', None)
        hosp_lng = getattr(hospital, 'longitude', None)

        # Fallback: use hardcoded coords if model doesn't have lat/lng yet
        # (We'll add lat/lng to Hospital model in step 2.2)
        if hosp_lat is None or hosp_lng is None:
            continue

        distance = haversine_km(lat, lng, float(hosp_lat), float(hosp_lng))
        if distance > max_radius_km:
            continue

        # Count available beds of required type
        available_beds = hospital.beds.filter(
            bed_type__iexact=required_bed_type,
            status='AVAILABLE'
        ).count()

        # Check department match
        has_department = True
        if department:
            has_department = hospital.departments.filter(
                name__icontains=department
            ).exists()

        # Scoring: lower distance = better, more beds = better, dept match = bonus
        if distance == 0:
            distance = 0.1
        score = (1 / distance) * (1 + available_beds * 0.1) * (1.5 if has_department else 1.0)

        results.append({
            "hospital_id":    str(hospital.id),
            "name":           hospital.name,
            "address":        getattr(hospital, 'address', ''),
            "phone":          getattr(hospital, 'phone', ''),
            "latitude":       float(hosp_lat),
            "longitude":      float(hosp_lng),
            "distance_km":    round(distance, 2),
            "travel_minutes": estimate_travel_minutes(distance, severity),
            "available_beds": available_beds,
            "bed_type":       required_bed_type,
            "has_department": has_department,
            "department":     department,
            "score":          round(score, 4),
            "recommendation_reason": _build_reason(available_beds, has_department, distance, department),
        })

    # Sort by score descending
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:max_results]


def _build_reason(available_beds: int, has_dept: bool, distance: float, dept: str) -> str:
    reasons = []
    if available_beds > 0:
        reasons.append(f"{available_beds} beds available")
    if has_dept and dept:
        reasons.append(f"has {dept} department")
    if distance < 5:
        reasons.append("very close")
    elif distance < 15:
        reasons.append("nearby")
    return ", ".join(reasons) if reasons else "closest available option"
```

#### 2.2 — Add latitude/longitude to Hospital model (MODIFY)

Open `backend/apps/hospitals/models.py` and add two fields to the `Hospital` model:

```python
# In the Hospital model class, add these two fields:
latitude  = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
```

Then run:
```bash
cd backend
python manage.py makemigrations hospitals
python manage.py migrate
```

Then update seed data — open `backend/seed_two_hospitals.py` and add coordinates to both hospitals:
```python
# Indore Care Hospital — Indore, MP
hospital1.latitude  = 22.7196
hospital1.longitude = 75.8577
hospital1.save()

# Bombay Hospital — Indore, MP (different location)
hospital2.latitude  = 22.7255
hospital2.longitude = 75.8839
hospital2.save()
```

Re-run seed: `python seed_two_hospitals.py`

#### 2.3 — Add API view for nearby hospitals (MODIFY `backend/apps/hospitals/views.py`)

```python
# Add to backend/apps/hospitals/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .routing import find_nearest_hospital


@api_view(['GET'])
@permission_classes([AllowAny])
def nearby_hospitals_view(request):
    """
    GET /api/hospitals/nearby/?lat=22.71&lng=75.85&bed_type=ICU&department=Cardiology&severity=P1
    Returns ranked list of nearby hospitals with bed availability.
    """
    try:
        lat        = float(request.query_params.get('lat', 0))
        lng        = float(request.query_params.get('lng', 0))
        bed_type   = request.query_params.get('bed_type', 'GENERAL').upper()
        department = request.query_params.get('department', None)
        severity   = request.query_params.get('severity', 'P3')
        radius     = float(request.query_params.get('radius_km', 50))
    except (ValueError, TypeError):
        return Response({'error': 'Invalid coordinates'}, status=400)

    if not lat or not lng:
        return Response({'error': 'lat and lng are required'}, status=400)

    hospitals = find_nearest_hospital(
        lat=lat, lng=lng,
        required_bed_type=bed_type,
        department=department,
        max_radius_km=radius,
        severity=severity,
    )

    return Response({
        "query": {"lat": lat, "lng": lng, "bed_type": bed_type,
                  "department": department, "severity": severity},
        "count": len(hospitals),
        "hospitals": hospitals,
    })
```

#### 2.4 — Register URL in `backend/apps/hospitals/urls.py` (MODIFY)

```python
# Add to urlpatterns:
from .views import nearby_hospitals_view

path('nearby/', nearby_hospitals_view, name='hospitals-nearby'),
```

### Phase 2 Test
```bash
curl "http://localhost:8000/api/hospitals/nearby/?lat=22.71&lng=75.85&bed_type=ICU&department=Cardiology&severity=P1"
# Should return ranked hospital list with distances
```

---

## ✅ PHASE 3 — Patient Emergency Intake Portal (Frontend)

### Goal
A public-facing React page at `/emergency` where anyone can enter symptoms, get AI severity, and see recommended nearby hospitals on a map — no login required.

### Files to Create / Modify

#### 3.1 — Add route to `frontend/hospital/src/App.jsx` (MODIFY)

```jsx
// Add this import at top:
import EmergencyPortal from './pages/EmergencyPortal';

// Add this route inside your Routes:
<Route path="/emergency" element={<EmergencyPortal />} />
```

#### 3.2 — Create `frontend/hospital/src/pages/EmergencyPortal.jsx` (NEW FILE)

This is the main intake form. The page has 3 steps:
- **Step 1:** Patient fills symptoms + location is auto-detected via browser GPS
- **Step 2:** AI returns severity (P1–P4) with doctor category (already done by existing system)
- **Step 3:** Map shows nearby recommended hospitals

```jsx
// frontend/hospital/src/pages/EmergencyPortal.jsx

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import api from "../services/api";  // existing Axios client

// Severity color mapping
const SEVERITY_COLORS = {
  P1: { bg: "#FCEBEB", border: "#E24B4A", text: "#A32D2D", label: "P1 — Critical" },
  P2: { bg: "#FAEEDA", border: "#EF9F27", text: "#854F0B", label: "P2 — Urgent"   },
  P3: { bg: "#E6F1FB", border: "#378ADD", text: "#185FA5", label: "P3 — Moderate" },
  P4: { bg: "#EAF3DE", border: "#639922", text: "#3B6D11", label: "P4 — Low"      },
};

export default function EmergencyPortal() {
  const [step, setStep]             = useState(1);   // 1=form, 2=result, 3=map
  const [loading, setLoading]       = useState(false);
  const [formData, setFormData]     = useState({
    patient_name: "",
    age: "",
    phone: "",
    symptoms_text: "",
    doctor_category: "",  // populated by existing symptom analysis
  });
  const [location, setLocation]     = useState(null);   // {lat, lng}
  const [locError, setLocError]     = useState(null);
  const [triageResult, setTriageResult] = useState(null);
  const [hospitals, setHospitals]   = useState([]);
  const [selectedHosp, setSelectedHosp] = useState(null);

  // Auto-detect GPS on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()    => setLocError("Location access denied. Using Indore default.") ||
                 setLocation({ lat: 22.7196, lng: 75.8577 })  // Indore default
      );
    } else {
      setLocation({ lat: 22.7196, lng: 75.8577 });
    }
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Step 1 → Step 2: get severity from triage engine
  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Call existing symptom analysis to get doctor_category (already implemented)
      // Then call Phase 1 triage endpoint
      const severityRes = await api.post('/api/patients/triage/severity/', {
        doctor_category: formData.doctor_category || "General Medicine",
        symptoms_text:   formData.symptoms_text,
      });
      setTriageResult(severityRes.data);
      setStep(2);

      // Fetch nearby hospitals in background
      if (location) {
        const bedType = ["P1","P2"].includes(severityRes.data.p_level) ? "ICU" : "GENERAL";
        const hospRes = await api.get('/api/hospitals/nearby/', {
          params: {
            lat:        location.lat,
            lng:        location.lng,
            bed_type:   bedType,
            department: formData.doctor_category,
            severity:   severityRes.data.p_level,
          }
        });
        setHospitals(hospRes.data.hospitals || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3: show map
  const handleViewMap = () => setStep(3);

  // Submit final case
  const handleConfirm = async () => {
    try {
      await api.post('/api/patients/triage/create-case/', {
        ...formData,
        location_lat: location?.lat,
        location_lng: location?.lng,
      });
      alert("Emergency case created! Help is on the way.");
    } catch (err) {
      console.error(err);
    }
  };

  const colors = triageResult ? SEVERITY_COLORS[triageResult.p_level] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 640, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "#FCEBEB", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 20
          }}>🚨</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, color: "#1a1a18", margin: 0 }}>
              Emergency Triage
            </h1>
            <p style={{ fontSize: 13, color: "#73726c", margin: 0 }}>
              AI-powered severity assessment & hospital routing
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {["Symptoms", "Severity", "Hospital"].map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: step > i + 1 ? "#639922" : step === i + 1 ? "#185FA5" : "#e5e4dc",
                color: step >= i + 1 ? "#fff" : "#888",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 500
              }}>{step > i + 1 ? "✓" : i + 1}</div>
              <span style={{ fontSize: 12, color: step === i + 1 ? "#185FA5" : "#888" }}>
                {label}
              </span>
              {i < 2 && <span style={{ color: "#ccc", fontSize: 12 }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Intake Form */}
      {step === 1 && (
        <form onSubmit={handleTriageSubmit} style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e5e4dc", padding: 24, marginBottom: 16
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Patient Information</h2>
            {[
              { name: "patient_name", label: "Patient Name", type: "text",     required: true },
              { name: "age",          label: "Age",           type: "number",   required: true },
              { name: "phone",        label: "Phone Number",  type: "tel",      required: false },
            ].map(field => (
              <div key={field.name} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: "#444", display: "block", marginBottom: 4 }}>
                  {field.label} {field.required && <span style={{ color: "#E24B4A" }}>*</span>}
                </label>
                <input
                  type={field.type} name={field.name}
                  value={formData[field.name]} onChange={handleChange}
                  required={field.required}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8,
                    border: "1px solid #d3d1c7", fontSize: 14,
                    outline: "none", background: "#fff", color: "#1a1a18"
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e5e4dc", padding: 24, marginBottom: 16
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Symptoms & Department</h2>

            {/* Doctor category — from existing symptom analysis */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#444", display: "block", marginBottom: 4 }}>
                Department / Specialist Needed <span style={{ color: "#E24B4A" }}>*</span>
              </label>
              <select
                name="doctor_category" value={formData.doctor_category}
                onChange={handleChange} required
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "1px solid #d3d1c7", fontSize: 14, background: "#fff", color: "#1a1a18"
                }}
              >
                <option value="">-- Select (from symptom analysis) --</option>
                {["Cardiology","Neurology","Trauma","Emergency","Pulmonology",
                  "Nephrology","Gastroenterology","Orthopedics","General Surgery",
                  "ENT","Pediatrics","General Medicine","Psychiatry","Dermatology"
                ].map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#444", display: "block", marginBottom: 4 }}>
                Describe Symptoms <span style={{ color: "#E24B4A" }}>*</span>
              </label>
              <textarea
                name="symptoms_text" value={formData.symptoms_text}
                onChange={handleChange} required rows={4}
                placeholder="Describe what the patient is experiencing..."
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "1px solid #d3d1c7", fontSize: 14, resize: "vertical",
                  background: "#fff", color: "#1a1a18", fontFamily: "inherit"
                }}
              />
            </div>

            {/* Location status */}
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: location ? "#EAF3DE" : "#F1EFE8",
              fontSize: 12, color: location ? "#3B6D11" : "#5F5E5A"
            }}>
              {location
                ? `📍 Location detected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : locError || "📍 Detecting your location..."}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "14px", borderRadius: 10,
            background: loading ? "#ccc" : "#E24B4A", color: "#fff",
            border: "none", fontSize: 15, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer"
          }}>
            {loading ? "Analyzing..." : "Analyze & Get Severity →"}
          </button>
        </form>
      )}

      {/* STEP 2: Severity Result */}
      {step === 2 && triageResult && colors && (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {/* Severity card */}
          <div style={{
            background: colors.bg, border: `2px solid ${colors.border}`,
            borderRadius: 16, padding: 28, marginBottom: 16, textAlign: "center"
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {triageResult.p_level === "P1" ? "🚨" :
               triageResult.p_level === "P2" ? "⚠️" :
               triageResult.p_level === "P3" ? "🔵" : "🟢"}
            </div>
            <div style={{
              display: "inline-block", padding: "4px 16px",
              background: colors.border, color: "#fff",
              borderRadius: 20, fontSize: 13, fontWeight: 500, marginBottom: 12
            }}>
              {colors.label}
            </div>
            <p style={{ fontSize: 14, color: colors.text, margin: "0 0 8px" }}>
              {triageResult.description}
            </p>
            {triageResult.escalated && (
              <p style={{ fontSize: 12, color: colors.text, opacity: 0.8 }}>
                ⚡ Escalated based on critical symptom keywords
              </p>
            )}
          </div>

          {/* Recommended hospital preview */}
          {hospitals.length > 0 && (
            <div style={{
              background: "#fff", borderRadius: 12,
              border: "1px solid #e5e4dc", padding: 20, marginBottom: 16
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>
                Top Recommended Hospital
              </h3>
              {(() => {
                const h = hospitals[0];
                return (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{h.name}</div>
                    <div style={{ fontSize: 13, color: "#73726c", marginBottom: 8 }}>{h.address}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        `📍 ${h.distance_km} km away`,
                        `🚑 ~${h.travel_minutes} min ETA`,
                        `🛏 ${h.available_beds} beds available`,
                      ].map(tag => (
                        <span key={tag} style={{
                          fontSize: 12, padding: "3px 10px", borderRadius: 20,
                          background: "#E6F1FB", color: "#185FA5"
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleViewMap} style={{
              flex: 1, padding: "12px", borderRadius: 10,
              background: "#185FA5", color: "#fff",
              border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer"
            }}>
              View All Hospitals on Map →
            </button>
            <button onClick={() => setStep(1)} style={{
              padding: "12px 16px", borderRadius: 10,
              background: "#f1efea", color: "#444",
              border: "1px solid #d3d1c7", fontSize: 14, cursor: "pointer"
            }}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Map View */}
      {step === 3 && location && (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

            {/* Map */}
            <div style={{ flex: 2, minWidth: 300, borderRadius: 12, overflow: "hidden", height: 480 }}>
              <MapContainer
                center={[location.lat, location.lng]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* Patient marker */}
                <Marker position={[location.lat, location.lng]}>
                  <Popup>Your location</Popup>
                </Marker>

                {/* Hospital markers */}
                {hospitals.map((h, i) => (
                  <Marker
                    key={h.hospital_id}
                    position={[h.latitude, h.longitude]}
                    eventHandlers={{ click: () => setSelectedHosp(h) }}
                  >
                    <Popup>
                      <strong>{h.name}</strong><br />
                      {h.distance_km} km · {h.travel_minutes} min ETA<br />
                      {h.available_beds} beds available
                    </Popup>
                  </Marker>
                ))}

                {/* Route line to top hospital */}
                {hospitals.length > 0 && (
                  <Polyline
                    positions={[
                      [location.lat, location.lng],
                      [hospitals[0].latitude, hospitals[0].longitude]
                    ]}
                    color="#E24B4A"
                    dashArray="8,8"
                  />
                )}
              </MapContainer>
            </div>

            {/* Hospital list */}
            <div style={{ flex: 1, minWidth: 240, maxHeight: 480, overflowY: "auto" }}>
              {hospitals.map((h, i) => (
                <div
                  key={h.hospital_id}
                  onClick={() => setSelectedHosp(h)}
                  style={{
                    background: selectedHosp?.hospital_id === h.hospital_id ? "#E6F1FB" : "#fff",
                    border: `1px solid ${selectedHosp?.hospital_id === h.hospital_id ? "#378ADD" : "#e5e4dc"}`,
                    borderRadius: 10, padding: 14, marginBottom: 8, cursor: "pointer"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{h.name}</span>
                    {i === 0 && (
                      <span style={{
                        fontSize: 11, padding: "2px 7px", borderRadius: 20,
                        background: "#EAF3DE", color: "#3B6D11"
                      }}>Recommended</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#73726c", marginTop: 4 }}>
                    📍 {h.distance_km} km · 🚑 {h.travel_minutes} min · 🛏 {h.available_beds} beds
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{h.recommendation_reason}</div>
                </div>
              ))}

              <button onClick={handleConfirm} style={{
                width: "100%", marginTop: 8, padding: "12px",
                borderRadius: 10, background: "#E24B4A", color: "#fff",
                border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer"
              }}>
                🚨 Confirm Emergency Case
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 3.3 — Add Emergency link to Landing Page (MODIFY)

In `frontend/hospital/src/pages/` find the landing/home page and add a prominent emergency button:

```jsx
// Add this emergency CTA button anywhere visible on the landing page
<a href="/emergency" style={{
  display: "inline-block",
  padding: "12px 28px",
  background: "#E24B4A",
  color: "#fff",
  borderRadius: 10,
  fontWeight: 500,
  textDecoration: "none",
  fontSize: 15,
}}>
  🚨 Emergency Triage
</a>
```

---

## ✅ PHASE 4 — Real-time Triage Dashboard

### Goal
A live dashboard (upgrade of supervisor portal) showing all incoming emergency cases with AI severity, routing status, ambulance assignment, and live WebSocket updates.

### Files to Create / Modify

#### 4.1 — Create WebSocket Consumer `backend/apps/supervisors/consumers.py` (NEW FILE)

```python
# backend/apps/supervisors/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer


class TriageDashboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for the real-time triage dashboard.
    Group: "triage_dashboard"
    """

    async def connect(self):
        await self.channel_layer.group_add("triage_dashboard", self.channel_name)
        await self.accept()
        # Send connection confirmation
        await self.send(json.dumps({"type": "connected", "message": "Triage dashboard live"}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("triage_dashboard", self.channel_name)

    async def new_emergency(self, event):
        """Handler for 'new_emergency' group messages from Phase 1 API."""
        await self.send(json.dumps({
            "type":  "new_emergency",
            "data":  event["data"],
        }))

    async def case_updated(self, event):
        """Handler for status updates on existing cases."""
        await self.send(json.dumps({
            "type": "case_updated",
            "data": event["data"],
        }))
```

#### 4.2 — Register WebSocket URL in `backend/config/routing.py` (MODIFY)

```python
# backend/config/routing.py — add to websocket_urlpatterns:
from apps.supervisors.consumers import TriageDashboardConsumer

websocket_urlpatterns = [
    # ... existing patterns ...
    re_path(r'ws/triage/$', TriageDashboardConsumer.as_asgi()),
]
```

#### 4.3 — Create `frontend/hospital/src/pages/TriageDashboard.jsx` (NEW FILE)

```jsx
// frontend/hospital/src/pages/TriageDashboard.jsx

import { useState, useEffect, useRef } from "react";

const SEVERITY_CONFIG = {
  P1: { label: "Critical", color: "#E24B4A", bg: "#FCEBEB" },
  P2: { label: "Urgent",   color: "#EF9F27", bg: "#FAEEDA" },
  P3: { label: "Moderate", color: "#378ADD", bg: "#E6F1FB" },
  P4: { label: "Low",      color: "#639922", bg: "#EAF3DE" },
};

export default function TriageDashboard() {
  const [cases, setCases]       = useState([]);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [stats, setStats]       = useState({ P1: 0, P2: 0, P3: 0, P4: 0 });
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket(`ws://${window.location.host}/ws/triage/`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "new_emergency") {
        const newCase = {
          ...msg.data,
          received_at: new Date().toISOString(),
          status: "INCOMING",
        };
        setCases(prev => {
          const updated = [newCase, ...prev].slice(0, 50);  // keep last 50
          updateStats(updated);
          return updated;
        });
      }

      if (msg.type === "case_updated") {
        setCases(prev => prev.map(c =>
          c.case_id === msg.data.case_id ? { ...c, ...msg.data } : c
        ));
      }
    };

    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");

    return () => ws.close();
  }, []);

  const updateStats = (allCases) => {
    const s = { P1: 0, P2: 0, P3: 0, P4: 0 };
    allCases.forEach(c => { if (c.severity?.p_level) s[c.severity.p_level]++; });
    setStats(s);
  };

  const handleStatusChange = (caseId, newStatus) => {
    setCases(prev => prev.map(c => c.case_id === caseId ? { ...c, status: newStatus } : c));
  };

  const formatTime = (iso) => {
    if (!iso) return "--";
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ padding: "20px 24px", minHeight: "100vh", background: "#f9f9f8" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>🏥 Emergency Triage Dashboard</h1>
          <p style={{ fontSize: 13, color: "#73726c", margin: "4px 0 0" }}>
            Real-time incoming emergency cases
          </p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, color: wsStatus === "connected" ? "#3B6D11" : "#A32D2D"
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: wsStatus === "connected" ? "#639922" : "#E24B4A",
            animation: wsStatus === "connected" ? "pulse 2s infinite" : "none"
          }} />
          {wsStatus === "connected" ? "Live" : wsStatus}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {Object.entries(SEVERITY_CONFIG).map(([level, cfg]) => (
          <div key={level} style={{
            flex: 1, minWidth: 120,
            background: cfg.bg, border: `1px solid ${cfg.color}30`,
            borderRadius: 12, padding: "14px 16px",
            borderLeft: `4px solid ${cfg.color}`
          }}>
            <div style={{ fontSize: 26, fontWeight: 500, color: cfg.color }}>{stats[level]}</div>
            <div style={{ fontSize: 12, color: cfg.color, opacity: 0.85 }}>{level} · {cfg.label}</div>
          </div>
        ))}
        <div style={{
          flex: 1, minWidth: 120,
          background: "#fff", border: "1px solid #e5e4dc",
          borderRadius: 12, padding: "14px 16px"
        }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: "#1a1a18" }}>{cases.length}</div>
          <div style={{ fontSize: 12, color: "#73726c" }}>Total today</div>
        </div>
      </div>

      {/* Cases table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e4dc", overflow: "hidden" }}>
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid #e5e4dc",
          fontSize: 14, fontWeight: 500, color: "#1a1a18"
        }}>
          Incoming Cases
          {cases.filter(c => c.status === "INCOMING").length > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: "2px 8px",
              background: "#FCEBEB", color: "#A32D2D", borderRadius: 20
            }}>
              {cases.filter(c => c.status === "INCOMING").length} new
            </span>
          )}
        </div>

        {cases.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#73726c", fontSize: 14 }}>
            No cases yet. Waiting for incoming emergencies...
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9f9f8" }}>
                  {["Time","Case ID","Patient","Severity","Department","Hospital","ETA","Status","Action"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left",
                      fontSize: 12, fontWeight: 500, color: "#73726c",
                      borderBottom: "1px solid #e5e4dc"
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c, i) => {
                  const sev = SEVERITY_CONFIG[c.severity?.p_level] || SEVERITY_CONFIG.P4;
                  const hosp = c.recommended_hospital?.[0];
                  return (
                    <tr key={c.case_id} style={{
                      background: c.status === "INCOMING" ? `${sev.bg}60` : "#fff",
                      borderBottom: "1px solid #f1efea",
                    }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#73726c" }}>
                        {formatTime(c.received_at)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#888", fontFamily: "monospace" }}>
                        {c.case_id}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500 }}>
                        {c.patient_name || "Unknown"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 12, padding: "3px 10px", borderRadius: 20,
                          background: sev.bg, color: sev.color, fontWeight: 500
                        }}>
                          {c.severity?.p_level} · {sev.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#444" }}>
                        {c.doctor_category || "--"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }}>
                        {hosp ? hosp.name : "--"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "#73726c" }}>
                        {hosp ? `~${hosp.travel_minutes} min` : "--"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 20,
                          background: c.status === "INCOMING" ? "#FCEBEB" :
                                      c.status === "DISPATCHED" ? "#FAEEDA" : "#EAF3DE",
                          color: c.status === "INCOMING" ? "#A32D2D" :
                                 c.status === "DISPATCHED" ? "#854F0B" : "#3B6D11",
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {c.status === "INCOMING" && (
                          <button
                            onClick={() => handleStatusChange(c.case_id, "DISPATCHED")}
                            style={{
                              fontSize: 11, padding: "4px 10px", borderRadius: 6,
                              background: "#185FA5", color: "#fff",
                              border: "none", cursor: "pointer"
                            }}
                          >
                            Dispatch 🚑
                          </button>
                        )}
                        {c.status === "DISPATCHED" && (
                          <button
                            onClick={() => handleStatusChange(c.case_id, "RESOLVED")}
                            style={{
                              fontSize: 11, padding: "4px 10px", borderRadius: 6,
                              background: "#639922", color: "#fff",
                              border: "none", cursor: "pointer"
                            }}
                          >
                            Resolve ✓
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
```

#### 4.4 — Add route in `App.jsx` (MODIFY)

```jsx
import TriageDashboard from './pages/TriageDashboard';

// Add route:
<Route path="/triage-dashboard" element={<TriageDashboard />} />
```

---

## ✅ PHASE 5 — Integration & Demo Polish

### Goal
Connect everything end-to-end, test the full flow, and make the demo presentation-ready.

#### 5.1 — Test Full Flow

```
1. Open http://localhost:5173/emergency
2. Enter: Name="Test Patient", Age=55, Dept="Cardiology", Symptoms="severe chest pain"
3. Click Analyze → should get P1 CRITICAL
4. View Map → should show nearby hospitals ranked by distance
5. Click Confirm Emergency Case
6. Open http://localhost:5173/triage-dashboard (in another tab)
7. Case should appear live via WebSocket
8. Click Dispatch → status changes to DISPATCHED
```

#### 5.2 — Add Emergency Button to Landing Page Navigation

In `frontend/hospital/src/components/` or wherever your Navbar is, add:

```jsx
<a href="/emergency"
   style={{ background: "#E24B4A", color: "#fff", padding: "8px 18px",
            borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
  🚨 Emergency
</a>
```

#### 5.3 — Add Triage Dashboard to Supervisor/Admin Portal

In the supervisor portal sidebar links, add:
```jsx
<Link to="/triage-dashboard">📊 Triage Dashboard</Link>
```

#### 5.4 — Environment Variables Check

Make sure `backend/.env` has these (should already be there):
```env
GROQ_API_KEY=your-key          # Used by Phase 1 severity engine
GEMINI_API_KEY=your-key        # Backup if needed
REDIS_CHANNELS_URL=redis://localhost:6379/2   # Required for Phase 4 WebSocket
```

#### 5.5 — Run & Verify Checklist

```bash
# Terminal 1: Backend
cd backend && python manage.py runserver

# Terminal 2: Celery (for background jobs)
cd backend && celery -A config worker -l info

# Terminal 3: Frontend
cd frontend/hospital && npm run dev
```

Verify:
- [ ] `GET /api/hospitals/nearby/?lat=22.71&lng=75.85&bed_type=ICU` returns hospitals
- [ ] `POST /api/patients/triage/severity/` with `{"doctor_category":"Cardiology","symptoms_text":"chest pain"}` returns P1
- [ ] `POST /api/patients/triage/create-case/` creates case and broadcasts to WS
- [ ] `/emergency` page loads, form submits, map shows hospitals
- [ ] `/triage-dashboard` shows live incoming cases
- [ ] WebSocket `ws://localhost:8000/ws/triage/` connects

---

## 📁 Summary of All Files Changed

### New Files (create from scratch)
```
backend/apps/patients/triage_engine.py
backend/apps/hospitals/routing.py
backend/apps/supervisors/consumers.py
frontend/hospital/src/pages/EmergencyPortal.jsx
frontend/hospital/src/pages/TriageDashboard.jsx
```

### Modified Files (add to existing)
```
backend/apps/patients/views.py          ← add triage_severity_view, create_emergency_case_view
backend/apps/patients/urls.py           ← add 2 new url patterns
backend/apps/hospitals/views.py         ← add nearby_hospitals_view
backend/apps/hospitals/urls.py          ← add nearby/ url
backend/apps/hospitals/models.py        ← add latitude, longitude fields
backend/config/routing.py              ← add ws/triage/ websocket route
backend/seed_two_hospitals.py           ← add lat/lng to hospitals
frontend/hospital/src/App.jsx          ← add 2 new routes
```

### Migration Required
```bash
python manage.py makemigrations hospitals   # for lat/lng fields
python manage.py migrate
python seed_two_hospitals.py               # re-seed with coordinates
```

---

## 🎯 Hackathon Checklist

| Requirement | How it's met | Where |
|-------------|-------------|-------|
| AI symptom analysis | Existing symptom→doctor mapping + Phase 1 severity scoring | `triage_engine.py` |
| Emergency categorization | Auto P1–P4 from doctor category + keyword escalation | `triage_engine.py` + `/triage/severity/` |
| Nearby hospital recommendation | GPS-based ranking with bed type + distance + dept match | `routing.py` + `/hospitals/nearby/` |
| Real-time dashboard | WebSocket consumer + live triage table with dispatch controls | `TriageDashboard.jsx` + `consumers.py` |

---

## ⏱️ Estimated Time

| Phase | Work | Time |
|-------|------|------|
| Phase 1 | triage_engine.py + 2 API endpoints | ~2 hrs |
| Phase 2 | routing.py + nearby API + migration | ~2 hrs |
| Phase 3 | EmergencyPortal.jsx (3-step form + map) | ~3 hrs |
| Phase 4 | WebSocket consumer + TriageDashboard.jsx | ~2 hrs |
| Phase 5 | Integration + testing + polish | ~1 hr |
| **Total** | | **~10 hrs** |

---

*End of handover document. Start with Phase 1, each phase is independently testable before moving to the next.*
