from django.utils import timezone
from datetime import timedelta

DEVICE_ID = 'e214a30b-c919-4d23-b3f1-80557b756cdd'

from apps.iot.models import Device, DeviceCommand, DeviceCompartmentMapping

now = timezone.localtime()
now_iso = now.isoformat()
current_hm = now.strftime('%H:%M')

try:
    device = Device.objects.get(id=DEVICE_ID)
except Exception as e:
    print({'success': False, 'error': f'Device not found: {e}'})
    raise

created_cmds = []
# Try to update any DeviceCompartmentMapping scheduled_times to current time
mappings = DeviceCompartmentMapping.objects.filter(device=device)
for m in mappings:
    try:
        m.scheduled_times = [current_hm]
        m.save(update_fields=['scheduled_times'])
        created_cmds.append({'mapping_updated': m.compartment_number, 'scheduled_times': m.scheduled_times})
    except Exception:
        pass

# Create device commands for all 4 compartments
for compartment in (1,2,3,4):
    try:
        pc = DeviceCommand.objects.create(
            device=device,
            command_type='PREPARE_COMPARTMENT',
            payload={
                'compartment': compartment,
                'scheduled_at': now_iso,
                'reason': 'manual_test_now',
            },
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        oc = DeviceCommand.objects.create(
            device=device,
            command_type='OPEN_GATE',
            payload={
                'compartment': compartment,
                'scheduled_at': now_iso,
                'reason': 'manual_test_now',
            },
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        created_cmds.append({'compartment': compartment, 'prepare_cmd': str(pc.id), 'open_cmd': str(oc.id)})
    except Exception as e:
        created_cmds.append({'compartment': compartment, 'error': str(e)})

print({'success': True, 'device': str(device.id), 'current_time': current_hm, 'results': created_cmds})
