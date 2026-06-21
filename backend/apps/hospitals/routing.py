# backend/apps/hospitals/routing.py
"""
Hospital Routing Engine — Composite Capability Matcher
=======================================================
Role 4 — Capability Matcher

This replaces the original simple scoring formula with a composite scorer
that uses the care needs profile as input.

Original formula: score = (1/distance) * (1 + beds * 0.1) * (1.5 if dept else 1.0)
  Problem: ignores service availability, ignores capacity load, ignores time-to-care.

New composite scoring:
  score = w_proximity  * proximity_score      # how close is the hospital
         + w_capability * capability_score    # does it have the RIGHT services/depts
         + w_beds       * bed_score           # are beds actually available
         + w_load       * load_score          # is the hospital not overwhelmed
         + w_time       * time_score          # is a doctor on duty right now

Weights are severity-dependent (defined in SEVERITY_WEIGHTS below).
For P1: proximity + capability dominate.
For P3/P4: availability matters more, capability requirements are lighter.

All component scores are normalized to [0, 1] before weighting.
Final composite score is in [0, 1]. Higher = better.
"""

import math
import logging

from .models import Hospital

logger = logging.getLogger(__name__)


# ── Severity-dependent scoring weights ────────────────────────────────────────
# Each row: (proximity, capability, beds, load, time_to_care)
# Must sum to 1.0

SEVERITY_WEIGHTS = {
    "P1": (0.35, 0.40, 0.15, 0.05, 0.05),
    "P2": (0.30, 0.35, 0.20, 0.10, 0.05),
    "P3": (0.20, 0.25, 0.30, 0.15, 0.10),
    "P4": (0.15, 0.15, 0.35, 0.20, 0.15),
}

MAX_RADIUS_KM   = 50.0    # default search radius
PROXY_SPEED_P12 = 60.0    # km/h — ambulance speed for critical cases
PROXY_SPEED_P34 = 30.0    # km/h — car speed for non-critical cases


# ── Haversine distance ────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance in km between two GPS coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_travel_minutes(distance_km: float, severity: str = "P3") -> int:
    """Rough ETA estimate based on severity-driven speed assumption."""
    speed = PROXY_SPEED_P12 if severity in ("P1", "P2") else PROXY_SPEED_P34
    return max(1, int((distance_km / speed) * 60))


# ── Component score functions (all return float in [0, 1]) ───────────────────

def _proximity_score(distance_km: float, max_radius_km: float = MAX_RADIUS_KM) -> float:
    """
    Exponential decay: hospitals within 5km score high, falloff after that.
    Uses 1 - (distance / max_radius) ^ 0.5 to give a concave curve
    (moderate distance penalties are less than linear).
    """
    if distance_km <= 0:
        return 1.0
    normalized = distance_km / max_radius_km
    return max(0.0, 1.0 - (normalized ** 0.5))


