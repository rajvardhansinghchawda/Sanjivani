import json
from apps.iot.models import Device, PhysicalCompartment, SubCompartment, DeviceCompartmentMapping

did='e214a30b-c919-4d23-b3f1-80557b756cdd'
try:
    dev = Device.objects.get(id=did)
except Exception as e:
    print('Device not found:', e)
    raise SystemExit(0)

pcs = PhysicalCompartment.objects.filter(device=dev).order_by('compartment_number')
out = []
for p in pcs:
    subs = list(SubCompartment.objects.filter(compartment=p).values('id','medicine_name','quantity_per_dose','total_pills','is_active'))
    out.append({'compartment_number': p.compartment_number, 'time_slot': p.time_slot, 'sub_compartments': subs})

print('Physical compartments and sub_compartments:')
print(json.dumps(out, default=str, indent=2))

maps = list(DeviceCompartmentMapping.objects.filter(device=dev).values('compartment_number','medication_name','scheduled_times'))
print('\nDeviceCompartmentMapping entries:')
print(json.dumps(maps, default=str, indent=2))
