# apps/notifications/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class AmbulanceDriverConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for ambulance drivers.

    Connection URL:
      ws://your-domain/ws/ambulance/driver/<ambulance_id>/?token=<jwt>

    Messages the driver receives:
      - new_request   : a new ambulance booking assigned to them
      - trip_update   : status change on their active trip
      - ping          : keepalive heartbeat

    Messages the driver can send:
      - pong          : heartbeat response
    """

    async def connect(self):
        self.ambulance_id = self.scope['url_route']['kwargs']['ambulance_id']
        self.user         = self.scope.get('user')

        # reject unauthenticated connections
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        # reject if the driver doesn't own this ambulance
        owns = await self.driver_owns_ambulance(self.user, self.ambulance_id)
        if not owns:
            await self.close(code=4003)
            return

        # join the driver's personal channel group
        # group name: ambulance_<uuid_no_dashes>
        self.group_name = f'ambulance_{self.ambulance_id.replace("-", "_")}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

        # send a welcome message so driver knows connection is live
        await self.send(text_data=json.dumps({
            'type'        : 'connected',
            'ambulance_id': self.ambulance_id,
            'message'     : 'Connected — waiting for requests',
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle messages FROM the driver (e.g. pong heartbeat)."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')

        if msg_type == 'pong':
            # driver is still alive — no action needed
            pass
        elif msg_type in ['driver_arrived', 'patient_picked_up']:
            case_id = data.get('case_id')
            if case_id:
                # Forward to patient group
                import logging
                logging.getLogger(__name__).info(f"Driver event {msg_type} for case {case_id}")
                patient_group = f'patient_{case_id.replace("-", "_")}'
                await self.channel_layer.group_send(
                    patient_group,
                    {
                        'type': msg_type,
                        'message': data.get('message', '')
                    }
                )
                
                # If patient picked up, we can optionally update DB status here or via REST API.
                # We'll use REST API as primary, but doing it via WS is also fine.

    # ── Message handlers (called by channel_layer.group_send) ─

    async def new_request(self, event):
        """
        Pushes a new ambulance booking notification to the driver.
        Triggered by BookAmbulanceView after creating the request.
        """
        await self.send(text_data=json.dumps({
            'type'       : 'new_request',
            'request_id' : event['request_id'],
            'patient_name'   : event['patient_name'],
            'patient_phone'  : event['patient_phone'],
            'pickup_address' : event['pickup_address'],
            'pickup_lat'     : event['pickup_lat'],
            'pickup_lng'     : event['pickup_lng'],
            'destination'    : event['destination'],
            'ambulance_type' : event['ambulance_type'],
            'message'        : 'New ambulance request assigned to you',
        }))

    async def trip_update(self, event):
        """
        Notifies driver of any external change to their trip
        (e.g. patient cancelled, supervisor override).
        """
        await self.send(text_data=json.dumps({
            'type'      : 'trip_update',
            'request_id': event['request_id'],
            'status'    : event['status'],
            'message'   : event.get('message', 'Trip status updated'),
        }))

    async def ping(self, event):
        """Server-side heartbeat."""
        await self.send(text_data=json.dumps({'type': 'ping'}))

    async def dispatch_assigned(self, event):
        """
        Pushes emergency dispatch to driver's portal.
        """
        await self.send(text_data=json.dumps({
            'type': 'dispatch_assigned',
            'case_id': event.get('case_id'),
            'request_id': event.get('request_id'),
            'severity': event.get('severity'),
            'patient_name': event.get('patient_name'),
            'patient_phone': event.get('patient_phone'),
            'patient_lat': event.get('patient_lat'),
            'patient_lng': event.get('patient_lng'),
            'hospital_name': event.get('hospital_name'),
            'hospital_lat': event.get('hospital_lat'),
            'hospital_lng': event.get('hospital_lng'),
            'routing_explanation': event.get('routing_explanation'),
            'eta_to_patient_minutes': event.get('eta_to_patient_minutes')
        }))

    async def dispatch_pending(self, event):
        """
        Pushes a pending dispatch request to the driver's portal for accept/reject.
        """
        await self.send(text_data=json.dumps({
            'type': 'dispatch_pending',
            'case_id': event.get('case_id'),
            'request_id': event.get('request_id'),
            'severity': event.get('severity'),
            'patient_name': event.get('patient_name'),
            'patient_phone': event.get('patient_phone'),
            'patient_lat': event.get('patient_lat'),
            'patient_lng': event.get('patient_lng'),
            'hospital_name': event.get('hospital_name'),
            'hospital_lat': event.get('hospital_lat'),
            'hospital_lng': event.get('hospital_lng'),
            'routing_explanation': event.get('routing_explanation'),
            'eta_to_patient_minutes': event.get('eta_to_patient_minutes')
        }))

    # ── DB helpers ────────────────────────────────────────────

    @database_sync_to_async
    def driver_owns_ambulance(self, user, ambulance_id):
        from apps.ambulances.models import Ambulance
        # admin and supervisor can connect to any ambulance channel
        if user.role in ['admin', 'supervisor']:
            return True
        try:
            return str(user.ambulance.id) == str(ambulance_id)
        except Exception:
            return False