def _capability_score(
    hospital: Hospital,
    needs_profile: dict,
) -> tuple[float, dict]:
    """
    Checks how well the hospital matches the care needs profile.
    Returns (score, match_detail) where match_detail contains which
    services/departments matched and which were missing.

    Scoring logic:
      - Service match: each required service that IS available = +1 / total_required
      - Department match: each required dept that IS present = +1 / total_required
      - Ventilator bonus: if needs_profile says requires_ventilator and hospital has any
      - Pediatric requirement: if profile requires pediatric and hospital lacks it → score 0
    """
    required_services = needs_profile.get("required_services", [])
    required_depts    = needs_profile.get("required_departments", [])
    requires_vent     = needs_profile.get("requires_ventilator", False)
    requires_blood    = needs_profile.get("requires_blood_bank", False)
    requires_peds     = needs_profile.get("requires_pediatric", False)

    # ── Pediatric hard gate ───────────────────────────────────────────────────
    # If the patient needs pediatric capability and the hospital doesn't have
    # a pediatric department, the hospital score must be zero for capability.
    if requires_peds:
        has_peds = hospital.departments.filter(
            dept_type__in=['pediatrics'],
            is_active=True
        ).exists()
        if not has_peds:
            return 0.0, {
                "required_services_available": [],
                "required_services_missing":  required_services,
                "required_depts_available":   [],
                "required_depts_missing":     required_depts,
                "match_score":                0.0,
                "pediatric_gate_failed":      True,
            }

    # ── Service matching ──────────────────────────────────────────────────────
    svc_available = []
    svc_missing   = []

    if required_services:
        for svc_code in required_services:
            exists = hospital.services.filter(
                service__code=svc_code,
                is_available=True,
            ).exists()
            if exists:
                svc_available.append(svc_code)
            else:
                svc_missing.append(svc_code)
        svc_score = len(svc_available) / len(required_services)
    else:
        svc_score = 1.0  # no specific services needed = perfect match

    # ── Department matching ───────────────────────────────────────────────────
    depts_available = []
    depts_missing   = []

    if required_depts:
        for dept in required_depts:
            exists = hospital.departments.filter(
                dept_type__iexact=dept,
                is_active=True,
            ).exists()
            if exists:
                depts_available.append(dept)
            else:
                depts_missing.append(dept)
        dept_score = len(depts_available) / len(required_depts)
    else:
        dept_score = 1.0  # no specific departments needed = perfect match

    # ── Ventilator check ──────────────────────────────────────────────────────
    if requires_vent:
        has_vent = hospital.equipment.filter(
            equipment_type__icontains='ventilator',
            status='available',
            available_quantity__gt=0,
        ).exists()
        # Ventilator availability is a binary modifier — absence halves the capability score
        vent_modifier = 1.0 if has_vent else 0.5
    else:
        vent_modifier = 1.0

    # ── Blood bank check ──────────────────────────────────────────────────────
    if requires_blood:
        has_blood = hospital.services.filter(
            service__code='BLD_BANK',
            is_available=True,
        ).exists()
        blood_modifier = 1.0 if has_blood else 0.7
    else:
        blood_modifier = 1.0

    # ── Composite capability score ────────────────────────────────────────────
    # Weighted: services matter slightly more than departments
    raw_cap = (svc_score * 0.55 + dept_score * 0.45) * vent_modifier * blood_modifier
    cap_score = max(0.0, min(1.0, raw_cap))

    match_detail = {
        "required_services_available": svc_available,
        "required_services_missing":   svc_missing,
        "required_depts_available":    depts_available,
        "required_depts_missing":      depts_missing,
        "match_score":                 round(cap_score, 3),
        "pediatric_gate_failed":       False,
    }

    return cap_score, match_detail


def _bed_availability_score(hospital: Hospital, required_bed_type: str) -> tuple[float, int]:
    """
    Returns (score, available_count).
    Score is concave: having 1 bed = good, having 10+ = only marginally better.
    Zero beds = score 0.
    """
    bed_type_map = {
        "icu":        "icu",
        "emergency":  "emergency",
        "ventilator": "ventilator",
        "general":    "general",
        "private":    "private",
    }
    mapped_type = bed_type_map.get(required_bed_type.lower(), "general")

    available = hospital.beds.filter(
        bed_type=mapped_type,
        status='available',
        is_active=True,
    ).count()

    if available == 0:
        # No beds of required type — check general as fallback for P3/P4
        if mapped_type not in ("icu", "ventilator"):
            available = hospital.beds.filter(
                bed_type="general",
                status='available',
                is_active=True,
            ).count()

    if available == 0:
        return 0.0, 0

    # log scale: score = log(1 + available) / log(1 + 20) — capped at 20 beds
    score = math.log(1 + min(available, 20)) / math.log(21)
    return min(1.0, score), available


def _load_factor_score(hospital: Hospital) -> tuple[float, float]:
    """
    Returns (score, occupancy_ratio).
    Lower occupancy = higher score. Formula: score = 1 - occupancy_ratio.
    A hospital at 95% capacity scores very low.
    A hospital at 50% capacity scores 0.5.
    """
    total_beds = hospital.beds.filter(is_active=True).count()
    if total_beds == 0:
        return 0.5, 0.5  # unknown load — neutral

    occupied_beds = hospital.beds.filter(
        status='occupied',
        is_active=True,
    ).count()

    occupancy_ratio = occupied_beds / total_beds
    # Score is inverse of occupancy, with a slight penalty curve for very high load
    load_score = max(0.0, 1.0 - (occupancy_ratio ** 1.5))
    return round(load_score, 3), round(occupancy_ratio, 3)


