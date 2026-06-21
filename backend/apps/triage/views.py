# apps/triage/views.py
"""
Triage API Views
================
Endpoints:
  POST /api/triage/analyze/          — Original Groq analyzer (unchanged, backward compat)
  POST /api/triage/unified-analyze/  — NEW: Full AI pipeline (triage + profile + routing)
  POST /api/triage/create-emergency/ — NEW: Create + persist EmergencyCase, broadcast WS
  PATCH /api/triage/cases/<id>/outcome/ — NEW: Record actual outcome (learner loop)
  GET  /api/triage/cases/            — NEW: List emergency cases (dashboard use)
  GET  /api/triage/cases/flagged/    — NEW: List undertriaged cases for review
"""

import time
import logging

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .groq_analyzer import analyze_symptoms          # original — kept unchanged
from .unified_triage import unified_analyze           # new enhanced analyzer
from .needs_profiler import profile_care_needs        # needs profiler
from .explainer import generate_routing_explanation, enrich_severity_reasoning
from .models import EmergencyCase
from .serializers import EmergencyCaseSerializer, RecordOutcomeSerializer

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Original endpoint — kept exactly as-is for backward compatibility
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def symptom_analysis_view(request):
    """
    POST /api/triage/analyze/

    UNCHANGED — still calls the original groq_analyzer.analyze_symptoms().
    The TriagePage / SymptomAnalyzer component uses this and should not be affected.
    """
    symptoms = request.data.get('symptoms', '').strip()
    age      = request.data.get('age', None)
    gender   = request.data.get('gender', None)

    if not symptoms:
        return Response({'success': False, 'error': 'symptoms field is required'}, status=400)
    if len(symptoms) < 5:
        return Response(
            {'success': False, 'error': 'Please describe symptoms in more detail (at least 5 characters)'},
            status=400,
        )

    patient_age = None
    if age is not None:
        try:
            patient_age = int(age)
            if not (1 <= patient_age <= 120):
                patient_age = None
        except (ValueError, TypeError):
            patient_age = None

    try:
        result = analyze_symptoms(
            symptoms_text=symptoms,
            patient_age=patient_age,
            patient_gender=gender,
        )
        return Response({'success': True, 'result': result}, status=200)
    except ValueError as e:
        return Response({'success': False, 'error': str(e)}, status=422)
    except Exception:
        return Response(
            {'success': False, 'error': 'AI analysis temporarily unavailable. Please try again.'},
            status=500,
        )


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Unified AI analysis endpoint (triage + optional routing)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def unified_analysis_view(request):
    """
    POST /api/triage/unified-analyze/

    Full AI pipeline: free-text → triage → needs profile → optional routing.
    This is the endpoint the EmergencyPortal should use.

    Request body:
    {
        "symptoms": "my mom fell and is not responding properly...",
        "age": 72,                      // optional
        "gender": "female",             // optional
        "known_conditions": "diabetes", // optional
        "lat": 22.7196,                 // optional — enables routing
        "lng": 75.8577,                 // optional — enables routing
        "include_routing": true         // optional — if true + lat/lng, returns ranked hospitals
    }

    Response:
    {
        "success": true,
        "triage": {
            "p_level": "P1",
            "severity_label": "Critical",
            "doctor_category": "Neurology",
            "reasoning": "72F unresponsive after fall...",
            "red_flags": [...],
            ...
        },
        "needs_profile": {
            "required_bed_type": "icu",
            "required_services": ["IMG_CT", "IMG_MRI"],
            "time_sensitivity_minutes": 60,
            "profile_reasoning": "..."
        },
        "ranked_hospitals": [...],   // empty if lat/lng not provided
        "routing_explanation": "..."  // empty if no routing
    }
    """
    symptoms          = request.data.get('symptoms', '').strip()
    age               = request.data.get('age', None)
    gender            = request.data.get('gender', None)
    known_conditions  = request.data.get('known_conditions', None)
    lat               = request.data.get('lat', None)
    lng               = request.data.get('lng', None)
    include_routing   = request.data.get('include_routing', False)

    if not symptoms or len(symptoms) < 5:
        return Response(
            {'success': False, 'error': 'symptoms field is required (min 5 chars)'},
            status=400,
        )

    patient_age = None
    if age is not None:
        try:
            patient_age = int(age)
            if not (1 <= patient_age <= 120):
                patient_age = None
        except (ValueError, TypeError):
            patient_age = None

    # ── Step 1: AI Triage (Language Translator + Severity Scorer) ────────────
    triage_result = unified_analyze(
        symptoms_text=symptoms,
        patient_age=patient_age,
        patient_gender=gender,
        known_conditions=known_conditions,
    )

    # ── Step 2: Enrich severity reasoning for dispatcher readability ─────────
    triage_result["reasoning"] = enrich_severity_reasoning(
        ai_reasoning    = triage_result.get("reasoning", ""),
        p_level         = triage_result["p_level"],
        red_flags       = triage_result.get("red_flags", []),
        was_escalated   = triage_result.get("was_escalated", False),
        escalation_reason = triage_result.get("escalation_reason", ""),
        patient_age     = patient_age,
        patient_gender  = gender,
    )

    # ── Step 3: Care Needs Profile ────────────────────────────────────────────
    needs_profile = profile_care_needs(
        p_level             = triage_result["p_level"],
        doctor_category     = triage_result["doctor_category"],
        possible_conditions = triage_result.get("possible_conditions", []),
        red_flags           = triage_result.get("red_flags", []),
        patient_age         = patient_age,
        symptoms_text       = symptoms,
    )

    # ── Step 4: Hospital Routing (optional) ───────────────────────────────────
    ranked_hospitals    = []
    routing_explanation = ""

    if include_routing and lat is not None and lng is not None:
        try:
            from apps.hospitals.routing import rank_hospitals_for_case
            ranked_hospitals = rank_hospitals_for_case(
                lat=float(lat),
                lng=float(lng),
                needs_profile=needs_profile,
                severity=triage_result["p_level"],
                max_results=5,
            )
            # ── Step 5: Generate routing explanation ──────────────────────────
            if ranked_hospitals:
                patient_desc = ""
                if patient_age and gender:
                    patient_desc = f"{patient_age}yo {gender}"
                elif patient_age:
                    patient_desc = f"{patient_age}yo"

                routing_explanation = generate_routing_explanation(
                    patient_severity=triage_result["p_level"],
                    needs_profile=needs_profile,
                    ranked_hospitals=ranked_hospitals,
                    patient_description=patient_desc,
                )
        except Exception as exc:
            logger.error(f"[unified_analysis_view] Routing failed: {exc}")
            routing_explanation = "Hospital routing temporarily unavailable."

    return Response({
        "success":             True,
        "triage":              triage_result,
        "needs_profile":       needs_profile,
        "ranked_hospitals":    ranked_hospitals,
        "routing_explanation": routing_explanation,
    }, status=200)


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Create & persist emergency case (replaces create_emergency_case_view)
# ─────────────────────────────────────────────────────────────────────────────

