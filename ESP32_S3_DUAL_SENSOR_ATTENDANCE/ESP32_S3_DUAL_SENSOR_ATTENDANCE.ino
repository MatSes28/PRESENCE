/**
 * CLIRDEC:PRESENCE - ESP32-S3 Dual Sensor Attendance Firmware
 *
 * Features:
 * - RC522 RFID scan -> POST /api/iot/attendance/rfid
 * - Dual HC-SR04 (entry/exit) -> POST /api/iot/sensor/ultrasonic
 * - Heartbeat -> POST /api/iot/heartbeat
 * - Command polling -> GET /api/iot/commands + POST /api/iot/commands/:id/ack
 *
 * Supported dashboard/device commands:
 * - test
 * - calibrate
 * - ping / heartbeat
 * - restart
 * - update_config
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
// Replace these before flashing the device.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* API_BASE_URL = "https://presence.clirdec.edu.ph/api/iot";
const char* DEVICE_ID = "ESP32-001";
const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";

// =========================
// Hardware Pins (ESP32-S3)
// =========================
constexpr uint8_t RFID_SS_PIN = 5;
constexpr uint8_t RFID_RST_PIN = 9;
constexpr uint8_t RFID_SCK_PIN = 6;
constexpr uint8_t RFID_MISO_PIN = 8;
constexpr uint8_t RFID_MOSI_PIN = 7;

constexpr uint8_t ENTRY_TRIG_PIN = 12;
constexpr uint8_t ENTRY_ECHO_PIN = 13;

constexpr uint8_t EXIT_TRIG_PIN = 25;
constexpr uint8_t EXIT_ECHO_PIN = 26;

constexpr uint8_t STATUS_LED_PIN = 2;

// =========================
// Runtime Defaults
// =========================
constexpr unsigned long HEARTBEAT_INTERVAL_MS_DEFAULT = 30000;
constexpr unsigned long COMMAND_POLL_INTERVAL_MS = 2000;
constexpr unsigned long SENSOR_POLL_INTERVAL_MS_DEFAULT = 250;
constexpr unsigned long RFID_DEBOUNCE_MS_DEFAULT = 1500;
constexpr unsigned long SENSOR_EVENT_DEBOUNCE_MS_DEFAULT = 1200;
constexpr uint16_t MAX_SENSOR_DISTANCE_CM = 400;
constexpr uint16_t PRESENCE_DISTANCE_CM_DEFAULT = 100;

bool rfidEnabled = true;
bool ultrasonicEnabled = true;
bool ledEnabled = true;

unsigned long heartbeatIntervalMs = HEARTBEAT_INTERVAL_MS_DEFAULT;
unsigned long sensorPollIntervalMs = SENSOR_POLL_INTERVAL_MS_DEFAULT;
unsigned long rfidDebounceMs = RFID_DEBOUNCE_MS_DEFAULT;
unsigned long sensorEventDebounceMs = SENSOR_EVENT_DEBOUNCE_MS_DEFAULT;
uint16_t presenceDistanceCm = PRESENCE_DISTANCE_CM_DEFAULT;

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
NewPing entrySensor(ENTRY_TRIG_PIN, ENTRY_ECHO_PIN, MAX_SENSOR_DISTANCE_CM);
NewPing exitSensor(EXIT_TRIG_PIN, EXIT_ECHO_PIN, MAX_SENSOR_DISTANCE_CM);

unsigned long lastHeartbeatAt = 0;
unsigned long lastCommandPollAt = 0;
unsigned long lastSensorPollAt = 0;
unsigned long lastRfidAt = 0;
unsigned long lastEntryEventAt = 0;
unsigned long lastExitEventAt = 0;

void blink(uint8_t times, uint16_t onMs = 80, uint16_t offMs = 80) {
  if (!ledEnabled) return;

  for (uint8_t i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    if (i + 1 < times) delay(offMs);
  }
}

bool beginRequest(
  HTTPClient& http,
  WiFiClientSecure& client,
  const String& endpoint
) {
  String url = String(API_BASE_URL) + endpoint;
  client.setInsecure();

  if (!http.begin(client, url)) {
    Serial.printf("[HTTP] begin failed: %s\n", url.c_str());
    return false;
  }

  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-api-key", DEVICE_API_KEY);
  return true;
}

bool postJson(
  const String& endpoint,
  JsonDocument& payload,
  String* responseBody = nullptr
) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  WiFiClientSecure client;
  if (!beginRequest(http, client, endpoint)) {
    return false;
  }

  String body;
  serializeJson(payload, body);

  int code = http.POST(body);
  bool ok = (code >= 200 && code < 300);

  if (responseBody != nullptr) {
    *responseBody = http.getString();
  } else if (!ok) {
    String resp = http.getString();
    if (resp.length() > 0) Serial.println(resp);
  }

  if (!ok) {
    Serial.printf("[HTTP] POST %s -> %d\n", endpoint.c_str(), code);
  }

  http.end();
  return ok;
}

bool getJson(const String& endpoint, String& responseBody) {
  responseBody = "";
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  WiFiClientSecure client;
  if (!beginRequest(http, client, endpoint)) {
    return false;
  }

  int code = http.GET();
  bool ok = (code >= 200 && code < 300);
  responseBody = http.getString();

  if (!ok) {
    Serial.printf("[HTTP] GET %s -> %d\n", endpoint.c_str(), code);
    if (responseBody.length() > 0) Serial.println(responseBody);
  }

  http.end();
  return ok;
}

void addRuntimeConfig(JsonObject config) {
  config["rfidEnabled"] = rfidEnabled;
  config["ultrasonicEnabled"] = ultrasonicEnabled;
  config["heartbeatInterval"] = heartbeatIntervalMs;
  config["scan_interval"] = sensorPollIntervalMs;
  config["debounce_time"] = rfidDebounceMs;
  config["sensorEventDebounce"] = sensorEventDebounceMs;
  config["presenceDistanceCm"] = presenceDistanceCm;
  config["led_enabled"] = ledEnabled;
}

void sendStatusUpdate(const char* status) {
  DynamicJsonDocument payload(512);
  payload["status"] = status;
  JsonObject config = payload.createNestedObject("config");
  addRuntimeConfig(config);
  postJson("/status", payload);
}

void sendHeartbeat() {
  DynamicJsonDocument payload(512);
  payload["status"] = "online";
  payload["uptime"] = millis() / 1000;
  payload["signalStrength"] = WiFi.RSSI();

  JsonObject metadata = payload.createNestedObject("metadata");
  metadata["deviceId"] = DEVICE_ID;
  metadata["freeHeap"] = ESP.getFreeHeap();
  metadata["rfidEnabled"] = rfidEnabled;
  metadata["ultrasonicEnabled"] = ultrasonicEnabled;

  if (postJson("/heartbeat", payload)) {
    Serial.println("[HB] heartbeat sent");
  }
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
    sendStatusUpdate("online");
    sendHeartbeat();
    lastHeartbeatAt = millis();
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

void sendRfid(const String& uid) {
  DynamicJsonDocument payload(256);
  payload["rfidUid"] = uid;
  payload["timestamp"] = String(millis());

  if (postJson("/attendance/rfid", payload)) {
    Serial.printf("[RFID] sent uid=%s\n", uid.c_str());
    blink(1, 160, 40);
  }
}

void sendSensor(const char* sensorType, unsigned int distanceCm) {
  DynamicJsonDocument payload(256);
  payload["sensorType"] = sensorType;
  payload["distance"] = distanceCm;
  payload["timestamp"] = String(millis());

  if (postJson("/sensor/ultrasonic", payload)) {
    Serial.printf("[SENSOR] sent type=%s distance=%u\n", sensorType, distanceCm);
  }
}

void applyUnsignedLongIfPresent(
  JsonVariantConst value,
  unsigned long& target,
  unsigned long minValue,
  unsigned long maxValue
) {
  if (value.isNull()) return;

  long next = value.as<long>();
  if (next < 0) return;

  unsigned long castValue = static_cast<unsigned long>(next);
  if (castValue < minValue || castValue > maxValue) return;
  target = castValue;
}

void applyUint16IfPresent(
  JsonVariantConst value,
  uint16_t& target,
  uint16_t minValue,
  uint16_t maxValue
) {
  if (value.isNull()) return;

  long next = value.as<long>();
  if (next < 0) return;

  uint16_t castValue = static_cast<uint16_t>(next);
  if (castValue < minValue || castValue > maxValue) return;
  target = castValue;
}

void applyRuntimeConfig(JsonVariantConst payload) {
  if (!payload.is<JsonObjectConst>()) {
    Serial.println("[CMD] update_config payload missing or invalid");
    return;
  }

  JsonObjectConst config = payload.as<JsonObjectConst>();

  if (config["rfidEnabled"].is<bool>()) {
    rfidEnabled = config["rfidEnabled"].as<bool>();
  }

  if (config["ultrasonicEnabled"].is<bool>()) {
    ultrasonicEnabled = config["ultrasonicEnabled"].as<bool>();
  }

  if (config["led_enabled"].is<bool>()) {
    ledEnabled = config["led_enabled"].as<bool>();
  }

  applyUnsignedLongIfPresent(
    config["heartbeatInterval"],
    heartbeatIntervalMs,
    5000,
    300000
  );
  applyUnsignedLongIfPresent(
    config["heartbeat_interval"],
    heartbeatIntervalMs,
    5000,
    300000
  );
  applyUnsignedLongIfPresent(
    config["scan_interval"],
    sensorPollIntervalMs,
    50,
    5000
  );
  applyUnsignedLongIfPresent(
    config["debounce_time"],
    rfidDebounceMs,
    100,
    10000
  );
  applyUnsignedLongIfPresent(
    config["sensorEventDebounce"],
    sensorEventDebounceMs,
    100,
    10000
  );
  applyUint16IfPresent(
    config["presenceDistanceCm"],
    presenceDistanceCm,
    10,
    MAX_SENSOR_DISTANCE_CM
  );

  Serial.printf(
    "[CFG] rfid=%s ultrasonic=%s hb=%lu scan=%lu rfidDebounce=%lu sensorDebounce=%lu threshold=%u led=%s\n",
    rfidEnabled ? "on" : "off",
    ultrasonicEnabled ? "on" : "off",
    heartbeatIntervalMs,
    sensorPollIntervalMs,
    rfidDebounceMs,
    sensorEventDebounceMs,
    presenceDistanceCm,
    ledEnabled ? "on" : "off"
  );

  sendStatusUpdate("online");
}

unsigned int sampleAverageDistanceCm(NewPing& sensor, uint8_t sampleCount = 5) {
  unsigned long total = 0;
  uint8_t validSamples = 0;

  for (uint8_t i = 0; i < sampleCount; i++) {
    unsigned int distance = sensor.ping_cm();
    if (distance > 0) {
      total += distance;
      validSamples++;
    }
    delay(30);
  }

  if (validSamples == 0) return 0;
  return static_cast<unsigned int>(total / validSamples);
}

void runReaderSelfTest() {
  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  bool detected = version != 0x00 && version != 0xFF;

  Serial.printf(
    "[CMD] RFID test -> version=0x%02X detected=%s\n",
    version,
    detected ? "yes" : "no"
  );

  blink(detected ? 2 : 5, 100, 100);
  sendStatusUpdate(detected ? "online" : "error");
}

void runCalibration() {
  unsigned int entryAverage = sampleAverageDistanceCm(entrySensor);
  unsigned int exitAverage = sampleAverageDistanceCm(exitSensor);

  Serial.printf(
    "[CMD] Calibration sample -> entry=%ucm exit=%ucm threshold=%ucm\n",
    entryAverage,
    exitAverage,
    presenceDistanceCm
  );

  blink(3, 120, 120);
  sendStatusUpdate("online");
}

bool acknowledgeCommand(const String& commandId) {
  DynamicJsonDocument payload(16);
  return postJson("/commands/" + commandId + "/ack", payload);
}

void executeCommand(JsonObjectConst command) {
  const char* commandId = command["id"] | "";
  const char* commandName = command["command"] | "";

  if (commandId[0] == '\0' || commandName[0] == '\0') {
    Serial.println("[CMD] Skipping invalid command payload");
    return;
  }

  if (!acknowledgeCommand(String(commandId))) {
    Serial.printf("[CMD] Failed to acknowledge %s\n", commandId);
    return;
  }

  Serial.printf("[CMD] Received %s\n", commandName);

  if (strcmp(commandName, "test") == 0) {
    runReaderSelfTest();
    return;
  }

  if (strcmp(commandName, "calibrate") == 0) {
    runCalibration();
    return;
  }

  if (strcmp(commandName, "ping") == 0 || strcmp(commandName, "heartbeat") == 0) {
    sendHeartbeat();
    return;
  }

  if (strcmp(commandName, "update_config") == 0) {
    applyRuntimeConfig(command["payload"]);
    return;
  }

  if (strcmp(commandName, "diagnostics") == 0 || strcmp(commandName, "health_check") == 0) {
    sendHeartbeat();
    sendStatusUpdate("online");
    return;
  }

  if (strcmp(commandName, "restart") == 0) {
    sendStatusUpdate("maintenance");
    delay(150);
    ESP.restart();
    return;
  }

  Serial.printf("[CMD] Unsupported command ignored: %s\n", commandName);
}

void pollCommands() {
  String responseBody;
  if (!getJson("/commands", responseBody)) {
    return;
  }

  if (responseBody.length() == 0) {
    return;
  }

  DynamicJsonDocument responseDoc(2048);
  DeserializationError error = deserializeJson(responseDoc, responseBody);
  if (error) {
    Serial.printf("[CMD] Failed to parse commands response: %s\n", error.c_str());
    return;
  }

  if (!responseDoc["commands"].is<JsonArrayConst>()) {
    return;
  }

  JsonArrayConst commands = responseDoc["commands"].as<JsonArrayConst>();
  for (JsonObjectConst command : commands) {
    executeCommand(command);
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

  if (now - lastCommandPollAt >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPollAt = now;
    pollCommands();
  }

  if (now - lastHeartbeatAt >= heartbeatIntervalMs) {
    lastHeartbeatAt = now;
    sendHeartbeat();
  }

  if (rfidEnabled && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    if (now - lastRfidAt >= rfidDebounceMs) {
      lastRfidAt = now;
      String uid = rfidUidHex();
      sendRfid(uid);
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  if (ultrasonicEnabled && now - lastSensorPollAt >= sensorPollIntervalMs) {
    lastSensorPollAt = now;

    unsigned int entryDistance = entrySensor.ping_cm();
    unsigned int exitDistance = exitSensor.ping_cm();

    if (entryDistance > 0 && entryDistance <= presenceDistanceCm) {
      if (now - lastEntryEventAt >= sensorEventDebounceMs) {
        lastEntryEventAt = now;
        sendSensor("entry", entryDistance);
      }
    }

    if (exitDistance > 0 && exitDistance <= presenceDistanceCm) {
      if (now - lastExitEventAt >= sensorEventDebounceMs) {
        lastExitEventAt = now;
        sendSensor("exit", exitDistance);
      }
    }
  }

  delay(15);
}