def _time_to_care_score(hospital: Hospital, required_depts: list) -> float:
    """
    Checks if a doctor in the required specialty is on duty RIGHT NOW.
    Returns 1.0 if yes (or if no departments required), 0.5 if not determinable,
    0.3 if we know no one is on duty in the required specialty.

    This is a bonus/penalty modifier — it does not dominate the score.
    """
    if not required_depts:
        return 0.75  # neutral — no specific doctor needed

    try:
        # Check each required department for an active doctor on duty
        for dept_type in required_depts:
            dept = hospital.departments.filter(
                dept_type__iexact=dept_type,
                is_active=True,
            ).first()
            if not dept:
                continue
            # Check if any doctor in this dept has an active duty schedule
            on_duty = dept.doctors.filter(status='active').filter(
                duty_schedules__is_active=True
            ).exists()
            if on_duty:
                return 1.0  # found an on-duty doctor in a required dept

        return 0.3  # required depts found but no one confirmed on duty
    except Exception:
        return 0.5  # data not available — neutral score


# ── Main ranking function ─────────────────────────────────────────────────────

def rank_hospitals_for_case(
    lat: float,
    lng: float,
    needs_profile: dict,
    severity: str = "P3",
    max_results: int = 5,
    max_radius_km: float = MAX_RADIUS_KM,
) -> list:
    """
    Ranks nearby hospitals using composite capability scoring.

    This is the production replacement for the old find_nearest_hospital().
    It accepts a care needs profile and returns a ranked list with full
    scoring breakdown and capability match details.

    Args:
        lat, lng:       Patient GPS coordinates
        needs_profile:  Output from needs_profiler.profile_care_needs()
        severity:       'P1' | 'P2' | 'P3' | 'P4'
        max_results:    How many hospitals to return (default 5)
        max_radius_km:  Search radius (default 50km)

    Returns:
        List of dicts, sorted by composite_score descending.
        Each dict includes: hospital metadata, distances, bed counts,
        capability_match breakdown, composite score, and data for explainer.
    """
    weights = SEVERITY_WEIGHTS.get(severity, SEVERITY_WEIGHTS["P3"])
    w_prox, w_cap, w_bed, w_load, w_time = weights

    required_bed_type = needs_profile.get("required_bed_type", "general")

    hospitals = Hospital.objects.filter(
        status=Hospital.Status.ACTIVE,
        verification_status=Hospital.VerificationStatus.VERIFIED,
    ).prefetch_related(
        'beds', 'departments', 'services__service', 'equipment', 'doctors'
    )

    results = []

    for hospital in hospitals:
        hosp_lat = getattr(hospital, 'latitude',  None)
        hosp_lng = getattr(hospital, 'longitude', None)

        if hosp_lat is None or hosp_lng is None:
            continue  # cannot route to hospitals without GPS coordinates

        distance_km = haversine_km(lat, lng, float(hosp_lat), float(hosp_lng))
        if distance_km > max_radius_km:
            continue

        # ── Compute individual component scores ───────────────────────────────
        prox_score             = _proximity_score(distance_km, max_radius_km)
        cap_score, cap_detail  = _capability_score(hospital, needs_profile)
        bed_score, avail_beds  = _bed_availability_score(hospital, required_bed_type)
        load_score, occupancy  = _load_factor_score(hospital)
        time_score             = _time_to_care_score(
            hospital, needs_profile.get("required_departments", [])
        )

        # ── Composite score ───────────────────────────────────────────────────
        composite = (
            w_prox * prox_score +
            w_cap  * cap_score  +
            w_bed  * bed_score  +
            w_load * load_score +
            w_time * time_score
        )

        # ── Hard gate: if zero beds available and P1/P2, skip hospital ────────
        # (We still include it for P3/P4 as they can wait)
        if severity in ("P1", "P2") and avail_beds == 0:
            # Check ALL bed types — if truly zero beds anywhere, skip
            any_bed = hospital.beds.filter(status='available', is_active=True).count()
            if any_bed == 0:
                continue  # completely full — do not recommend for critical cases

        travel_minutes = estimate_travel_minutes(distance_km, severity)

        results.append({
            "hospital_id":       str(hospital.id),
            "name":              hospital.name,
            "address":           getattr(hospital, 'address', ''),
            "area":              getattr(hospital, 'area', ''),
            "city":              getattr(hospital, 'city', ''),
            "phone":             getattr(hospital, 'phone', ''),
            "category":          hospital.get_category_display(),
            "latitude":          float(hosp_lat),
            "longitude":         float(hosp_lng),
            "distance_km":       round(distance_km, 2),
            "travel_minutes":    travel_minutes,
            "available_beds":    avail_beds,
            "bed_type_searched": required_bed_type,
            "load_factor":       occupancy,
            "capability_match":  cap_detail,
            # Individual component scores — kept for transparency / debugging
            "scores": {
                "proximity":   round(prox_score, 3),
                "capability":  round(cap_score, 3),
                "beds":        round(bed_score, 3),
                "load":        round(load_score, 3),
                "time_to_care": round(time_score, 3),
                "composite":   round(composite, 4),
            },
            "composite_score": round(composite, 4),
        })

    # Sort by composite score, highest first
    results.sort(key=lambda x: x["composite_score"], reverse=True)

    # Add rank numbers
    for i, r in enumerate(results[:max_results], 1):
        r["rank"] = i

    logger.info(
        f"[routing] Ranked {len(results)} hospitals for {severity} case "
        f"(bed_type={required_bed_type}, radius={max_radius_km}km)"
    )

    return results[:max_results]


