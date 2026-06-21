import sys

content = open('D:/gdg hackethon/backend/apps/ambulances/views.py', 'r', encoding='utf-8').read()
lines = content.split('\n')

for i, line in enumerate(lines):
    if "elif action == 'complete':" in line:
        insert_idx = i + 1
        new_code = '''            # Alert the hospital that the patient has arrived for admission
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from apps.triage.models import EmergencyCase
            
            try:
                case = EmergencyCase.objects.filter(patient_name=amb_request.requester_name).order_by('-created_at').first()
                if case:
                    channel_layer = get_channel_layer()
                    # We broadcast to triage_dashboard, ReceptionPortalPage will also listen to this
                    async_to_sync(channel_layer.group_send)(
                        "triage_dashboard",
                        {
                            "type": "patient_arrived",
                            "data": {
                                "case_id": str(case.case_id),
                                "patient_name": case.patient_name,
                                "patient_phone": case.patient_phone,
                                "patient_age": case.patient_age,
                                "patient_gender": case.patient_gender,
                                "severity": case.ai_p_level,
                                "symptoms": case.raw_symptoms_text,
                                "required_bed_type": case.required_bed_type,
                                "ambulance_vehicle": ambulance.vehicle_number,
                                "driver_name": ambulance.driver_name,
                            }
                        }
                    )
            except Exception as e:
                print(f"Failed to send patient_arrived alert: {e}")
'''
        lines.insert(insert_idx, new_code)
        break

open('D:/gdg hackethon/backend/apps/ambulances/views.py', 'w', encoding='utf-8').write('\n'.join(lines))
print('Success! Added patient_arrived alert to trip completion.')
