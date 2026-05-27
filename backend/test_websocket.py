"""
WebSocket + Patient-Caregiver Communication Test
================================================
Tests the full flow:
  1. HTTP server reachable
  2. Patient login → JWT token
  3. Caregiver login → JWT token
  4. Create/get chat room via REST
  5. Both users connect via WebSocket
  6. Patient sends a message
  7. Caregiver receives it
  8. Caregiver replies
  9. Patient receives the reply

Usage:
  pip install websockets requests
  python test_websocket.py

Edit PATIENT_EMAIL/PASSWORD and CAREGIVER_EMAIL/PASSWORD to match
credentials that already exist in your local database.
"""

import asyncio
import json
import sys
import requests
import websockets

# ─── CONFIG ────────────────────────────────────────────────────────────────────
BASE_URL  = "http://127.0.0.1:8000"
WS_BASE   = "ws://127.0.0.1:8000"

PATIENT_EMAIL    = "patient@test.com"
PATIENT_PASSWORD = "Test@1234"

CAREGIVER_EMAIL    = "caregiver@test.com"
CAREGIVER_PASSWORD = "Test@1234"


# ─── HELPERS ───────────────────────────────────────────────────────────────────
def ok(msg):  print(f"  \033[92m✓\033[0m  {msg}")
def fail(msg): print(f"  \033[91m✗\033[0m  {msg}"); sys.exit(1)
def info(msg): print(f"  \033[94m→\033[0m  {msg}")
def header(msg): print(f"\n\033[1m{msg}\033[0m")


def http_login(email, password, label):
    """Login via REST and return access token."""
    resp = requests.post(
        f"{BASE_URL}/api/v1/auth/login/",
        json={"email": email, "password": password},
        timeout=10,
    )
    if resp.status_code != 200:
        fail(f"{label} login failed — HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    token = data.get("data", {}).get("access")
    if not token:
        fail(f"{label} login response missing access token: {resp.text[:200]}")
    ok(f"{label} login OK")
    return token


def get_or_create_room(patient_token, caregiver_token):
    """POST /api/v1/communications/rooms/ as caregiver to get room with patient."""
    # First need patient's user profile to get patient_id
    resp = requests.get(
        f"{BASE_URL}/api/v1/users/me/",
        headers={"Authorization": f"Bearer {patient_token}"},
        timeout=10,
    )
    if resp.status_code != 200:
        fail(f"Could not fetch patient profile — HTTP {resp.status_code}: {resp.text[:200]}")

    patient_data = resp.json().get("data", {})
    patient_profile_id = patient_data.get("patient_profile_id") or patient_data.get("profile_id")

    if not patient_profile_id:
        # Try nested
        patient_profile_id = patient_data.get("profile", {}).get("id")

    if not patient_profile_id:
        info(f"Patient profile response: {json.dumps(patient_data, indent=2)[:400]}")
        fail("Could not extract patient profile ID — check field name above")

    info(f"Patient profile ID: {patient_profile_id}")

    resp = requests.post(
        f"{BASE_URL}/api/v1/communications/rooms/",
        json={"patient_id": patient_profile_id},
        headers={"Authorization": f"Bearer {caregiver_token}"},
        timeout=10,
    )
    if resp.status_code not in (200, 201):
        fail(f"Room create failed — HTTP {resp.status_code}: {resp.text[:300]}")

    room_id = resp.json().get("data", {}).get("id")
    if not room_id:
        fail(f"Room response missing ID: {resp.text[:200]}")

    ok(f"Chat room ready: {room_id}")
    return room_id


# ─── WEBSOCKET TEST ────────────────────────────────────────────────────────────
async def run_ws_test(room_id, patient_token, caregiver_token):
    patient_url   = f"{WS_BASE}/ws/chat/{room_id}/?token={patient_token}"
    caregiver_url = f"{WS_BASE}/ws/chat/{room_id}/?token={caregiver_token}"

    # Results collected across both connections
    results = {"caregiver_got_patient_msg": False, "patient_got_caregiver_reply": False}

    async def patient_session(ws):
        """Patient: wait for history, send a message, then wait for caregiver reply."""
        # Receive history frame
        raw = await asyncio.wait_for(ws.recv(), timeout=5)
        frame = json.loads(raw)
        assert frame["type"] == "history", f"Expected history, got {frame['type']}"
        ok(f"Patient received history ({len(frame['messages'])} messages)")

        # Send a test message
        await ws.send(json.dumps({"type": "message", "content": "Hello from patient!"}))
        ok("Patient sent: 'Hello from patient!'")

        # Wait for caregiver's reply (skip echo of own message)
        deadline = asyncio.get_event_loop().time() + 8
        while asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                continue
            frame = json.loads(raw)
            if frame.get("type") == "message" and not frame.get("is_own"):
                ok(f"Patient received caregiver reply: '{frame['content']}'")
                results["patient_got_caregiver_reply"] = True
                return
        fail("Patient did NOT receive caregiver's reply within 8s")

    async def caregiver_session(ws):
        """Caregiver: wait for history, wait for patient message, reply."""
        # Receive history frame
        raw = await asyncio.wait_for(ws.recv(), timeout=5)
        frame = json.loads(raw)
        assert frame["type"] == "history", f"Expected history, got {frame['type']}"
        ok(f"Caregiver received history ({len(frame['messages'])} messages)")

        # Wait for patient's message
        deadline = asyncio.get_event_loop().time() + 8
        while asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                continue
            frame = json.loads(raw)
            if frame.get("type") == "message" and not frame.get("is_own"):
                ok(f"Caregiver received patient message: '{frame['content']}'")
                results["caregiver_got_patient_msg"] = True
                # Reply
                await ws.send(json.dumps({"type": "message", "content": "Hi patient, got your message!"}))
                ok("Caregiver replied: 'Hi patient, got your message!'")
                return
        fail("Caregiver did NOT receive patient's message within 8s")

    header("Step 5 — WebSocket connections")
    async with websockets.connect(patient_url) as patient_ws, \
               websockets.connect(caregiver_url) as caregiver_ws:
        ok("Both WebSocket connections established")
        # Run both sessions concurrently
        await asyncio.gather(
            patient_session(patient_ws),
            caregiver_session(caregiver_ws),
        )

    return results


# ─── TYPING INDICATOR TEST ─────────────────────────────────────────────────────
async def test_typing(room_id, patient_token, caregiver_token):
    """Patient sends typing indicator; caregiver receives it."""
    patient_url   = f"{WS_BASE}/ws/chat/{room_id}/?token={patient_token}"
    caregiver_url = f"{WS_BASE}/ws/chat/{room_id}/?token={caregiver_token}"

    got_typing = {"value": False}

    async def p(ws):
        await asyncio.wait_for(ws.recv(), timeout=5)   # history
        await ws.send(json.dumps({"type": "typing", "is_typing": True}))

    async def c(ws):
        await asyncio.wait_for(ws.recv(), timeout=5)   # history
        deadline = asyncio.get_event_loop().time() + 5
        while asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=2)
            except asyncio.TimeoutError:
                continue
            frame = json.loads(raw)
            if frame.get("type") == "typing":
                got_typing["value"] = True
                return

    async with websockets.connect(patient_url) as pw, \
               websockets.connect(caregiver_url) as cw:
        await asyncio.gather(p(pw), c(cw))

    if got_typing["value"]:
        ok("Typing indicator delivered to caregiver")
    else:
        info("Typing indicator NOT received (non-fatal — message delivery already verified)")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
