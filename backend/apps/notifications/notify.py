# apps/notifications/notify.py
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_driver_new_request(ambulance_id, request_obj):
    """
    Pushes a new_request notification to the driver's WebSocket.
    Call this from BookAmbulanceView after creating AmbulanceRequest.

    ambulance_id : str UUID of the ambulance
    request_obj  : AmbulanceRequest model instance
    """
    channel_layer = get_channel_layer()
    group_name    = f'ambulance_{str(ambulance_id).replace("-", "_")}'

    destination = (
        request_obj.destination_hospital.name
        if request_obj.destination_hospital
        else 'Not specified'
    )

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type'          : 'new_request',      # maps to consumer.new_request()
            'request_id'    : str(request_obj.id),
            'patient_name'  : request_obj.requester_name,
            'patient_phone' : request_obj.requester_phone,
            'pickup_address': request_obj.pickup_address,
            'pickup_lat'    : str(request_obj.pickup_latitude  or ''),
            'pickup_lng'    : str(request_obj.pickup_longitude or ''),
            'destination'   : destination,
            'ambulance_type': request_obj.ambulance_type,
        }
    )


def notify_driver_trip_update(ambulance_id, request_id, status, message=''):
    """
    Pushes a trip status update to the driver.
    Call this when a supervisor overrides or cancels a trip.
    """
    channel_layer = get_channel_layer()
    group_name    = f'ambulance_{str(ambulance_id).replace("-", "_")}'

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type'      : 'trip_update',
            'request_id': str(request_id),
            'status'    : status,
            'message'   : message,
        }
    )