def create_emergency_case_internal(data: dict) -> dict:
    """
    Internal logic for creating an emergency case, reusable by HTTP views and Webhooks.
    """
    patient_name      = data.get('patient_name', 'Unknown')
    symptoms_text     = data.get('symptoms_text', '').strip()
    age               = data.get('age', None)
    phone             = data.get('phone', '')
    gender            = data.get('gender', None)
    known_conditions  = data.get('known_conditions', None)
    location_lat      = data.get('location_lat', None)
    location_lng      = data.get('location_lng', None)

    if not symptoms_text or len(symptoms_text) < 5:
        return {'success': False, 'error': 'symptoms_text is required (min 5 chars)'}

    patient_age = None
    if age is not None:
        try:
            patient_age = int(age)
            if not (1 <= patient_age <= 120):
                patient_age = None
        except (ValueError, TypeError):
            patient_age = None

    # ── Generate unique case ID ───────────────────────────────────────────────
    case_id = f"EMG-{int(time.time())}"

    # ── Step 1: Unified AI Triage ─────────────────────────────────────────────
    triage_result = data.get('triage_result')
    if not triage_result:
        triage_result = unified_analyze(
            symptoms_text    = symptoms_text,
            patient_age      = patient_age,
            patient_gender   = gender,
            known_conditions = known_conditions,
        )

    # ── Step 2: Enrich severity reasoning ─────────────────────────────────────
    enriched_reasoning = enrich_severity_reasoning(
        ai_reasoning      = triage_result.get("reasoning", ""),
        p_level           = triage_result["p_level"],
        red_flags         = triage_result.get("red_flags", []),
        was_escalated     = triage_result.get("was_escalated", False),
        escalation_reason = triage_result.get("escalation_reason", ""),
        patient_age       = patient_age,
        patient_gender    = gender,
    )
    triage_result["reasoning"] = enriched_reasoning

    # ── Step 3: Care Needs Profile ────────────────────────────────────────────
    needs_profile = data.get('needs_profile')
    if not needs_profile:
        needs_profile = profile_care_needs(
            p_level             = triage_result["p_level"],
            doctor_category     = triage_result["doctor_category"],
            possible_conditions = triage_result.get("possible_conditions", []),
            red_flags           = triage_result.get("red_flags", []),
            patient_age         = patient_age,
            symptoms_text       = symptoms_text,
        )

    # ── Step 4: Hospital Routing ──────────────────────────────────────────────
    ranked_hospitals    = data.get('ranked_hospitals', [])
    routing_explanation = data.get('routing_explanation', "")
    top_hospital_id     = data.get('top_hospital_id')

    if not ranked_hospitals and location_lat is not None and location_lng is not None:
        try:
            from apps.hospitals.routing import rank_hospitals_for_case
            ranked_hospitals = rank_hospitals_for_case(
                lat=float(location_lat),
                lng=float(location_lng),
                needs_profile=needs_profile,
                severity=triage_result["p_level"],
                max_results=5,
            )
        except Exception as exc:
            logger.error(f"[create_emergency_case] Routing failed: {exc}")

        # ── Step 5: AI Routing Explanation ───────────────────────────────────
        if ranked_hospitals:
            if not top_hospital_id:
                top_hospital_id = ranked_hospitals[0].get("hospital_id")
            patient_desc = ""
            if patient_age and gender:
                patient_desc = f"{patient_age}yo {gender}, {patient_name}"
            elif patient_age:
                patient_desc = f"{patient_age}yo, {patient_name}"
            else:
                patient_desc = patient_name

            if not routing_explanation:
                try:
                    routing_explanation = generate_routing_explanation(
                        patient_severity=triage_result["p_level"],
                        needs_profile=needs_profile,
                        ranked_hospitals=ranked_hospitals,
                        patient_description=patient_desc,
                    )
                except Exception as exc:
                    logger.error(f"[create_emergency_case] Explainer failed: {exc}")
                    routing_explanation = (
                        f"Top hospital: {ranked_hospitals[0].get('name', 'Unknown')} "
                        f"({ranked_hospitals[0].get('distance_km', '?')}km, "
                        f"{ranked_hospitals[0].get('available_beds', 0)} beds)."
                    )
    elif ranked_hospitals and not top_hospital_id:
        top_hospital_id = ranked_hospitals[0].get("hospital_id")

    # ── Step 6: Persist to EmergencyCase ─────────────────────────────────────
    from apps.hospitals.models import Hospital
    top_hospital_obj = None
    if top_hospital_id:
        try:
            top_hospital_obj = Hospital.objects.get(id=top_hospital_id)
        except Hospital.DoesNotExist:
            pass

    case = EmergencyCase.objects.create(
        case_id              = case_id,
        patient_name         = patient_name,
        patient_age          = patient_age,
        patient_phone        = phone,
        patient_gender       = gender,
        patient_lat          = float(location_lat) if location_lat else None,
        patient_lng          = float(location_lng) if location_lng else None,
        raw_symptoms_text    = symptoms_text,
        known_conditions     = known_conditions,
        # AI triage outputs
        ai_p_level           = triage_result["p_level"],
        ai_severity_label    = triage_result.get("severity_label", ""),
        ai_doctor_category   = triage_result.get("doctor_category", ""),
        ai_confidence        = triage_result.get("confidence", "MEDIUM"),
        ai_reasoning         = triage_result.get("reasoning", ""),
        ai_red_flags         = triage_result.get("red_flags", []),
        ai_possible_conditions = triage_result.get("possible_conditions", []),
        ai_requires_ambulance  = triage_result.get("requires_ambulance", False),
        ai_requires_icu        = triage_result.get("requires_icu", False),
        ai_was_escalated       = triage_result.get("was_escalated", False),
        # Needs profile and routing
        needs_profile        = needs_profile,
        recommended_hospitals= ranked_hospitals,
        top_hospital         = top_hospital_obj,
        routing_explanation  = routing_explanation,
        status               = EmergencyCase.CaseStatus.INCOMING,
    )

    # ── Step 7: Broadcast via WebSocket ──────────────────────────────────────
    broadcast_payload = {
        "case_id":             case_id,
        "db_id":               str(case.id),
        "patient_name":        patient_name,
        "age":                 patient_age,
        "phone":               phone,
        "severity": {
            "p_level":         triage_result["p_level"],
            "label":           triage_result.get("severity_label", ""),
            "reasoning":       triage_result.get("reasoning", ""),
            "confidence":      triage_result.get("confidence", "MEDIUM"),
            "red_flags":       triage_result.get("red_flags", []),
            "was_escalated":   triage_result.get("was_escalated", False),
        },
        "doctor_category":     triage_result.get("doctor_category", ""),
        "needs_profile":       needs_profile,
        "recommended_hospital": ranked_hospitals,
        "routing_explanation": routing_explanation,
        "symptoms_text":       symptoms_text,
        "status":              "INCOMING",
    }

    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "triage_dashboard",
            {"type": "new_emergency", "data": broadcast_payload}
        )
    except Exception as ws_exc:
        logger.warning(f"[create_emergency_case] WebSocket broadcast failed: {ws_exc}")

    # ── Step 8: Auto-Dispatch ────────────────────────────────────────────────
    from apps.triage.dispatch import auto_dispatch_ambulance
    dispatch_result = auto_dispatch_ambulance(case)

    return {
        "success":             True,
        "case_id":             case_id,
        "db_id":               str(case.id),
        "triage":              triage_result,
        "needs_profile":       needs_profile,
        "ranked_hospitals":    ranked_hospitals,
        "routing_explanation": routing_explanation,
        "dispatch":            dispatch_result,
        "status":              "CASE_CREATED",
    }

