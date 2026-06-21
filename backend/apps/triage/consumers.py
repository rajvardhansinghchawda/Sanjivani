import json
from channels.generic.websocket import AsyncWebsocketConsumer

class PatientTriageConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for the patient side of an emergency case.
    Listens for updates about ambulance dispatch and arrival.
    
    Connection URL:
      ws://your-domain/ws/triage/patient/<case_id>/
    """

    async def connect(self):
        self.case_id = self.scope['url_route']['kwargs']['case_id']
        
        # Join the patient's case channel group
        # group name: patient_<case_id_no_dashes>
        self.group_name = f'patient_{self.case_id.replace("-", "_")}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        # Patient client doesn't need to send messages currently.
        pass

    # ── Message handlers (called by channel_layer.group_send) ─

    async def dispatch_assigned(self, event):
        """Ambulance driver has been assigned and is en route to patient."""
        await self.send(text_data=json.dumps({
            'type': 'dispatch_assigned',
            'ambulance_id': event.get('ambulance_id'),
            'driver_name': event.get('driver_name'),
            'vehicle_number': event.get('vehicle_number'),
            'eta_minutes': event.get('eta_to_patient_minutes')
        }))

    async def driver_arrived(self, event):
        """Driver pushed 'Arrived at patient location' button."""
        await self.send(text_data=json.dumps({
            'type': 'driver_arrived',
            'message': 'Your ambulance is outside!'
        }))

    async def patient_picked_up(self, event):
        """Driver pushed 'Patient Picked Up' button and is heading to hospital."""
        await self.send(text_data=json.dumps({
            'type': 'patient_picked_up',
            'message': 'Heading to hospital'
        }))
