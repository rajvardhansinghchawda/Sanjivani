import json
from django.core.serializers.json import DjangoJSONEncoder
from apps.clinical.models import Prescription, PatientCaregiverLink
from apps.iot.models import Device, DeviceCompartmentMapping
from apps.iot.serializers import DeviceSerializer, CompartmentMappingSerializer

patient_id='c5d8b018-809d-4462-901f-2d57852efa61'
device_id='e214a30b-c919-4d23-b3f1-80557b756cdd'
comp_num=3

# Update or create mapping for test
m = DeviceCompartmentMapping.objects.filter(device__id=device_id, compartment_number=comp_num).first()
if not m:
    dev = Device.objects.get(id=device_id)
    # try find a prescription
    p = Prescription.objects.filter(patient=dev.linked_patient, compartment_number=comp_num, is_active=True).order_by('-created_at').first()
    m = DeviceCompartmentMapping.objects.create(device=dev, compartment_number=comp_num, prescription=(p if p else None), scheduled_times=['08:30','20:00'], medication_name=(p.medication.name if p else 'test med'))
else:
    m.scheduled_times = ['08:30','20:00']
    m.save(update_fields=['scheduled_times'])

print('Mapping now:', json.dumps(m.scheduled_times, cls=DjangoJSONEncoder))

link = PatientCaregiverLink.objects.filter(patient__id=patient_id).first()
if not link:
    print('No link found for patient')
else:
    devices_qs = Device.objects.filter(linked_patient=link.patient, deleted_at__isnull=True)
    devices_data = DeviceSerializer(devices_qs, many=True).data
    device_index = {d['id']: i for i, d in enumerate(devices_data)}
    mappings = DeviceCompartmentMapping.objects.filter(device__in=devices_qs).select_related('prescription__medication')
    grouped = {}
    for mm in mappings:
        key = str(mm.device_id)
        grouped.setdefault(key, []).append(mm)
    for dev_id, maps in grouped.items():
        ser = CompartmentMappingSerializer(maps, many=True).data
        idx = device_index.get(dev_id)
        if idx is not None:
            devices_data[idx]['compartments'] = ser
    print(json.dumps(devices_data, default=str, indent=2)[:5000])
