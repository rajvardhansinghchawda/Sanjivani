"""
Twilio voice call service for critical patient alerts.
"""
import logging
from django.conf import settings

logger = logging.getLogger('medadhere')


def call_patient_geofence_exit(patient_phone: str, patient_name: str,
                               pending_meds: list, zone_label: str):
    """
    Places an automated voice call to the PATIENT when they exit a geofence zone
    while having upcoming doses pending. Lists each medicine by name.
    pending_meds: list of dicts with keys 'name', 'dose', 'time'
    """
    if not patient_phone:
        logger.warning(f'Geofence call skipped — patient has no phone number ({patient_name})')
        return

    account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    auth_token  = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    from_number = getattr(settings, 'TWILIO_FROM_NUMBER', '')

    if not all([account_sid, auth_token, from_number]):
        logger.warning('Twilio credentials not configured — skipping geofence voice call')
        return

    try:
        from twilio.rest import Client

        # Build medicine list for the voice message
        if len(pending_meds) == 1:
            med_text = (
                f"{pending_meds[0]['name']}, {pending_meds[0]['dose']}, "
                f"scheduled at {pending_meds[0]['time']}"
            )
        else:
            parts = [
                f"{m['name']} {m['dose']} at {m['time']}"
                for m in pending_meds
            ]
            med_text = ', and '.join([', '.join(parts[:-1]), parts[-1]])

        alert_text = (
            f"Hello {patient_name}. "
            f"This is an urgent reminder from Med Adhere. "
            f"You are leaving {zone_label} but you have not taken your medicine yet. "
            f"Your pending medicine is: {med_text}. "
            f"Please take your medicine before going out. "
            f"I will repeat. "
            f"You have not taken your medicine: {med_text}. "
            f"Please take your medicine before leaving. Thank you."
        )

        twiml = f'<Response><Say voice="alice" language="en-IN">{alert_text}</Say></Response>'

        client = Client(account_sid, auth_token)
        call = client.calls.create(
            twiml=twiml,
            to=patient_phone,
            from_=from_number,
        )
        logger.info(
            f'Twilio geofence call placed to patient phone={patient_phone} '
            f'name={patient_name} zone={zone_label} sid={call.sid}'
        )
    except Exception as e:
        logger.error(f'Twilio geofence call failed for patient phone={patient_phone}: {e}')


def call_caregiver_missed_dose(caregiver_phone: str, patient_name: str, med_name: str, dose_time: str):
    """
    Places an automated voice call to the caregiver informing them of a missed dose.
    dose_time: human-readable string e.g. "08:00 AM"
    """
    if not caregiver_phone:
        logger.warning(f'Twilio call skipped — caregiver has no phone number (patient={patient_name})')
        return

    account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    auth_token  = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    from_number = getattr(settings, 'TWILIO_FROM_NUMBER', '')

    if not all([account_sid, auth_token, from_number]):
        logger.warning('Twilio credentials not configured — skipping voice call')
        return

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)

        alert_text = (
            f"Hello. This is an urgent alert from Med Adhere. "
            f"Your patient {patient_name} has missed their {med_name} dose "
            f"that was scheduled at {dose_time}. "
            f"Please check in with them as soon as possible. "
            f"I will repeat this message. "
            f"Your patient {patient_name} has missed their {med_name} dose "
            f"scheduled at {dose_time}. Thank you."
        )

        twiml = f'<Response><Say voice="alice" language="en-IN">{alert_text}</Say></Response>'

        call = client.calls.create(
            twiml=twiml,
            to=caregiver_phone,
            from_=from_number,
        )
        logger.info(
            f'Twilio call placed to caregiver phone={caregiver_phone} '
            f'patient={patient_name} med={med_name} sid={call.sid}'
        )
    except Exception as e:
        logger.error(f'Twilio call failed for caregiver phone={caregiver_phone}: {e}')
