// ============================================================
// esp32_firmware.ino — MedAdhere Smart Pill Dispenser v2.1
//
// Hardware:
//   28BYJ-48 stepper  + ULN2003
//   1 kg HX711 load cell
//   DFPlayer Mini MP3 (5 audio tracks)
//   SG90 servo gate
//   HC-SR04 ultrasonic hand sensor
//   SSD1306 OLED
//   DS3231 RTC
//
// RTOS Architecture (FreeRTOS):
//   Core 0 — taskNetwork : WiFi, heartbeat, command poll, schedule poll
//   Core 1 — taskMotor   : stepper rotation (queue-driven)
//   Core 1 — taskSensor  : ultrasonic, gate, weight, dose session tracking
//
// Patient-side dose flow:
//   Backend sends commands → ROTATE_TO_COMPARTMENT → CUSTOM(READ_WEIGHT,before)
//                          → PLAY_VOICE_NOTE
//   Firmware: rotates → reads baseline weight → plays track 1
//   Patient puts hand → ultrasonic fires → lid opens → LID_OPENED event
//   Patient takes medicine → hand withdraws → lid closes → LID_CLOSED event
//   3 s settle → read after-dose weight → WEIGHT_READING(after_dose) event
//   Backend returns dose_status → play track 3 (taken) or 4 (missed/partial)
//   If 1 hr no response → DOSE_TIMEOUT event → backend sends LOCK_LID command
//   Caregiver unlocks via app → backend sends UNLOCK_LID → play track 5
// ============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "config.h"
#include "api.h"
#include "hardware.h"
#include "schedule.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

// ─────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────
enum State {
  STATE_BOOT,
  STATE_IDLE,
  STATE_FILL_MODE,
  STATE_DISPENSING,   // Rotated to compartment, waiting for hand
  STATE_GATE_OPEN,    // Gate open (servo 90°), waiting for hand to withdraw
  STATE_WEIGHT_CHECK, // Gate just closed, reading after-dose weight
  STATE_GATE_LOCKED,  // Backend locked — caregiver must unlock remotely
};

// ─────────────────────────────────────────────────────────────
// Shared State (protected by xStateMutex)
// ─────────────────────────────────────────────────────────────
volatile State deviceState       = STATE_BOOT;
volatile int   activeCompartment = -1;
volatile bool  gateLocked        = false;
volatile int   gateOpenCount     = 0;
volatile bool  alarmActive       = false;

// Active dose session ID (received from backend schedule / command response)
char activeSessionId[40] = "";

// Fill mode
char fillMedName[64]     = "";
int  fillModeCompartment = -1;

// Timestamps
unsigned long dispenseStartMs = 0;
unsigned long gateClosedAtMs  = 0;
unsigned long alarmStartMs    = 0;

// ─────────────────────────────────────────────────────────────
// RTOS Primitives
// ─────────────────────────────────────────────────────────────
SemaphoreHandle_t xStateMutex;
SemaphoreHandle_t xMotorMutex;   // held by motor task while rotating
QueueHandle_t     xMotorCmdQueue;

struct MotorCommand {
  int  targetCompartment;
  bool openLidAfter;   // true in fill mode
  char medName[64];
};

// ─────────────────────────────────────────────────────────────
// State Helpers
// ─────────────────────────────────────────────────────────────
State getState() {
  xSemaphoreTake(xStateMutex, portMAX_DELAY);
  State s = deviceState;
  xSemaphoreGive(xStateMutex);
  return s;
}

void setState(State s) {
  xSemaphoreTake(xStateMutex, portMAX_DELAY);
  deviceState = s;
  xSemaphoreGive(xStateMutex);
}

// ─────────────────────────────────────────────────────────────
// WiFi + Time
// ─────────────────────────────────────────────────────────────
void connectWiFi() {
  hw_displayMessage("Connecting WiFi", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    vTaskDelay(pdMS_TO_TICKS(500));
    Serial.print(".");
    tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected: %s\n", WiFi.localIP().toString().c_str());
    hw_displayMessage("WiFi OK", WiFi.localIP().toString());
    hw_beep(2);
  } else {
    Serial.println("\n[WiFi] FAILED — offline mode");
    hw_displayMessage("WiFi FAILED", "Offline mode");
  }
}

