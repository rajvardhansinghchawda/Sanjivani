from django.utils import timezone

DEVICE_ID = 'e214a30b-c919-4d23-b3f1-80557b756cdd'

from apps.iot.models import Device, PhysicalCompartment, DoseSession, DeviceEvent

try:
    device = Device.objects.get(id=DEVICE_ID)
except Exception as e:
    print({'success': False, 'error': f'Device not found: {e}'})
    raise

print('\n=== Device ===')
print({'id': str(device.id), 'name': device.device_name, 'last_seen_at': device.last_seen_at, 'is_gate_locked': device.is_gate_locked})

print('\n=== Physical Compartments ===')
comps = PhysicalCompartment.objects.filter(device=device).order_by('compartment_number')
for c in comps:
    subs = list(c.sub_compartments.filter(is_active=True))
    print({
        'compartment': c.compartment_number,
        'time_slot': c.time_slot,
        'expected_weight_grams': c.expected_weight_grams,
        'current_balance_weight_grams': c.current_balance_weight_grams,
        'last_filled_at': c.last_filled_at,
        'sub_compartments': [
            {'id': str(s.id), 'medicine_name': s.medicine_name, 'total_pills': s.total_pills, 'total_weight_grams': s.total_weight_grams}
            for s in subs
        ]
    })

print('\n=== Recent DoseSessions (last 10) ===')
sessions = DoseSession.objects.filter(compartment__device=device).order_by('-scheduled_time')[:10]
for s in sessions:
    print({
        'id': str(s.id),
        'compartment': s.compartment.compartment_number,
        'scheduled_time': s.scheduled_time,
        'dose_status': s.dose_status,
        'expected_before': s.expected_weight_before,
        'actual_after': s.actual_weight_after,
        'weight_reduction_actual': s.weight_reduction_actual,
        'weight_reduction_expected': s.weight_reduction_expected,
        'completed_at': s.completed_at,
    })

print('\n=== Recent DeviceEvents (last 20) ===')
events = DeviceEvent.objects.filter(device=device).order_by('-created_at')[:20]
for e in events:
    print({
        'event_uuid': e.event_uuid,
        'event_type': e.event_type,
        'compartment_num': e.compartment_num,
        'processed': e.processed,
        'created_at': e.created_at,
        'raw_payload': e.raw_payload,
    })

print('\nDone.')