@api_view(['POST'])
@permission_classes([AllowAny])
def create_emergency_case_view(request):
    """
    POST /api/triage/create-emergency/
    """
    data = request.data
    result = create_emergency_case_internal(data)
    if not result.get('success'):
        return Response(result, status=400)
    
    return Response(result, status=201)


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Record case outcome (Learner loop)
# ─────────────────────────────────────────────────────────────────────────────

class CaseOutcomeView(APIView):
    """
    PATCH /api/triage/cases/<case_id>/outcome/

    Dispatcher or clinician records the actual triage level after patient evaluation.
    This is the core of the learner feedback loop.
    The model's save() method automatically computes was_undertriaged / was_overtriaged.
    """
    permission_classes = [AllowAny]  # Change to IsAuthenticated in production

    def patch(self, request, case_id):
        try:
            case = EmergencyCase.objects.get(case_id=case_id)
        except EmergencyCase.DoesNotExist:
            return Response({'error': f'Case {case_id} not found'}, status=404)

        serializer = RecordOutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        case.actual_p_level = data['actual_p_level']
        case.outcome_notes  = data.get('outcome_notes', '')
        case.status         = data.get('status', EmergencyCase.CaseStatus.RESOLVED)
        case.resolved_at    = timezone.now()
        case.save()  # triggers undertriage/overtriage computation

        # Flag for review if undertriaged
        if case.was_undertriaged:
            case.status = EmergencyCase.CaseStatus.FLAGGED_FOR_REVIEW
            case.save(update_fields=['status'])
            logger.warning(
                f"[outcome] UNDER-TRIAGE DETECTED: {case.case_id} — "
                f"AI scored {case.ai_p_level}, actual was {case.actual_p_level}"
            )

        return Response({
            "success":         True,
            "case_id":         case.case_id,
            "ai_p_level":      case.ai_p_level,
            "actual_p_level":  case.actual_p_level,
            "was_undertriaged": case.was_undertriaged,
            "was_overtriaged":  case.was_overtriaged,
            "status":          case.status,
            "message": (
                "⚠️ Under-triage detected — case flagged for model review."
                if case.was_undertriaged else
                "Outcome recorded successfully."
            ),
        })


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Case list and flagged case views (for dashboard and supervisor review)
# ─────────────────────────────────────────────────────────────────────────────

