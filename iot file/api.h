// ============================================================
// api.h — HTTP client helpers for MedAdhere backend v2.1
//
// All device events go through ONE standard endpoint:
//   POST /api/v1/iot/events/
//   Body: { event_uuid, event_type, ...extra fields }
//
// Backend returns:
//   { "data": { ...event fields, "response_data": { ... } } }
//   For WEIGHT_READING, response_data contains { "dose_status": "taken|partial|..." }
// ============================================================
#pragma once
#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

// ─────────────────────────────────────────────────────────────
// UUID v4 Generator (pseudo-random, ESP32 hardware RNG)
// ─────────────────────────────────────────────────────────────
String generateUUID() {
  char uuid[37];
  const char* hex = "0123456789abcdef";
  uint8_t buf[16];
  esp_fill_random(buf, 16);
  // Set version 4 and variant bits
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  int i = 0, j = 0;
  for (; i < 16; i++) {
    if (i == 4 || i == 6 || i == 8 || i == 10) uuid[j++] = '-';
    uuid[j++] = hex[(buf[i] >> 4) & 0xf];
    uuid[j++] = hex[buf[i] & 0xf];
  }
  uuid[36] = '\0';
  return String(uuid);
}

// ─────────────────────────────────────────────────────────────
// HTTP Helpers
// ─────────────────────────────────────────────────────────────
int apiPost(const char* endpoint, JsonDocument& body, JsonDocument& responseDoc) {
  HTTPClient http;
  String url = String(BACKEND_URL) + endpoint;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.setTimeout(8000);

  String payload;
  serializeJson(body, payload);

  int code = http.POST(payload);
  if (code == 200 || code == 201) {
    String resp = http.getString();
    deserializeJson(responseDoc, resp);
  }
  http.end();
  return code;
}

int apiGet(const char* endpoint, JsonDocument& responseDoc) {
  HTTPClient http;
  String url = String(BACKEND_URL) + endpoint;
  http.begin(url);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.setTimeout(8000);

  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    deserializeJson(responseDoc, resp);
  }
  http.end();
  return code;
}

// ─────────────────────────────────────────────────────────────
// Core Event Sender
// Sends any event to POST /api/v1/iot/events/
// extra = additional fields to merge into the body
// Returns HTTP code; fills responseDoc with backend response
// ─────────────────────────────────────────────────────────────
int sendEvent(const char* eventType, JsonDocument& extra, JsonDocument& responseDoc) {
  StaticJsonDocument<512> body;
  body["event_uuid"]       = generateUUID();
  body["event_type"]       = eventType;
  body["firmware_version"] = FIRMWARE_VERSION;
  for (JsonPair kv : extra.as<JsonObject>()) {
    body[kv.key()] = kv.value();
  }
  int code = apiPost(API_EVENTS, body, responseDoc);
  Serial.printf("[API] sendEvent(%s) → HTTP %d\n", eventType, code);
  return code;
}

// ─────────────────────────────────────────────────────────────
// Specific Event Senders
// ─────────────────────────────────────────────────────────────

// COMPARTMENT_ROTATED — sent after motor completes rotation
int sendCompartmentRotated(int compartmentNum) {
  StaticJsonDocument<128> extra;
  extra["compartment_num"] = compartmentNum;
  StaticJsonDocument<256> resp;
  return sendEvent("COMPARTMENT_ROTATED", extra, resp);
}

// HAND_DETECTED — sent when ultrasonic sensor fires
int sendHandDetected(int compartmentNum, const char* sessionId = "") {
  StaticJsonDocument<128> extra;
  extra["compartment_num"] = compartmentNum;
  if (strlen(sessionId) > 0) extra["session_id"] = sessionId;
  StaticJsonDocument<256> resp;
  return sendEvent("HAND_DETECTED", extra, resp);
}

// LID_OPENED — sent when servo opens the gate
int sendLidOpened(int compartmentNum, const char* sessionId = "") {
  StaticJsonDocument<128> extra;
  extra["compartment_num"] = compartmentNum;
  if (strlen(sessionId) > 0) extra["session_id"] = sessionId;
  StaticJsonDocument<256> resp;
  return sendEvent("LID_OPENED", extra, resp);
}

