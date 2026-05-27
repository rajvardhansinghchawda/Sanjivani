# MedAdhere ESP32 Firmware — Setup & Connection Guide

## 📦 Required Libraries (Arduino IDE mein install karo)

| Library | Install Name | Version |
|---------|-------------|---------|
| ArduinoJson | `ArduinoJson` by bblanchon | v7.x |
| ESP32Servo | `ESP32Servo` by Kevin Harrington | latest |
| Adafruit SSD1306 | `Adafruit SSD1306` | latest |
| Adafruit GFX | `Adafruit GFX Library` | latest |
| **RTClib** | `RTClib` by Adafruit | **v2.x** ← NEW |

**Install karne ka step:** Arduino IDE → Tools → Manage Libraries → naam likhke install karo

---

## ⚙️ Arduino IDE Settings

```
Board:     ESP32 Dev Module
Port:      COM3 (ya jo bhi dikhaye)
Upload Speed: 921600
Flash Size: 4MB (32Mb)
Partition Scheme: Default 4MB with spiffs
```

---

## 🔌 Hardware Wiring

```
ESP32 Pin    →   Component
─────────────────────────────────────────
─ 28BYJ-48 Stepper (ULN2003) ────────────────────
GPIO 18      →   ULN2003 IN1
GPIO 19      →   ULN2003 IN2
GPIO 23      →   ULN2003 IN3
GPIO  5      →   ULN2003 IN4
─ Servo (Lid) ────────────────────────────────
GPIO 25      →   Servo Signal (lid)
─ HC-SR04 Ultrasonic ──────────────────────────
GPIO 26      →   HC-SR04 TRIG
GPIO 27      →   HC-SR04 ECHO
─ I2C Bus (shared: OLED + DS3231 RTC) ─────────────
GPIO 21      →   SDA (OLED + DS3231 — wired together)
GPIO 22      →   SCL (OLED + DS3231 — wired together)
─ Misc ────────────────────────────────────────
GPIO 32      →   Buzzer (+)
GPIO  2      →   LED (built-in)
GPIO 34      →   Battery voltage divider (ADC)
3.3V         →   OLED VCC, DS3231 VCC
GND          →   All GND
```

> ⚠️ **DS3231 Wiring Note:** DS3231 aur OLED dono GPIO 21/22 (I2C) share karte hain.
> I2C addresses alag hain: OLED=0x3C, DS3231=0x68 — koi conflict nahi hoga.

---

## 🚀 Backend Se Connect Karna

### Step 1 — Docker backend chalu karo
```bash
cd medadhere_backend
docker compose up -d
```

### Step 2 — Device register karo (backend API se)
Postman ya curl se ye run karo:
```bash
# Login as user
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medadhere.com","password":"admin123"}'

# Response se JWT token lo, phir:
curl -X POST http://localhost:8000/api/v1/iot/devices/link/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_name":"My Pill Dispenser","device_type":"CIRCULAR_PILL_DISPENSER"}'
```

### Step 3 — Response se copy karo:
```json
{
  "data": {
    "id":      "PASTE_IN_config.h → DEVICE_ID",
    "api_key": "PASTE_IN_config.h → DEVICE_API_KEY"
  }
}
```

### Step 4 — config.h update karo
```cpp
#define WIFI_SSID      "YourWiFiName"
#define WIFI_PASSWORD  "YourWiFiPassword"
#define BACKEND_URL    "http://192.168.1.100:8000"  // apne PC ka IP
#define DEVICE_API_KEY "copy from step 3"
#define DEVICE_ID      "copy from step 3"
```

### Step 5 — Flash karo
Arduino IDE mein `esp32_firmware.ino` kholo → **Upload** button dabao

---

## 🔄 Communication Flow

```
ESP32 Boot
  └─ HW Init: OLED + DS3231 RTC (shared I2C)
  └─ WiFi connect → NTP sync → RTC update
  └─ POST /api/v1/iot/events/ {DEVICE_BOOT}
       └─ Response: today's schedule (with priority + meal_dependency)

Offline Mode (WiFi lost):
  └─ RTC DS3231 provides accurate time (battery-backed)
  └─ NVS flash cache provides last saved schedule
  └─ WiFi retry every 15s (non-blocking)
  └─ dispensed_today[] locks still work

Every 5 min (online):
  └─ POST /api/v1/iot/heartbeat/
       └─ Battery level, WiFi RSSI, hardware status
       └─ Response: schedule_updated flag

Every 30 sec (online):
  └─ GET /api/v1/iot/devices/{id}/commands/
       └─ Commands: SYNC_SCHEDULE, START_FILL_MODE,
             NEXT_COMPARTMENT, END_FILL_MODE, RESET_FLAGS,
             PREPARE_COMPARTMENT

Dose Time (works online + offline with RTC):
  └─ Stepper rotates → POST COMPARTMENT_ROTATED
  └─ Lid opens      → POST LID_OPENED
  └─ Hand detected  → POST HAND_DETECTED
  └─ Lid closes     → POST LID_CLOSED
  └─ 30s later      → POST DOSE_TAKEN (ya DOSE_TIMEOUT)
  └─ Duplicate try  → POST DOSE_DUPLICATE_BLOCKED (firmware block)

Midnight (RTC-accurate):
  └─ dispensed_today[12] array reset ho jaata hai
```

---

## 🌐 Apna PC ka IP kaise pata kare

```bash
# Windows PowerShell
ipconfig | findstr IPv4

# Output example: 192.168.1.100
# Isko BACKEND_URL mein use karo:
# #define BACKEND_URL "http://192.168.1.100:8000"
```

> ⚠️ ESP32 aur PC ek hi WiFi network pe hone chahiye!

---

## 🧪 Test karna (Serial Monitor se)

Arduino IDE → Tools → Serial Monitor → 115200 baud

Aapko yeh dikhna chahiye:
```
[BOOT] MedAdhere Pill Dispenser v1.1.0
[HW] All hardware initialized OK
[RTC] DS3231 OK: 08:15:30
[WiFi] Connected: 192.168.1.105
[TIME] NTP synced: 08:15:31
[RTC] Synced from NTP successfully
[BOOT] Server response received
[BOOT] Got 4 dose slots
[SCHED] Saved 4 slots
[HB] OK (battery=85%)
```

Agar DS3231 nahi laga:
```
[RTC] DS3231 NOT FOUND — using NTP only
```
Ye bhi kaam karega, but WiFi gaya toh time drift ho sakta hai.
