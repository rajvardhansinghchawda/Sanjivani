from django.utils import timezone

DEVICE_ID = 'e214a30b-c919-4d23-b3f1-80557b756cdd'

from apps.iot.models import Device, PhysicalCompartment, SubCompartment

now = timezone.now()

try:
    device = Device.objects.get(id=DEVICE_ID)
except Exception as e:
    print({'success': False, 'error': f'Device not found: {e}'})
    raise

SLOTS = [
    (1, 'morning_before'),
    (2, 'morning_after'),
    (3, 'night_before'),
    (4, 'night_after'),
]

summary = []
for num, slot in SLOTS:
    comp, created = PhysicalCompartment.objects.get_or_create(
        device=device,
        compartment_number=num,
        defaults={'time_slot': slot}
    )
    # Create one SubCompartment if none exists
    sub = None
    if not comp.sub_compartments.filter(is_active=True).exists():
        sub = SubCompartment.objects.create(
            compartment=comp,
            medicine_name=f'TestMed {num}',
            pill_weight_grams=0.5,
            quantity_per_dose=1,
            duration_days=30,
            total_pills=30,
            total_weight_grams=0.5 * 30,
            ai_analysis_data={'source': 'simulated_fill'},
            instructions='Simulated fill for testing',
            is_active=True,
        )
    else:
        sub = comp.sub_compartments.filter(is_active=True).first()

    # Update compartment expected and current balance
    measured_subs = comp.sub_compartments.filter(is_active=True)
    expected_weight = round(sum(s.total_weight_grams for s in measured_subs), 3)
    comp.expected_weight_grams = expected_weight
    comp.current_balance_weight_grams = expected_weight
    comp.last_filled_at = now
    comp.is_active = True
    comp.save()

    summary.append({
        'compartment': comp.compartment_number,
        'time_slot': comp.time_slot,
        'sub_compartment_id': str(sub.id),
        'medicine_name': sub.medicine_name,
        'total_pills': sub.total_pills,
        'total_weight_grams': sub.total_weight_grams,
        'expected_weight_grams': comp.expected_weight_grams,
    })

print({'success': True, 'device_id': str(device.id), 'filled_compartments': summary})
