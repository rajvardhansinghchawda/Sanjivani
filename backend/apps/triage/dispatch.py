import math
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.triage.models import EmergencyCase
from apps.ambulances.models import Ambulance, AmbulanceRequest

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two points."""
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
        R = 6371
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = math.sin(dLat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    except (TypeError, ValueError):
        return 999999

def auto_dispatch_ambulance(case: EmergencyCase) -> dict:
    """
    Finds nearest available ambulance, creates a request, and pushes it via WebSocket.
    """
    if not case.patient_lat or not case.patient_lng:
        return {"success": False, "error": "No patient location for dispatch"}
    
    # 1. Find nearest available ambulance (Hardcoded to driver1 for testing)
    ambulances = Ambulance.objects.filter(status=Ambulance.Status.AVAILABLE, is_active=True)
    if not ambulances.exists():
        return {"success": False, "error": "No available ambulances"}

    best_ambulance = ambulances.filter(driver__email="driver1@indorecarehospital.com").first()
    min_dist = 5

    if not best_ambulance:
        min_dist = float('inf')
        for amb in ambulances:
            if amb.latitude and amb.longitude:
                dist = haversine(case.patient_lat, case.patient_lng, amb.latitude, amb.longitude)
                if dist < min_dist:
                    min_dist = dist
                    best_ambulance = amb
        
        # Fallback to any available if none have GPS
        if not best_ambulance:
            best_ambulance = ambulances.first()
            min_dist = 0

    eta_minutes = max(1, int(min_dist / 0.5)) if min_dist != 999999 else 15

    # 2. Create AmbulanceRequest
    request = AmbulanceRequest.objects.create(
        ambulance=best_ambulance,
        patient=None, # Nullable now
        destination_hospital=case.top_hospital,
        pickup_address=case.raw_symptoms_text[:100], # Provide some context
        pickup_latitude=case.patient_lat,
        pickup_longitude=case.patient_lng,
        pickup_city="Auto Dispatched", # Can be improved if city is known
        status=AmbulanceRequest.Status.PENDING, # Pending driver acceptance
        requester_name=case.patient_name or "Emergency Patient",
        requester_phone=case.patient_phone or "Unknown"
        # accepted_at will be set upon acceptance
    )

    # 4. Push to driver via WebSocket
    channel_layer = get_channel_layer()
    group_name = f'ambulance_{str(best_ambulance.id).replace("-", "_")}'

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "dispatch_pending",
            "case_id": str(case.case_id),
            "request_id": str(request.id),
            "severity": case.ai_p_level,
            "patient_name": request.requester_name,
            "patient_phone": request.requester_phone,
            "patient_lat": float(case.patient_lat),
            "patient_lng": float(case.patient_lng),
            "hospital_name": case.top_hospital.name if case.top_hospital else "Nearest Hospital",
            "hospital_lat": float(case.top_hospital.latitude) if case.top_hospital and case.top_hospital.latitude else None,
            "hospital_lng": float(case.top_hospital.longitude) if case.top_hospital and case.top_hospital.longitude else None,
            "routing_explanation": case.routing_explanation,
            "eta_to_patient_minutes": eta_minutes
        }
    )

    return {
        "success": True,
        "ambulance_id": str(best_ambulance.id),
        "driver_name": best_ambulance.driver_name,
        "vehicle_number": best_ambulance.vehicle_number,
        "eta_minutes": eta_minutes,
        "request_id": str(request.id)
    }
