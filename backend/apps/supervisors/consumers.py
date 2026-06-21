# backend/apps/supervisors/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer


class TriageDashboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for the real-time triage dashboard.
    Group: "triage_dashboard"
    """

    async def connect(self):
        await self.channel_layer.group_add("triage_dashboard", self.channel_name)
        await self.accept()
        # Send connection confirmation
        await self.send(json.dumps({"type": "connected", "message": "Triage dashboard live"}))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("triage_dashboard", self.channel_name)

    async def new_emergency(self, event):
        """Handler for 'new_emergency' group messages from Phase 1 API."""
        await self.send(json.dumps({
            "type":  "new_emergency",
            "data":  event["data"],
        }))

    async def case_updated(self, event):
        """Handler for status updates on existing cases."""
        await self.send(json.dumps({
            "type": "case_updated",
            "data": event["data"],
        }))

    async def patient_incoming(self, event):
        """Handler for when ambulance picks up patient and heads to hospital."""
        await self.send(json.dumps({
            "type": "patient_incoming",
            "data": event["data"],
        }))

    async def patient_arrived(self, event):
        """Handler for when ambulance arrives at hospital (trip completed)."""
        await self.send(json.dumps({
            "type": "patient_arrived",
            "data": event["data"],
        }))
