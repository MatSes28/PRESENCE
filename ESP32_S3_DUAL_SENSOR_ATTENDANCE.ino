/*
 * CLIRDEC:PRESENCE - ESP32 S3 Dual Sensor Attendance System
 * Proximity and RFID-Enabled Smart Entry for Classroom Engagement
 *
 * Hardware Requirements:
 * - ESP32 S3 Dev Board
 * - RC522 RFID Reader (3.3V compatible)
 * - 2x HC-SR04 Ultrasonic Sensors
 * - WiFi connection
 *
 * Pin Configuration:
 * RFID RC522:
 *   SDA: GPIO 21
 *   SCK: GPIO 18
 *   MOSI: GPIO 23
 *   MISO: GPIO 19
 *   IRQ: Not connected
 *   GND: GND
 *   RST: GPIO 22
 *   3.3V: 3.3V
 *
 * Entry Sensor HC-SR04:
 *   TRIG: GPIO 12
 *   ECHO: GPIO 13
 *   VCC: 5V
 *   GND: GND
 *
 * Exit Sensor HC-SR04:
 *   TRIG: GPIO 25
 *   ECHO: GPIO 26
 *   VCC: 5V
 *   GND: GND
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// WebSocket Server Configuration
const char* WS_HOST = "your-server-domain.com"; // Replace with your server
const uint16_t WS_PORT = 443;
const char* WS_PATH = "/iot";
bool WS_SSL = true;

// Device Configuration
const char* DEVICE_ID = "ESP32_S3_001"; // Unique device identifier
const char* CLASSROOM_ID = "ROOM_101"; // Associated classroom

// RFID Configuration
#define SS_PIN 21
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

// Ultrasonic Sensor Pins
#define ENTRY_TRIG 12
#define ENTRY_ECHO 13
#define EXIT_TRIG 25
#define EXIT_ECHO 26

// Constants
#define SOUND_SPEED 0.034
#define DETECTION_DISTANCE_CM 100
#define RFID_SCAN_INTERVAL 1000
#define SENSOR_SCAN_INTERVAL 500
#define HEARTBEAT_INTERVAL 30000

// Global Variables
WebSocketsClient webSocket;
unsigned long lastRFIDScan = 0;
unsigned long lastSensorScan = 0;
unsigned long lastHeartbeat = 0;
String lastRFIDTag = "";
bool deviceRegistered = false;

// Function Declarations
void connectWiFi();
void connectWebSocket();
void registerDevice();
void sendHeartbeat();
void handleRFIDScan();
long measureDistance(int trigPin, int echoPin);
void sendSensorData(const char* sensorType, long distance);
void sendRFIDData(String rfidUid);
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== CLIRDEC:PRESENCE ESP32 S3 Starting ===");

  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("RFID module initialized");

  // Configure ultrasonic sensor pins
  pinMode(ENTRY_TRIG, OUTPUT);
  pinMode(ENTRY_ECHO, INPUT);
  pinMode(EXIT_TRIG, OUTPUT);
  pinMode(EXIT_ECHO, INPUT);
  Serial.println("Ultrasonic sensors configured");

  // Connect to WiFi
  connectWiFi();

  // Sync time with NTP server
  syncTimeWithNTP();

  // Connect to WebSocket server
  connectWebSocket();

  Serial.println("=== Setup Complete ===");
}

void loop() {
  webSocket.loop();

  unsigned long currentMillis = millis();

  // Handle RFID scanning
  if (currentMillis - lastRFIDScan >= RFID_SCAN_INTERVAL) {
    handleRFIDScan();
    lastRFIDScan = currentMillis;
  }

  // Handle ultrasonic sensors
  if (currentMillis - lastSensorScan >= SENSOR_SCAN_INTERVAL) {
    // Check entry sensor
    long entryDistance = measureDistance(ENTRY_TRIG, ENTRY_ECHO);
    if (entryDistance > 0 && entryDistance <= DETECTION_DISTANCE_CM) {
      sendSensorData("entry", entryDistance);
    }

    // Check exit sensor
    long exitDistance = measureDistance(EXIT_TRIG, EXIT_ECHO);
    if (exitDistance > 0 && exitDistance <= DETECTION_DISTANCE_CM) {
      sendSensorData("exit", exitDistance);
    }

    lastSensorScan = currentMillis;
  }

  // Send heartbeat
  if (currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = currentMillis;
  }
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed!");
    ESP.restart();
  }
}

void connectWebSocket() {
  Serial.println("Connecting to WebSocket server...");

  // Configure WebSocket
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5173);
  webSocket.enableHeartbeat(15173, 3000, 2);

  // Add device ID as query parameter
  String url = String(WS_PATH) + "?deviceId=" + DEVICE_ID;
  webSocket.beginSSL(WS_HOST, WS_PORT, url.c_str());
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      deviceRegistered = false;
      break;

    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      registerDevice();
      break;

    case WStype_TEXT: {
      Serial.printf("WebSocket message: %s\n", payload);

      // Parse JSON message
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload, length);

      if (!error) {
        String messageType = doc["type"];

        if (messageType == "command") {
          handleCommand(doc["command"], doc["params"]);
        } else if (messageType == "registered") {
          deviceRegistered = true;
          Serial.println("Device registered successfully");
        }
      }
      break;
    }

    case WStype_ERROR:
      Serial.println("WebSocket error");
      break;

    case WStype_PING:
      Serial.println("WebSocket ping");
      break;

    case WStype_PONG:
      Serial.println("WebSocket pong");
      break;
  }
}

void registerDevice() {
  DynamicJsonDocument doc(256);
  doc["type"] = "register";
  doc["deviceId"] = DEVICE_ID;
  doc["deviceType"] = "esp32_s3";
  doc["classroomId"] = CLASSROOM_ID;
  doc["capabilities"] = "rfid,ultrasonic_entry,ultrasonic_exit";

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("Device registration sent");
}

void sendHeartbeat() {
  if (!deviceRegistered) return;

  DynamicJsonDocument doc(128);
  doc["type"] = "heartbeat";
  doc["deviceId"] = DEVICE_ID;
  doc["timestamp"] = String(millis());

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);
}

void handleRFIDScan() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Get RFID UID
  String rfidUid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      rfidUid += "0";
    }
    rfidUid += String(rfid.uid.uidByte[i], HEX);
  }
  rfidUid.toUpperCase();

  // RFID collision handling - check if multiple cards are detected
  if (rfid.PICC_IsNewCardPresent()) {
    // Multiple cards detected - implement collision avoidance
    Serial.println("RFID collision detected! Multiple cards present.");
    
    // Simple collision resolution: wait and retry
    delay(100);
    if (rfid.PICC_IsNewCardPresent()) {
      Serial.println("Collision persists - skipping this scan");
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
      return;
    }
  }

  // Avoid duplicate scans
  if (rfidUid == lastRFIDTag) {
    return;
  }

  lastRFIDTag = rfidUid;

  Serial.print("RFID detected: ");
  Serial.println(rfidUid);

  sendRFIDData(rfidUid);

  // Halt PICC
  rfid.PICC_HaltA();
  // Stop encryption on PCD
  rfid.PCD_StopCrypto1();
}

long measureDistance(int trigPin, int echoPin) {
  // Clear the trig pin
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  // Set the trig pin HIGH for 10 microseconds
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Read the echo pin, return the sound wave travel time in microseconds
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout

  // Calculate the distance
  long distance = duration * SOUND_SPEED / 2;

  return distance;
}

void sendSensorData(const char* sensorType, long distance) {
  if (!deviceRegistered) return;

  DynamicJsonDocument doc(256);
  doc["type"] = "sensor_trigger";
  doc["deviceId"] = DEVICE_ID;
  doc["sensorType"] = sensorType;
  doc["distance"] = distance;
  doc["timestamp"] = String(millis());

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.printf("Sensor trigger sent: %s, distance: %ld cm\n", sensorType, distance);
}

void sendRFIDData(String rfidUid) {
  if (!deviceRegistered) return;

  DynamicJsonDocument doc(256);
  doc["type"] = "rfid_scan";
  doc["deviceId"] = DEVICE_ID;
  doc["rfidUid"] = rfidUid;
  doc["timestamp"] = String(millis());

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.print("RFID data sent: ");
  Serial.println(rfidUid);
}

void syncTimeWithNTP() {
  // This is a placeholder for NTP time synchronization
  // In a real implementation, you would use WiFiUdp and NTPClient
  // For now, we'll just use the device's internal time
  Serial.println("Time synchronization: Using device time (NTP would be implemented here)");
}

void handleCommand(String command, JsonVariant params) {
  Serial.print("Received command: ");
  Serial.println(command);

  if (command == "restart") {
    Serial.println("Restarting device...");
    ESP.restart();
  } else if (command == "update_config") {
    // Handle configuration update
    Serial.println("Configuration update received");
    // Implement config update logic here
  } else if (command == "ping") {
    // Respond to ping
    DynamicJsonDocument doc(128);
    doc["type"] = "pong";
    doc["deviceId"] = DEVICE_ID;

    String message;
    serializeJson(doc, message);
    webSocket.sendTXT(message);
  }
}