class EmergencyCaseListView(APIView):
    """
    GET /api/triage/cases/?status=INCOMING&p_level=P1&limit=50

    Returns paginated list of emergency cases for the dashboard.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        qs = EmergencyCase.objects.all()

        status_filter  = request.query_params.get('status', '')
        p_level_filter = request.query_params.get('p_level', '')
        limit          = int(request.query_params.get('limit', 50))

        if status_filter:
            qs = qs.filter(status=status_filter)
        if p_level_filter:
            qs = qs.filter(ai_p_level=p_level_filter)

        qs = qs.order_by('-created_at')[:min(limit, 200)]
        return Response(EmergencyCaseSerializer(qs, many=True).data)


class EmergencyCaseDetailView(APIView):
    """
    GET /api/triage/cases/<case_id>/
    Returns a single EmergencyCase by its case_id string (e.g. EMG-1716450000).
    Used by the PatientTrackingPage to load live case status.
    """
    permission_classes = [AllowAny]

    def get(self, request, case_id):
        try:
            case = EmergencyCase.objects.get(case_id=case_id)
        except EmergencyCase.DoesNotExist:
            return Response({'error': 'Case not found'}, status=404)
        return Response(EmergencyCaseSerializer(case).data)

# ─────────────────────────────────────────────────────────────────────────────
#  NEW: Driver Event REST fallback
# ─────────────────────────────────────────────────────────────────────────────

class DriverEventView(APIView):
    """
    POST /api/triage/cases/<case_id>/driver-event/
    
    Accepts: { "event": "driver_arrived" | "patient_picked_up" }
    Broadcasts the event to the patient's WebSocket group.
    """
    permission_classes = [AllowAny]

    def post(self, request, case_id):
        event_type = request.data.get("event")
        if event_type not in ["driver_arrived", "patient_picked_up"]:
            return Response({"error": "Invalid event type"}, status=400)

        # In a real system, you might verify the driver here.
        # For now, we trust the event and broadcast.
        
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            import logging
            logger = logging.getLogger(__name__)
            
            channel_layer = get_channel_layer()
            patient_group = f'patient_{case_id.replace("-", "_")}'
            
            message_text = "Your ambulance is outside!" if event_type == "driver_arrived" else "Heading to hospital"
            
            async_to_sync(channel_layer.group_send)(
                patient_group,
                {
                    "type": event_type,
                    "message": message_text
                }
            )
            
            # Optional: if patient_picked_up, update the AmbulanceRequest status in DB.
            if event_type == "patient_picked_up":
                try:
                    case = EmergencyCase.objects.get(case_id=case_id)
                    # We would look up the AmbulanceRequest via the case, but since we didn't 
                    # link them via DB foreign key directly in dispatch, we can just skip it
                    # or find it by requester_name.
                    pass
                except EmergencyCase.DoesNotExist:
                    pass
                
            return Response({"success": True, "event": event_type})
        except Exception as e:
            logger.error(f"Failed to broadcast driver event: {str(e)}")
            return Response({"error": "Broadcast failed"}, status=500)

class FlaggedCaseListView(APIView):
    """
    GET /api/triage/cases/flagged/

    Returns all cases where AI under-triaged. Used by supervisors and
    medical directors to review AI errors for future model improvement.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        qs = EmergencyCase.objects.filter(
            status=EmergencyCase.CaseStatus.FLAGGED_FOR_REVIEW
        ).order_by('-created_at')[:100]
        return Response({
            "count":  qs.count(),
            "cases":  EmergencyCaseSerializer(qs, many=True).data,
            "message": (
                "These cases were AI-scored at a lower severity than the actual clinical assessment. "
                "They should be reviewed to identify patterns for model improvement."
            ),
        })
