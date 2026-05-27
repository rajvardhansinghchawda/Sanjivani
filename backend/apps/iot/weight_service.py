"""
apps/iot/weight_service.py — Weight calculation, dose verification, gate event logic.
Backend is the SOLE source of truth for all weight math.
ESP32 only sends raw weight numbers — never interprets them.
"""
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

DOSE_TOLERANCE = 0.90   # 10% tolerance — actual >= expected * 0.90 → TAKEN
MAX_GATE_OPENS = 4       # lock gate after this many opens per dose session


# ── Weight math helpers ──────────────────────────────────────────────────────

def calculate_sub_compartment_weight(pill_weight_grams: float, quantity_per_dose: int, duration_days: int) -> float:
    """Total weight loaded into one sub-compartment (medicine slot) when filled."""
    return pill_weight_grams * quantity_per_dose * duration_days


def calculate_compartment_expected_weight(sub_compartments) -> float:
    """Sum of all active sub-compartment total weights → total expected load."""
    return sum(s.total_weight_grams for s in sub_compartments if s.is_active)


def calculate_dose_expected_reduction(sub_compartments) -> float:
    """Expected weight reduction for one single dose (pill_weight × qty for each medicine)."""
    return sum(
        s.pill_weight_grams * s.quantity_per_dose
        for s in sub_compartments
        if s.is_active
    )


def verify_dose(actual_reduction: float, expected_reduction: float) -> str:
    """
    Compare actual vs expected weight reduction.
    Returns: 'taken' | 'partial' | 'missed'
    """
    if expected_reduction <= 0:
        return 'taken'  # compartment empty or no medicines — treat as taken

    ratio = actual_reduction / expected_reduction
    if ratio >= DOSE_TOLERANCE:
        return 'taken'
    elif ratio > 0.10:   # some medicine removed but not enough
        return 'partial'
    else:
        return 'missed'


def identify_missed_medicines(sub_compartments, weight_deficit: float) -> list:
    """
    Heuristic: identify which sub-compartments were likely NOT taken.
    Sorts medicines by dose weight (largest first) and matches against deficit.
    Returns list of dicts with medicine_name and expected_weight.
    """
    missed = []
    remaining = weight_deficit

    sorted_subs = sorted(
        [s for s in sub_compartments if s.is_active],
        key=lambda s: s.pill_weight_grams * s.quantity_per_dose,
        reverse=True,
    )

    for sub in sorted_subs:
        dose_w = sub.pill_weight_grams * sub.quantity_per_dose
        if remaining >= dose_w * DOSE_TOLERANCE:
            missed.append({
                'medicine_name': sub.medicine_name,
                'expected_dose_weight_grams': round(dose_w, 3),
            })
            remaining -= dose_w
            if remaining <= 0:
                break

    return missed


# ── Main weight processing pipeline ─────────────────────────────────────────

def process_weight_reading(compartment, actual_weight: float) -> dict:
    """
    Called when ESP32 sends a weight reading after gate close.
    1. Records raw weight in WeightHistory.
    2. Finds the active DoseSession for this compartment.
    3. Calculates actual vs expected reduction.
    4. Verifies dose status (taken/partial/missed).
    5. Updates DoseSession and compartment running balance.
    6. Returns full verification result dict.
    """
    from .models import DoseSession, WeightHistory

    # Always record the raw reading
    WeightHistory.objects.create(
        device=compartment.device,
        compartment_number=compartment.compartment_number,
        weight_grams=actual_weight,
    )

    sub_compartments = list(compartment.sub_compartments.filter(is_active=True))

    active_session = (
        DoseSession.objects.filter(compartment=compartment, dose_status='pending')
        .order_by('-created_at')
        .first()
    )

    if not active_session:
        logger.warning(
            "No pending DoseSession for compartment %s (device %s)",
            compartment.compartment_number, compartment.device_id,
        )
        return {
            'dose_status': 'unknown',
            'error': 'no_active_session',
            'current_weight': actual_weight,
        }

    expected_before = active_session.expected_weight_before
    actual_reduction = expected_before - actual_weight
    expected_reduction = calculate_dose_expected_reduction(sub_compartments)

    dose_status = verify_dose(actual_reduction, expected_reduction)

    missed_medicines = []
    if dose_status in ('partial', 'missed'):
        deficit = max(expected_reduction - actual_reduction, 0)
        if deficit > 0:
            missed_medicines = identify_missed_medicines(sub_compartments, deficit)

    # Persist session result
    active_session.actual_weight_after = actual_weight
    active_session.weight_reduction_actual = round(actual_reduction, 3)
    active_session.weight_reduction_expected = round(expected_reduction, 3)
    active_session.dose_status = dose_status
    active_session.completed_at = timezone.now()
    active_session.save()

    # Update compartment running balance regardless (use actual reading)
    compartment.current_balance_weight_grams = actual_weight
    compartment.save(update_fields=['current_balance_weight_grams'])

    # Trigger caregiver notifications for non-taken doses
    if dose_status in ('partial', 'missed'):
        _notify_partial_or_missed(compartment.device, compartment.compartment_number,
                                  dose_status, actual_reduction, expected_reduction,
                                  missed_medicines)

    return {
        'dose_status': dose_status,
        'actual_reduction_grams': round(actual_reduction, 3),
        'expected_reduction_grams': round(expected_reduction, 3),
        'current_balance_grams': actual_weight,
        'missed_medicines': missed_medicines,
        'session_id': str(active_session.id),
    }


