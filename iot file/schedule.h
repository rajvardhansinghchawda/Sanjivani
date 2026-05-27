// ============================================================
// schedule.h — Active dose slot cache for MedAdhere v2
// Architecture change: backend drives scheduling entirely.
// ESP32 polls /dispenser/schedule/current/ to check if a dose
// is active right now. No local time-matching logic needed.
// ============================================================
#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ── Active dose slot (populated from backend response) ─────
struct ActiveDoseSlot {
  bool  active;
  int   compartment_number;          // 1–4
  char  voice_text[256];             // For buzzer/serial announcement
  char  display_text[128];           // For OLED (max 4 lines × ~20 chars)
  char  session_id[40];              // DoseSession UUID (for reference)
  int   gate_open_count;             // How many times gate opened this session
  bool  gate_locked;                 // True if backend locked this session
};

ActiveDoseSlot activeSlot = { false, 0, "", "", "", 0, false };

// ── Cached last-known compartment info (for offline OLED) ──
struct CompartmentCache {
  int   compartment_number;
  char  time_slot[20];               // e.g. "morning_before"
  char  display_text[128];
};

#define CACHE_SIZE 4
CompartmentCache compartmentCache[CACHE_SIZE];
bool cacheLoaded = false;

// ── Preferences namespace ──────────────────────────────────
Preferences slotPrefs;

void slot_save() {
  slotPrefs.begin("active_slot", false);
  slotPrefs.putBool("active",    activeSlot.active);
  slotPrefs.putInt("comp",       activeSlot.compartment_number);
  slotPrefs.putString("voice",   activeSlot.voice_text);
  slotPrefs.putString("display", activeSlot.display_text);
  slotPrefs.putString("session", activeSlot.session_id);
  slotPrefs.end();
}

void slot_load() {
  slotPrefs.begin("active_slot", true);
  activeSlot.active             = slotPrefs.getBool("active", false);
  activeSlot.compartment_number = slotPrefs.getInt("comp", 0);
  String v = slotPrefs.getString("voice",   "");
  String d = slotPrefs.getString("display", "");
  String s = slotPrefs.getString("session", "");
  strlcpy(activeSlot.voice_text,   v.c_str(), sizeof(activeSlot.voice_text));
  strlcpy(activeSlot.display_text, d.c_str(), sizeof(activeSlot.display_text));
  strlcpy(activeSlot.session_id,   s.c_str(), sizeof(activeSlot.session_id));
  slotPrefs.end();
  cacheLoaded = true;
}

void slot_clear() {
  activeSlot.active             = false;
  activeSlot.compartment_number = 0;
  activeSlot.gate_open_count    = 0;
  activeSlot.gate_locked        = false;
  memset(activeSlot.voice_text,   0, sizeof(activeSlot.voice_text));
  memset(activeSlot.display_text, 0, sizeof(activeSlot.display_text));
  memset(activeSlot.session_id,   0, sizeof(activeSlot.session_id));
  slot_save();
}

// ── Parse backend /dispenser/schedule/current/ response ───
// Returns true if there is an active dose right now
bool slot_parseFromJson(JsonDocument& doc) {
  JsonObject data = doc["data"];
  if (data.isNull()) return false;

  bool active = data["active"] | false;
  if (!active) {
    slot_clear();
    return false;
  }

  activeSlot.active             = true;
  activeSlot.compartment_number = data["compartment_number"] | 0;
  activeSlot.gate_open_count    = data["gate_open_count"]    | 0;
  activeSlot.gate_locked        = data["gate_locked"]        | false;

  const char* vt = data["voice_text"]   | "";
  const char* dt = data["display_text"] | "";
  const char* sid = data["session_id"]  | "";
  strlcpy(activeSlot.voice_text,   vt,  sizeof(activeSlot.voice_text));
  strlcpy(activeSlot.display_text, dt,  sizeof(activeSlot.display_text));
  strlcpy(activeSlot.session_id,   sid, sizeof(activeSlot.session_id));

  slot_save();
  Serial.printf("[SCHED] Active dose: comp %d, gate_opens=%d, locked=%d\n",
    activeSlot.compartment_number, activeSlot.gate_open_count, activeSlot.gate_locked);
  return true;
}
