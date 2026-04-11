/**
 * CLIRDEC:PRESENCE - ESP32-S3 Dual Sensor Attendance Firmware (baseline)
 *
 * Features:
 * - RC522 RFID scan -> POST /api/iot/attendance/rfid
 * - Dual HC-SR04 (entry/exit) -> POST /api/iot/sensor/ultrasonic
 * - Heartbeat -> POST /api/iot/heartbeat
 *
 * Security model:
 * - Uses HTTPS REST endpoints with `x-device-api-key` header
 * - Avoids query-token authentication
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <NewPing.h>

// =========================
// Device / Network Config
// =========================
const char* WIFI_SSID = "Kupal kaba?";
const char* WIFI_PASSWORD = "MatMir@12030908";

const char* API_BASE_URL = "https://presence.clirdec.edu.ph/api/iot";
const char* DEVICE_ID = "ESP32-001";
const char* DEVICE_API_KEY = "your_generated_api_key";

// =========================
// Hardware Pins (ESP32-S3)
// =========================
// RC522 SPI pins
constexpr uint8_t RFID_SS_PIN = 5;
constexpr uint8_t RFID_RST_PIN = 9;
constexpr uint8_t RFID_SCK_PIN = 6;
constexpr uint8_t RFID_MISO_PIN = 8;
constexpr uint8_t RFID_MOSI_PIN = 7;

// Entry ultrasonic sensor (TRIG/ECHO)
constexpr uint8_t ENTRY_TRIG_PIN = 12;
constexpr uint8_t ENTRY_ECHO_PIN = 13;

// Exit ultrasonic sensor (TRIG/ECHO)
constexpr uint8_t EXIT_TRIG_PIN = 25;
constexpr uint8_t EXIT_ECHO_PIN = 26;

constexpr uint8_t STATUS_LED_PIN = 2;

// =========================
// Runtime Tuning
// =========================
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 30000;
constexpr unsigned long SENSOR_POLL_INTERVAL_MS = 250;
constexpr unsigned long RFID_DEBOUNCE_MS = 1500;
constexpr unsigned long SENSOR_EVENT_DEBOUNCE_MS = 1200;
constexpr uint16_t MAX_SENSOR_DISTANCE_CM = 400;
constexpr uint16_t PRESENCE_DISTANCE_CM = 100;

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
NewPing entrySensor(ENTRY_TRIG_PIN, ENTRY_ECHO_PIN, MAX_SENSOR_DISTANCE_CM);
NewPing exitSensor(EXIT_TRIG_PIN, EXIT_ECHO_PIN, MAX_SENSOR_DISTANCE_CM);

WiFiClientSecure secureClient;

unsigned long lastHeartbeatAt = 0;
unsigned long lastSensorPollAt = 0;
unsigned long lastRfidAt = 0;
unsigned long lastEntryEventAt = 0;
unsigned long lastExitEventAt = 0;

void blink(uint8_t times, uint16_t onMs = 80, uint16_t offMs = 80) {
  for (uint8_t i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    if (i + 1 < times) delay(offMs);
  }
}

String isoTimestamp() {
  // Lightweight ISO-like timestamp without RTC/NTP dependency.
  // Server uses its own receive time as canonical when needed.
  unsigned long ms = millis();
  DynamicJsonDocument doc(64);
  doc["ms"] = ms;
  String out;
  serializeJson(doc, out);
  return out;
}

bool postJson(const String& endpoint, JsonDocument& payload) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(API_BASE_URL) + endpoint;

  secureClient.setInsecure();  // Replace with pinned CA/cert in production firmware hardening.

  if (!http.begin(secureClient, url)) {
    Serial.printf("[HTTP] begin failed: %s\n", url.c_str());
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-api-key", DEVICE_API_KEY);

  String body;
  serializeJson(payload, body);

  int code = http.POST(body);
  bool ok = (code >= 200 && code < 300);

  if (!ok) {
    Serial.printf("[HTTP] POST %s -> %d\n", endpoint.c_str(), code);
    String resp = http.getString();
    if (resp.length() > 0) Serial.println(resp);
  }

  http.end();
  return ok;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] Connected. IP=%s\n", WiFi.localIP().toString().c_str());
    blink(2, 120, 120);
  } else {
    Serial.println("[WiFi] Connection failed");
    blink(6, 50, 50);
  }
}

String rfidUidHex() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void sendHeartbeat() {
  DynamicJsonDocument payload(256);
  payload["status"] = "online";
  payload["timestamp"] = millis();
  payload["uptime"] = millis() / 1000;
  payload["signalStrength"] = WiFi.RSSI();

  if (postJson("/heartbeat", payload)) {
    Serial.println("[HB] heartbeat sent");
  }
}

void sendRfid(const String& uid) {
  DynamicJsonDocument payload(256);
  payload["rfidUid"] = uid;
  payload["timestamp"] = millis();

  if (postJson("/attendance/rfid", payload)) {
    Serial.printf("[RFID] sent uid=%s\n", uid.c_str());
    blink(1, 160, 40);
  }
}

void sendSensor(const char* sensorType, unsigned int distanceCm) {
  DynamicJsonDocument payload(256);
  payload["sensorType"] = sensorType;  // required by backend
  payload["distance"] = distanceCm;
  payload["timestamp"] = millis();

  if (postJson("/sensor/ultrasonic", payload)) {
    Serial.printf("[SENSOR] sent type=%s distance=%u\n", sensorType, distanceCm);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  SPI.begin(RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN, RFID_SS_PIN);
  rfid.PCD_Init();

  connectWiFi();
}

void loop() {
  const unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(500);
    return;
  }

  // Heartbeat
  if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatAt = now;
    sendHeartbeat();
  }

  // RFID scan
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    if (now - lastRfidAt >= RFID_DEBOUNCE_MS) {
      lastRfidAt = now;
      String uid = rfidUidHex();
      sendRfid(uid);
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // Sensor scan
  if (now - lastSensorPollAt >= SENSOR_POLL_INTERVAL_MS) {
    lastSensorPollAt = now;

    unsigned int entryDistance = entrySensor.ping_cm();
    unsigned int exitDistance = exitSensor.ping_cm();

    if (entryDistance > 0 && entryDistance <= PRESENCE_DISTANCE_CM) {
      if (now - lastEntryEventAt >= SENSOR_EVENT_DEBOUNCE_MS) {
        lastEntryEventAt = now;
        sendSensor("entry", entryDistance);
      }
    }

    if (exitDistance > 0 && exitDistance <= PRESENCE_DISTANCE_CM) {
      if (now - lastExitEventAt >= SENSOR_EVENT_DEBOUNCE_MS) {
        lastExitEventAt = now;
        sendSensor("exit", exitDistance);
      }
    }
  }

  delay(15);
}