async def main():
    header("Step 1 — HTTP server reachability")
    try:
        r = requests.get(f"{BASE_URL}/api/v1/schema/", timeout=5)
        ok(f"Server reachable — HTTP {r.status_code}")
    except Exception as e:
        fail(f"Server not reachable at {BASE_URL}: {e}\n"
             "  Make sure daphne is running:\n"
             "  daphne -b 127.0.0.1 -p 8000 config.asgi:application")

    header("Step 2 — Patient login")
    patient_token = http_login(PATIENT_EMAIL, PATIENT_PASSWORD, "Patient")

    header("Step 3 — Caregiver login")
    caregiver_token = http_login(CAREGIVER_EMAIL, CAREGIVER_PASSWORD, "Caregiver")

    header("Step 4 — Get/create chat room")
    room_id = get_or_create_room(patient_token, caregiver_token)

    results = await run_ws_test(room_id, patient_token, caregiver_token)

    header("Step 6 — Typing indicator test")
    await test_typing(room_id, patient_token, caregiver_token)

    header("─── RESULTS ───")
    if results["caregiver_got_patient_msg"] and results["patient_got_caregiver_reply"]:
        print("\n  \033[92m\033[1mALL TESTS PASSED\033[0m — WebSocket + patient↔caregiver communication is working.\n")
    else:
        print("\n  \033[91m\033[1mSOME TESTS FAILED\033[0m")
        if not results["caregiver_got_patient_msg"]:
            print("  ✗ Caregiver did not receive patient message")
        if not results["patient_got_caregiver_reply"]:
            print("  ✗ Patient did not receive caregiver reply")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