# ── Gate event handling ──────────────────────────────────────────────────────

def handle_gate_event(device, compartment_number: int, event_type: str) -> dict:
    """
    Process a gate open/close event from ESP32.
    - Records GateEvent.
    - On 'open': increments gate_open_count on active DoseSession.
    - If count exceeds MAX_GATE_OPENS: locks gate, queues GATE_LOCK command, notifies caregiver.
    Returns dict with gate_locked flag and command (if any) for ESP32 to execute.
    """
    from .models import GateEvent, DoseSession, PhysicalCompartment, DeviceCommand
    from datetime import timedelta

    compartment = PhysicalCompartment.objects.filter(
        device=device, compartment_number=compartment_number
    ).first()

    session = None
    if compartment:
        session = (
            DoseSession.objects.filter(compartment=compartment, dose_status='pending')
            .order_by('-created_at')
            .first()
        )

    GateEvent.objects.create(
        device=device,
        compartment_number=compartment_number,
        event_type=event_type,
        session=session,
    )

    gate_locked = device.is_gate_locked
    issued_command = None

    if event_type == 'open' and session and not session.is_gate_locked:
        session.gate_open_count += 1
        session.save(update_fields=['gate_open_count'])

        if session.gate_open_count > MAX_GATE_OPENS:
            session.is_gate_locked = True
            session.save(update_fields=['is_gate_locked'])

            device.is_gate_locked = True
            device.save(update_fields=['is_gate_locked'])

            gate_locked = True
            issued_command = 'GATE_LOCK'

            # Queue hardware command so ESP32 physically locks the gate
            DeviceCommand.objects.create(
                device=device,
                command_type='GATE_LOCK',
                payload={
                    'compartment': compartment_number,
                    'reason': f'Gate opened {session.gate_open_count} times (limit {MAX_GATE_OPENS})',
                },
                expires_at=timezone.now() + timedelta(hours=24),
            )

            _notify_gate_locked(device, compartment_number, session.gate_open_count)

    return {
        'gate_locked': gate_locked,
        'gate_open_count': session.gate_open_count if session else 0,
        'command': issued_command,
    }


def caregiver_unlock(device) -> dict:
    """
    Remote caregiver unlock: clear gate lock on device and latest pending session.
    Queues GATE_UNLOCK command for ESP32 to physically unlock.
    """
    from .models import DoseSession, DeviceCommand, PhysicalCompartment
    from datetime import timedelta

    device.is_gate_locked = False
    device.save(update_fields=['is_gate_locked'])

    # Unlock all pending locked sessions
    locked_sessions = DoseSession.objects.filter(
        compartment__device=device,
        is_gate_locked=True,
    )
    locked_sessions.update(is_gate_locked=False, gate_open_count=0)

    DeviceCommand.objects.create(
        device=device,
        command_type='GATE_UNLOCK',
        payload={'reason': 'Caregiver remote unlock'},
        expires_at=timezone.now() + timedelta(hours=1),
    )

    return {'unlocked': True, 'message': 'Gate unlocked. GATE_UNLOCK command queued for device.'}


# ── Private notification helpers ─────────────────────────────────────────────

def _notify_partial_or_missed(device, compartment_number, dose_status,
                               actual_reduction, expected_reduction, missed_medicines):
    try:
        from apps.iot.tasks import _send_whatsapp
        phone = device.caregiver_phone
        if not phone:
            return
        missed_names = ', '.join(m['medicine_name'] for m in missed_medicines) or 'unknown'
        msg = (
            f"{'PARTIAL DOSE' if dose_status == 'partial' else 'MISSED DOSE'} ALERT\n"
            f"Device: {device.device_name}\n"
            f"Compartment: {compartment_number}\n"
            f"Expected: {round(expected_reduction, 1)}g reduction, got: {round(actual_reduction, 1)}g\n"
            f"Likely missed: {missed_names}"
        )
        _send_whatsapp(phone, msg)
    except Exception as exc:
        logger.warning("Failed to send partial/missed dose notification: %s", exc)


def _notify_gate_locked(device, compartment_number, gate_open_count):
    try:
        from apps.iot.tasks import _send_whatsapp
        phone = device.caregiver_phone
        if not phone:
            return
        _send_whatsapp(
            phone,
            f"GATE LOCKED — {device.device_name}\n"
            f"Compartment {compartment_number} gate locked after "
            f"{gate_open_count} open attempts (limit {MAX_GATE_OPENS}).\n"
            f"Please unlock from the app."
        )
    except Exception as exc:
        logger.warning("Failed to send gate lock notification: %s", exc)
