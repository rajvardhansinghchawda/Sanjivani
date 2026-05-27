from django.utils import timezone
from datetime import timedelta

DEVICE_ID = 'e214a30b-c919-4d23-b3f1-80557b756cdd'
COMPARTMENT = 2

from apps.iot.models import Device, DeviceCommand, DeviceCompartmentMapping, PhysicalCompartment

now = timezone.localtime()
now_iso = now.isoformat()
current_hm = now.strftime('%H:%M')

try:
    device = Device.objects.get(id=DEVICE_ID)
except Exception as e:
    print({'success': False, 'error': f'Device not found: {e}'})
    raise

results = {'device': str(device.id), 'current_time': current_hm, 'actions': []}

# 1) Update mapping for compartment 2 only
mapping = DeviceCompartmentMapping.objects.filter(device=device, compartment_number=COMPARTMENT).first()
if mapping:
    mapping.scheduled_times = [current_hm]
    mapping.save(update_fields=['scheduled_times'])
    results['actions'].append({'mapping_updated': mapping.compartment_number, 'scheduled_times': mapping.scheduled_times})
else:
    results['actions'].append({'mapping_update': 'not_found', 'compartment': COMPARTMENT})

# 2) Create PREPARE and OPEN commands for this compartment
try:
    pc = DeviceCommand.objects.create(
        device=device,
        command_type='PREPARE_COMPARTMENT',
        payload={
            'compartment': COMPARTMENT,
            'scheduled_at': now_iso,
            'reason': 'manual_patient_test_now',
        },
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    oc = DeviceCommand.objects.create(
        device=device,
        command_type='OPEN_GATE',
        payload={
            'compartment': COMPARTMENT,
            'scheduled_at': now_iso,
            'reason': 'manual_patient_test_now',
        },
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    results['actions'].append({'compartment': COMPARTMENT, 'prepare_cmd': str(pc.id), 'open_cmd': str(oc.id)})
except Exception as e:
    results['actions'].append({'compartment': COMPARTMENT, 'error': str(e)})

# 3) Simulate lid opened (creates pending DoseSession)
from apps.iot.services import handle_lid_opened
from apps.iot.weight_service import handle_gate_event
lid_res = handle_lid_opened(device, None, {'compartment': COMPARTMENT})
results['lid_opened'] = lid_res

# 4) Simulate gate open and close
gate_open = handle_gate_event(device, COMPARTMENT, 'open')
gate_close = handle_gate_event(device, COMPARTMENT, 'close')
results['gate_open'] = gate_open
results['gate_close'] = gate_close

# 5) Process weight reading as patient — pick a weight to indicate pill(s) removed.
# Read current compartment balance and expected reduction
comp = PhysicalCompartment.objects.filter(device=device, compartment_number=COMPARTMENT).prefetch_related('sub_compartments').first()
if comp:
    from apps.iot.weight_service import calculate_dose_expected_reduction, process_weight_reading
    expected_reduction = calculate_dose_expected_reduction(list(comp.sub_compartments.filter(is_active=True)))
    expected_before = comp.current_balance_weight_grams
    # Choose actual weight to indicate 'taken' (reduce by >= expected*0.9)
    actual_weight = round(expected_before - max(0.6, expected_reduction * 0.95), 3)
    weight_res = process_weight_reading(comp, actual_weight)
    results['weight_reading'] = {
        'expected_before': expected_before,
        'expected_reduction': expected_reduction,
        'actual_weight_sent': actual_weight,
        'result': weight_res,
    }
else:
    results['weight_reading'] = {'error': 'compartment_not_found'}

# 6) Fetch latest DoseSession
from apps.iot.models import DoseSession
session = DoseSession.objects.filter(compartment__device=device, compartment__compartment_number=COMPARTMENT).order_by('-created_at').first()
if session:
    results['latest_session'] = {
        'id': str(session.id),
        'compartment': session.compartment.compartment_number,
        'scheduled_time': session.scheduled_time.isoformat() if session.scheduled_time else None,
        'dose_status': session.dose_status,
        'expected_before': session.expected_weight_before,
        'actual_after': session.actual_weight_after,
        'weight_reduction_actual': session.weight_reduction_actual,
        'weight_reduction_expected': session.weight_reduction_expected,
        'completed_at': session.completed_at.isoformat() if session.completed_at else None,
    }
else:
    results['latest_session'] = None

# 7) Updated compartment state
if comp:
    results['compartment_state'] = {
        'compartment': comp.compartment_number,
        'current_balance_weight_grams': comp.current_balance_weight_grams,
        'expected_weight_grams': comp.expected_weight_grams,
    }

print(results)