void syncTime() {
  configTime(19800, 0, "pool.ntp.org", "time.google.com");  // IST = UTC+5:30
  struct tm t;
  if (getLocalTime(&t, 5000)) {
    char buf[20]; strftime(buf, sizeof(buf), "%H:%M:%S", &t);
    Serial.printf("[TIME] NTP synced: %s\n", buf);
    hw_rtcSyncFromNTP();
    syncTimeWithBackend();
  } else {
    Serial.println("[TIME] NTP failed — using RTC");
  }
}

// ─────────────────────────────────────────────────────────────
// TASK 1 — Network (Core 0)
// Heartbeat, command poll, schedule poll, WiFi watchdog
// ─────────────────────────────────────────────────────────────
void taskNetwork(void* pvParam) {
  Serial.println("[RTOS] Network task started on Core 0");

  // Boot event
  hw_displayMessage("Backend boot...", "");
  StaticJsonDocument<256> bootExtra;
  bootExtra["battery_level"]    = hw_getBatteryLevel();
  bootExtra["firmware_version"] = FIRMWARE_VERSION;
  bootExtra["stepper_status"]   = hw_getStatus();
  StaticJsonDocument<512> bootResp;
  sendEvent("DEVICE_BOOT", bootExtra, bootResp);

  slot_load();  // restore cached slot after power loss
  setState(STATE_IDLE);

  unsigned long lastHeartbeat    = 0;
  unsigned long lastCommandPoll  = 0;
  unsigned long lastSchedulePoll = 0;
  unsigned long lastWifiRetry    = 0;
  unsigned long lastLowBatAlert  = 0;

  for (;;) {
    unsigned long now = millis();

    // ── WiFi Watchdog ─────────────────────────────────────────
    if (WiFi.status() != WL_CONNECTED) {
      if (now - lastWifiRetry >= WIFI_RECONNECT_MS) {
        lastWifiRetry = now;
        Serial.println("[WiFi] Lost — retrying...");
        WiFi.reconnect();
        hw_displayMessage("WiFi Lost", "Retrying...", hw_rtcGetTime());
      }
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    // ── Heartbeat (every 5 min) ───────────────────────────────
    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = now;
      int bat = hw_getBatteryLevel();
      StaticJsonDocument<256> hbBody;
      hbBody["battery_level"]    = bat;
      hbBody["firmware_version"] = FIRMWARE_VERSION;
      hbBody["wifi_strength"]    = WiFi.RSSI();
      hbBody["uptime_seconds"]   = millis() / 1000;
      StaticJsonDocument<256> hbResp;
      apiPost(API_HEARTBEAT, hbBody, hbResp);
      Serial.printf("[HB] battery=%d%%\n", bat);

      // Low battery alert (once per hour)
      if (bat < 15 && now - lastLowBatAlert >= 3600000UL) {
        lastLowBatAlert = now;
        sendLowBattery(bat);
      }
    }

    // ── Schedule Poll (every 1 min, only in IDLE) ─────────────
    if (now - lastSchedulePoll >= SCHEDULE_POLL_MS) {
      lastSchedulePoll = now;
      if (getState() == STATE_IDLE && !gateLocked) {
        StaticJsonDocument<1024> schedResp;
        int code = fetchCurrentSchedule(schedResp);
        if (code == 200) {
          bool hasDose = slot_parseFromJson(schedResp);
          if (hasDose && activeCompartment != activeSlot.compartment_number) {
            activeCompartment = activeSlot.compartment_number;
            gateOpenCount     = activeSlot.gate_open_count;
            gateLocked        = activeSlot.gate_locked;
            strlcpy(activeSessionId, activeSlot.session_id, sizeof(activeSessionId));

            if (!gateLocked) {
              MotorCommand motorCmd;
              motorCmd.targetCompartment = activeCompartment;
              motorCmd.openLidAfter      = false;
              strlcpy(motorCmd.medName, activeSlot.display_text, 64);
              xQueueSend(xMotorCmdQueue, &motorCmd, 0);
              setState(STATE_DISPENSING);
              dispenseStartMs = millis();
              alarmActive     = true;
              alarmStartMs    = millis();
              hw_beep(3, 200);
              Serial.printf("[SCHED] Active dose: compartment %d\n", activeCompartment);
            } else {
              setState(STATE_GATE_LOCKED);
              hw_displayGateLocked();
              Serial.println("[SCHED] Gate locked — awaiting caregiver unlock");
            }
          }
        }
      }
    }

    // ── Command Poll (every 10 s) ─────────────────────────────
    if (now - lastCommandPoll >= COMMAND_POLL_MS) {
      lastCommandPoll = now;
      StaticJsonDocument<2048> resp;
      int pollCode = apiGet(API_COMMANDS, resp);

      if (pollCode == 200) {
        JsonArray cmds = resp["data"]["commands"].as<JsonArray>();

        for (JsonObject cmd : cmds) {
          const char* type      = cmd["type"]       | "";
          const char* commandId = cmd["command_id"] | "";
          Serial.printf("[CMD] Received: %s\n", type);

          // ── ROTATE_TO_COMPARTMENT ────────────────────────────
          if (strcmp(type, "ROTATE_TO_COMPARTMENT") == 0) {
            int target = cmd["payload"]["target_compartment"] | 1;
            activeCompartment = target;
            MotorCommand motorCmd;
            motorCmd.targetCompartment = target;
            motorCmd.openLidAfter      = false;
            strlcpy(motorCmd.medName, "", 64);
            xQueueSend(xMotorCmdQueue, &motorCmd, 0);
            if (getState() == STATE_IDLE) {
              setState(STATE_DISPENSING);
              dispenseStartMs = millis();
              alarmActive     = true;
              alarmStartMs    = millis();
            }
          }

          // ── PLAY_VOICE_NOTE ──────────────────────────────────
          else if (strcmp(type, "PLAY_VOICE_NOTE") == 0) {
            int track = cmd["payload"]["track"] | AUDIO_DOSE_REMINDER;
            // Fallback: map text keywords to track if no track field
            if (!cmd["payload"].containsKey("track")) {
              const char* text = cmd["payload"]["text"] | "";
              if (strstr(text, "taken") || strstr(text, "shukriya"))
                track = AUDIO_DOSE_TAKEN;
              else if (strstr(text, "nahi li") || strstr(text, "missed"))
                track = AUDIO_DOSE_MISSED;
              else if (strstr(text, "unlock"))
                track = AUDIO_CAREGIVER_UNLOCK;
              else if (strstr(text, "nikaalo"))
                track = AUDIO_TAKE_MEDICINE;
              else
                track = AUDIO_DOSE_REMINDER;
            }
            hw_playTrack(track);
          }

          // ── CUSTOM — READ_WEIGHT (before_dose baseline) ──────
          else if (strcmp(type, "CUSTOM") == 0) {
            const char* action = cmd["payload"]["action"] | "";
            if (strcmp(action, "READ_WEIGHT") == 0) {
              const char* phase = cmd["payload"]["phase"] | "before_dose";
              int   compNum     = cmd["payload"]["compartment"] | activeCompartment;
              const char* sid   = cmd["payload"]["session_id"]  | activeSessionId;

              if (strcmp(phase, "before_dose") == 0) {
                // Wait for any ongoing motor rotation to finish
                xSemaphoreTake(xMotorMutex, portMAX_DELAY);
                vTaskDelay(pdMS_TO_TICKS(1500));  // let scale settle after rotation
                float w = hw_getWeightGrams();
                xSemaphoreGive(xMotorMutex);

                StaticJsonDocument<512> weightResp;
                sendWeightReading(compNum, w, "before_dose", sid, weightResp);
                Serial.printf("[CMD] Baseline weight: %.2fg (comp %d)\n", w, compNum);
              }
            }
          }

          // ── OPEN_LID (manual override from caregiver / backend) ─
          else if (strcmp(type, "OPEN_LID") == 0) {
            if (!gateLocked) {
              hw_openLid();
              sendLidOpened(activeCompartment, activeSessionId);
              setState(STATE_GATE_OPEN);
              Serial.println("[CMD] Lid opened by command");
            } else {
              hw_displayMessage("Gate LOCKED", "Cannot open", "");
            }
          }

          // ── LOCK_LID (missed dose — backend ordered lock) ────
          else if (strcmp(type, "LOCK_LID") == 0) {
            gateLocked = true;
            hw_closeLid();
            setState(STATE_GATE_LOCKED);
            hw_displayGateLocked();
            hw_alertAlarm();
            hw_playTrack(AUDIO_DOSE_MISSED);
            Serial.println("[CMD] Gate LOCKED — missed dose");
          }

          // ── UNLOCK_LID (caregiver remotely unlocked) ─────────
          else if (strcmp(type, "UNLOCK_LID") == 0) {
            gateLocked    = false;
            gateOpenCount = 0;
            hw_playTrack(AUDIO_CAREGIVER_UNLOCK);
            hw_displayMessage("Unlocked!", "Caregiver ne khola", "Dawai le lo");
            hw_beep(2, 200);
            // If a dose was still pending, re-enter dispensing state
            if (activeCompartment > 0) {
              setState(STATE_DISPENSING);
              dispenseStartMs = millis();  // reset timeout
              alarmActive     = true;
              alarmStartMs    = millis();
            } else {
              setState(STATE_IDLE);
            }
            Serial.println("[CMD] Gate UNLOCKED by caregiver");
          }

          // ── Fill Mode Commands ────────────────────────────────
          else if (strcmp(type, "START_FILL_MODE") == 0) {
            int compTarget = cmd["payload"]["compartment"] | 1;
            const char* medN = cmd["payload"]["medication_name"] | "Unknown";
            strlcpy(fillMedName, medN, sizeof(fillMedName));
            fillModeCompartment = compTarget;
            MotorCommand motorCmd;
            motorCmd.targetCompartment = compTarget;
            motorCmd.openLidAfter      = true;
            strlcpy(motorCmd.medName, medN, 64);
            xQueueSend(xMotorCmdQueue, &motorCmd, 0);
            setState(STATE_FILL_MODE);
          }

          else if (strcmp(type, "NEXT_COMPARTMENT") == 0) {
            if (getState() == STATE_FILL_MODE) {
              int compTarget = cmd["payload"]["compartment"] | (fillModeCompartment + 1);
              const char* medN = cmd["payload"]["medication_name"] | "Unknown";
              strlcpy(fillMedName, medN, sizeof(fillMedName));
              fillModeCompartment = compTarget;
              MotorCommand motorCmd;
              motorCmd.targetCompartment = compTarget;
              motorCmd.openLidAfter      = true;
              strlcpy(motorCmd.medName, medN, 64);
              xQueueSend(xMotorCmdQueue, &motorCmd, 0);
            }
          }

          else if (strcmp(type, "END_FILL_MODE") == 0) {
            hw_closeLid();
            setState(STATE_IDLE);
            fillModeCompartment = -1;
            hw_displayMessage("Fill Complete!", "All stocked", "");
            hw_beep(3, 100);
          }

          else if (strcmp(type, "READ_FILL_WEIGHT") == 0) {
            int compNum       = cmd["payload"]["compartment_number"] | 0;
            const char* medId = cmd["payload"]["medicine_id"]        | "";
            const char* medN  = cmd["payload"]["medicine_name"]      | "Medicine";
            if (compNum > 0 && strlen(medId) > 0) {
              hw_displayMessage("Measuring...", medN, "Keep still!");
              vTaskDelay(pdMS_TO_TICKS(1500));
              float w = hw_getWeightGrams();
              sendFillWeight(compNum, w, medId);
              hw_displayMessage("Weight OK!", String(w, 1) + "g", medN);
              hw_beep(2, 100);
            }
          }

          // ── Utility Commands ──────────────────────────────────
          else if (strcmp(type, "SYNC_TIME") == 0) {
            syncTime();
          }

          else if (strcmp(type, "RESET_FLAGS") == 0) {
            slot_clear();
            activeCompartment = -1;
            gateOpenCount     = 0;
            gateLocked        = false;
            alarmActive       = false;
            memset(activeSessionId, 0, sizeof(activeSessionId));
            setState(STATE_IDLE);
            hw_displayMessage("Day Reset!", "New day, fresh", "");
          }

          // Acknowledge every command
          sendCommandAck(commandId);
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ─────────────────────────────────────────────────────────────
// TASK 2 — Motor (Core 1)
// Holds xMotorMutex during rotation so network task can wait
// before reading baseline weight.
// ─────────────────────────────────────────────────────────────
void taskMotor(void* pvParam) {
  Serial.println("[RTOS] Motor task started on Core 1");
  MotorCommand cmd;

  for (;;) {
    if (xQueueReceive(xMotorCmdQueue, &cmd, portMAX_DELAY) == pdTRUE) {
      xSemaphoreTake(xMotorMutex, portMAX_DELAY);

      Serial.printf("[MOTOR] Rotating to compartment %d\n", cmd.targetCompartment);
      hw_rotateTo(cmd.targetCompartment);

      if (cmd.openLidAfter) {
        // Fill mode — open lid so technician can load medicine
        vTaskDelay(pdMS_TO_TICKS(300));
        hw_openLid();
        hw_displayFillMode(cmd.targetCompartment, cmd.medName);
        hw_beep(2, 150);
      } else {
        // Patient dose — send COMPARTMENT_ROTATED event
        sendCompartmentRotated(cmd.targetCompartment);
      }

      xSemaphoreGive(xMotorMutex);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// TASK 3 — Sensor + Gate (Core 1)
// Ultrasonic hand detection, lid tracking, weight verification,
// dose timeout escalation.
// ─────────────────────────────────────────────────────────────
void taskSensor(void* pvParam) {
  Serial.println("[RTOS] Sensor task started on Core 1");

  for (;;) {
    unsigned long now = millis();
    State curState = getState();

    switch (curState) {

      // ── IDLE — show clock ───────────────────────────────────
      case STATE_IDLE: {
        static unsigned long lastIdleUpdate = 0;
        if (now - lastIdleUpdate > 10000) {
          lastIdleUpdate = now;
          hw_displayMessage("MedAdhere Ready", hw_rtcGetTime(), "");
        }
        break;
      }

      // ── DISPENSING ─────────────────────────────────────────
      // Compartment rotated, waiting for patient's hand.
      // Dose timeout = 1 hour (DOSE_TIMEOUT_MS).
      case STATE_DISPENSING: {
        // Refresh OLED with dose info every 2 s
        static unsigned long lastDispUpdate = 0;
        if (now - lastDispUpdate > 2000) {
          lastDispUpdate = now;
          hw_displayDoseInfo(activeCompartment, activeSlot.display_text);
        }

        // 1-hour timeout → send DOSE_TIMEOUT, play missed audio
        if (now - dispenseStartMs >= DOSE_TIMEOUT_MS) {
          hw_closeLid();
          sendDoseTimeout(activeCompartment);
          hw_playTrack(AUDIO_DOSE_MISSED);
          hw_alertAlarm();
          hw_displayMessage("DOSE TIMEOUT", "Alerting caregiver", "");
          slot_clear();
          activeCompartment = -1;
          gateOpenCount     = 0;
          alarmActive       = false;
          memset(activeSessionId, 0, sizeof(activeSessionId));
          setState(STATE_IDLE);
          break;
        }

        // Hand detected → open lid immediately (no wait for backend command)
        if (!gateLocked && hw_isHandDetected()) {
          gateOpenCount++;

          // Inform backend BEFORE opening lid
          sendHandDetected(activeCompartment, activeSessionId);

          hw_openLid();
          hw_playTrack(AUDIO_TAKE_MEDICINE);
          sendLidOpened(activeCompartment, activeSessionId);

          setState(STATE_GATE_OPEN);
          Serial.printf("[SENSOR] Lid opened (open count=%d)\n", gateOpenCount);
          hw_beep(1, 100);
        }
        break;
      }

      // ── GATE_OPEN ──────────────────────────────────────────
      // Gate is open. Wait for hand to withdraw, then close lid.
      case STATE_GATE_OPEN: {
        // Debounce: both reads must show no hand
        if (!hw_isHandDetected()) {
          vTaskDelay(pdMS_TO_TICKS(500));
          if (!hw_isHandDetected()) {
            hw_closeLid();
            gateClosedAtMs = millis();
            sendLidClosed(activeCompartment, activeSessionId);
            Serial.println("[SENSOR] Lid closed — starting weight check");
            setState(STATE_WEIGHT_CHECK);
          }
        }

        // Safety timeout — force close if gate open too long
        if (now - dispenseStartMs >= DOSE_TIMEOUT_MS) {
          hw_closeLid();
          sendLidClosed(activeCompartment, activeSessionId);
          setState(STATE_WEIGHT_CHECK);
        }
        break;
      }

      // ── WEIGHT_CHECK ───────────────────────────────────────
      // Wait GATE_CLOSE_CONFIRM_MS for scale to settle, then
      // read after-dose weight and report to backend.
      case STATE_WEIGHT_CHECK: {
        if (now - gateClosedAtMs < GATE_CLOSE_CONFIRM_MS) break;

        float weightGrams = hw_getWeightGrams();
        Serial.printf("[SENSOR] After-dose weight: %.2fg (comp %d)\n",
                      weightGrams, activeCompartment);

        StaticJsonDocument<512> weightResp;
        int wCode = sendWeightReading(
          activeCompartment, weightGrams,
          "after_dose", activeSessionId, weightResp
        );

        if (wCode == 200 || wCode == 201) {
          // Backend returns dose_status inside response_data
          const char* doseStatus =
            weightResp["data"]["response_data"]["dose_status"] | "unknown";
          Serial.printf("[SENSOR] dose_status: %s\n", doseStatus);

          hw_displayDoseResult(doseStatus);

          if (strcmp(doseStatus, "taken") == 0) {
            hw_playTrack(AUDIO_DOSE_TAKEN);
            hw_beep(3, 100);
          } else if (strcmp(doseStatus, "partial") == 0) {
            // Partial — wait, don't clear slot yet (session still open)
            hw_beep(2, 300);
          } else {
            // unknown / no_baseline — keep waiting
            hw_beep(1, 500);
          }

          // Only clear the active slot if dose is fully confirmed taken
          if (strcmp(doseStatus, "taken") == 0) {
            slot_clear();
            activeCompartment = -1;
            gateOpenCount     = 0;
            alarmActive       = false;
            memset(activeSessionId, 0, sizeof(activeSessionId));
            setState(STATE_IDLE);
            vTaskDelay(pdMS_TO_TICKS(3000));  // show result for 3 s
          } else {
            // Partial or unknown: go back to DISPENSING to keep waiting
            setState(STATE_DISPENSING);
          }
        } else {
          // Weight send failed — go back to dispensing, try again later
          Serial.println("[SENSOR] Weight send failed — retrying dispensing");
          setState(STATE_DISPENSING);
        }
        break;
      }

      // ── GATE_LOCKED ─────────────────────────────────────────
      // Beep every 30 s to remind patient, show locked screen.
      case STATE_GATE_LOCKED: {
        static unsigned long lastLockBeep = 0;
        if (now - lastLockBeep > 30000) {
          lastLockBeep = now;
          hw_beep(2, 300);
          hw_displayGateLocked();
        }
        break;
      }

      // ── FILL_MODE ───────────────────────────────────────────
      case STATE_FILL_MODE: {
        static unsigned long lastFillBlink = 0;
        if (now - lastFillBlink > 5000) {
          lastFillBlink = now;
          hw_displayFillMode(fillModeCompartment, fillMedName);
        }
        break;
      }

      default: break;
    }

    // Periodic alarm beep during dispensing window
    if (alarmActive && (now - alarmStartMs) % 10000 < 200) {
      hw_beep(1, 200);
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n[BOOT] MedAdhere Pill Dispenser v" FIRMWARE_VERSION);
  Serial.printf("[BOOT] Compile-time DEVICE_ID: %s\n", DEVICE_ID);

  hw_initAll();

  Serial.printf("[BOOT] Active/provisioned device ID: %s\n", activeDeviceId());
  if (strcmp(activeDeviceId(), DEVICE_ID) != 0) {
    Serial.printf("[BOOT][WARN] activeDeviceId() != config.h DEVICE_ID (stale flash/NVS mismatch?)\n");
  }

  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) syncTime();
  else slot_load();

  xStateMutex    = xSemaphoreCreateMutex();
  xMotorMutex    = xSemaphoreCreateMutex();
  xMotorCmdQueue = xQueueCreate(5, sizeof(MotorCommand));

  // Core 0: Network (stack 8 kB, priority 1)
  xTaskCreatePinnedToCore(taskNetwork, "NetworkTask", 8192, NULL, 1, NULL, 0);
  // Core 1: Motor (stack 4 kB, priority 3 — highest so rotation isn't interrupted)
  xTaskCreatePinnedToCore(taskMotor,   "MotorTask",   4096, NULL, 3, NULL, 1);
  // Core 1: Sensor (stack 6 kB, priority 2)
  xTaskCreatePinnedToCore(taskSensor,  "SensorTask",  6144, NULL, 2, NULL, 1);

  Serial.println("[BOOT] All RTOS tasks launched");
  Serial.println("[BOOT] 4-compartment dispenser ready");
}

void loop() {
  // All work done in RTOS tasks
  vTaskDelay(pdMS_TO_TICKS(10000));
}