# ── Legacy compatibility — keep find_nearest_hospital working ─────────────────
# The EmergencyPortal still calls /api/hospitals/nearby/ which uses this.
# We preserve the old function signature but make it delegate to the new scorer.

def find_nearest_hospital(
    lat: float,
    lng: float,
    required_bed_type: str = "GENERAL",
    department: str = None,
    max_results: int = 5,
    max_radius_km: float = MAX_RADIUS_KM,
    severity: str = "P3",
) -> list:
    """
    Legacy compatibility wrapper.
    Builds a minimal needs_profile from the old parameters and delegates
    to rank_hospitals_for_case().
    """
    needs_profile = {
        "required_bed_type":    required_bed_type.lower(),
        "required_services":    [],
        "required_departments": [department.lower()] if department else [],
        "requires_ventilator":  False,
        "requires_blood_bank":  False,
        "requires_pediatric":   False,
        "time_sensitivity_minutes": 60,
        "profile_reasoning":    "Legacy routing call — basic profile.",
    }

    ranked = rank_hospitals_for_case(
        lat=lat, lng=lng,
        needs_profile=needs_profile,
        severity=severity,
        max_results=max_results,
        max_radius_km=max_radius_km,
    )

    # Return in the same shape the old code expected
    for h in ranked:
        h["has_department"]      = len(h["capability_match"]["required_depts_available"]) > 0
        h["department"]          = department
        h["score"]               = h["composite_score"]
        h["recommendation_reason"] = _build_legacy_reason(h)

    return ranked


def _build_legacy_reason(h: dict) -> str:
    """Build the old-style recommendation_reason string for backward compatibility."""
    parts = []
    if h["available_beds"] > 0:
        parts.append(f"{h['available_beds']} beds available")
    cap = h.get("capability_match", {})
    if cap.get("required_depts_available"):
        parts.append(f"has {', '.join(cap['required_depts_available'])} department")
    if h["distance_km"] < 5:
        parts.append("very close")
    elif h["distance_km"] < 15:
        parts.append("nearby")
    if cap.get("match_score", 0) >= 0.8:
        parts.append("high capability match")
    return ", ".join(parts) if parts else "closest available option"