// LID_CLOSED — sent when servo closes the gate
int sendLidClosed(int compartmentNum, const char* sessionId = "") {
  StaticJsonDocument<128> extra;
  extra["compartment_num"] = compartmentNum;
  if (strlen(sessionId) > 0) extra["session_id"] = sessionId;
  StaticJsonDocument<256> resp;
  return sendEvent("LID_CLOSED", extra, resp);
}

// WEIGHT_READING — send weight to backend with phase label
// phase: "before_dose" (baseline) or "after_dose" (verification)
// Returns HTTP code; fills responseDoc.
// For after_dose: check responseDoc["data"]["response_data"]["dose_status"]
int sendWeightReading(int compartmentNum, float weightGrams,
                      const char* phase, const char* sessionId,
                      JsonDocument& responseDoc) {
  StaticJsonDocument<256> extra;
  extra["compartment_num"] = compartmentNum;
  extra["weight_grams"]    = weightGrams;
  extra["phase"]           = phase;
  if (strlen(sessionId) > 0) extra["session_id"] = sessionId;
  int code = sendEvent("WEIGHT_READING", extra, responseDoc);
  Serial.printf("[API] Weight %.2fg (%s) → HTTP %d\n", weightGrams, phase, code);
  return code;
}

// DOSE_TIMEOUT — firmware-side 1-hour timeout
int sendDoseTimeout(int compartmentNum) {
  StaticJsonDocument<128> extra;
  extra["compartment_num"] = compartmentNum;
  StaticJsonDocument<256> resp;
  return sendEvent("DOSE_TIMEOUT", extra, resp);
}

// LOW_BATTERY — battery below threshold
int sendLowBattery(int batteryPct) {
  StaticJsonDocument<128> extra;
  extra["battery_level"] = batteryPct;
  StaticJsonDocument<256> resp;
  return sendEvent("LOW_BATTERY", extra, resp);
}

// COMMAND_ACKNOWLEDGED — confirm receipt of a backend command
int sendCommandAck(const char* commandId) {
  StaticJsonDocument<128> extra;
  extra["command_id"] = commandId;
  StaticJsonDocument<256> resp;
  return sendEvent("COMMAND_ACKNOWLEDGED", extra, resp);
}

// ─────────────────────────────────────────────────────────────
// Schedule Poll
// GET /api/v1/iot/devices/{id}/dispenser/schedule/current/
// Response: { "data": { "active": true, "compartment_number": 2,
//             "voice_text": "...", "display_text": "...",
//             "session_id": "...", "gate_open_count": 0,
//             "gate_locked": false } }
// ─────────────────────────────────────────────────────────────
int fetchCurrentSchedule(JsonDocument& responseDoc) {
  int code = apiGet(API_SCHEDULE, responseDoc);
  Serial.printf("[API] Schedule fetch → HTTP %d\n", code);
  return code;
}

// ─────────────────────────────────────────────────────────────
// Time Sync
// ─────────────────────────────────────────────────────────────
int syncTimeWithBackend() {
  StaticJsonDocument<256> resp;
  int code = apiGet(API_SYNC_TIME, resp);
  if (code == 200) {
    long ts = resp["data"]["unix_timestamp"] | 0L;
    if (ts > 0) {
      struct timeval tv;
      tv.tv_sec  = (time_t)ts;
      tv.tv_usec = 0;
      settimeofday(&tv, nullptr);
      Serial.printf("[API] Time synced from backend: %ld\n", ts);
    }
  }
  return code;
}

// ─────────────────────────────────────────────────────────────
// Fill Mode — weight reading during medicine loading
// ─────────────────────────────────────────────────────────────
int sendFillWeight(int compartmentNumber, float weightGrams, const char* medicineId) {
  StaticJsonDocument<256> body;
  body["compartment_number"] = compartmentNumber;
  body["weight_grams"]       = weightGrams;
  body["medicine_id"]        = medicineId;
  StaticJsonDocument<512> resp;
  int code = apiPost("/api/v1/iot/events/fill-weight/", body, resp);
  if (code == 200 || code == 201) {
    float pillWeight = resp["data"]["pill_weight_grams"] | 0.0f;
    Serial.printf("[API] Fill weight OK: %.4fg per pill\n", pillWeight);
  }
  return code;
}
