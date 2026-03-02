# 📡 CLIRDEC:PRESENCE IoT Device Integration Checklist

## ESP32-S3 Device Setup

### Hardware Preparation

- [ ] ESP32-S3 development boards acquired
- [ ] RC522 RFID modules connected (SPI pins)
- [ ] HC-SR04 ultrasonic sensors connected
- [ ] Power supply verified (5V stable)
- [ ] Breadboard/prototype PCB assembled

### Firmware Configuration

- [ ] WiFi credentials configured
- [ ] Server URL updated to production domain
- [ ] API key generated and configured
- [ ] Device ID assigned (unique per device)
- [ ] Heartbeat interval configured (30 seconds)
- [ ] RFID scanning threshold set
- [ ] Entry/exit ultrasonic thresholds configured
- [ ] Firmware sends explicit `sensorType` (`entry` | `exit`) to `/api/iot/sensor/ultrasonic`

### Device Programming

- [ ] Arduino IDE/PlatformIO configured
- [ ] Required libraries installed (WiFi, WebSocket, MFRC522, NewPing)
- [ ] Firmware compiled without errors
- [ ] Firmware flashed to device
- [ ] Serial monitor testing completed

## Network Configuration

### Network Setup

- [ ] Device MAC addresses recorded
- [ ] Static IP addresses assigned (or DHCP reservation)
- [ ] Firewall rules configured (allow outbound HTTPS)
- [ ] Network bandwidth verified
- [ ] WiFi signal strength tested at installation location

### Server Configuration

- [ ] WebSocket endpoints accessible (`/ws`, `/iot`)
- [ ] Device API endpoints configured
- [ ] CORS settings allow device origins
- [ ] Rate limiting configured for device endpoints

## Device Registration

### Initial Registration

- [ ] Device connected to network
- [ ] Heartbeat received by server
- [ ] Device appears in admin dashboard
- [ ] Device assigned to correct classroom
- [ ] API key verified and working
- [ ] Certificate-based auth configured (if using)

### Testing

- [ ] RFID scanning tested with known cards
- [ ] Ultrasonic sensor tested (distance detection)
- [ ] Dual verification working (RFID + sensor)
- [ ] Real-time WebSocket updates confirmed
- [ ] Attendance records created successfully

## Classroom Deployment

### Physical Installation

- [ ] Device mounted securely
- [ ] RFID reader positioned for easy access
- [ ] Ultrasonic sensor aimed correctly
- [ ] Power cable managed safely
- [ ] Network connection stable

### Final Testing

- [ ] Multiple RFID cards tested
- [ ] Entry/exit detection working
- [ ] Attendance records matching expected data
- [ ] Mobile app connectivity verified
- [ ] Real-time dashboard updates confirmed

## ESP32-S3 Pin Configuration

```
ESP32-S3 Pinout for RFID + Dual Ultrasonic:

RFID RC522:
- SDA (SS): GPIO 5
- SCK: GPIO 6
- MOSI: GPIO 7
- MISO: GPIO 8
- RST: GPIO 9

Entry HC-SR04:
- TRIG: GPIO 12
- ECHO: GPIO 13

Exit HC-SR04:
- TRIG: GPIO 25
- ECHO: GPIO 26

Status LED:
- LED_BUILTIN: GPIO 2 (onboard)
```

## Firmware File Location

- Baseline firmware is stored at [`ESP32_S3_DUAL_SENSOR_ATTENDANCE.ino`](ESP32_S3_DUAL_SENSOR_ATTENDANCE.ino).

## Production Auth Requirement

- For production deployments, avoid query-token auth in WebSocket URLs.
- Use device API key via headers for device REST endpoints (`x-device-api-key`).
- If WebSocket device messaging is used directly, prefer header/subprotocol auth and signed events.

## Device Firmware Configuration

```cpp
// WiFi Configuration
const char* WIFI_SSID = "CLIRDEC_WiFi";
const char* WIFI_PASSWORD = "your_wifi_password";

// Server Configuration
const char* SERVER_URL = "https://presence.clirdec.edu.ph";
const int SERVER_PORT = 443;

// API Configuration
const char* DEVICE_API_KEY = "your_generated_api_key";
const char* DEVICE_ID = "ESP32-001";

// Timing Configuration
const long HEARTBEAT_INTERVAL = 30000;  // 30 seconds
const long SENSOR_SAMPLE_INTERVAL = 1000;  // 1 second
```

## Troubleshooting

### Common Issues

1. **Device not connecting to WiFi**
   - Check WiFi credentials
   - Verify signal strength
   - Check if MAC filtering is enabled on router

2. **RFID not reading cards**
   - Check wiring connections
   - Verify SPI pin configuration
   - Check if card is compatible (MIFARE 1K)

3. **Ultrasonic sensor giving wrong readings**
   - Check power supply (5V required)
   - Verify TRIG and ECHO pin connections
   - Ensure no obstacles in detection path

4. **WebSocket connection failing**
   - Verify server URL and port
   - Check SSL/TLS certificate
   - Ensure firewall allows outbound connections

5. **Attendance records not being created**
   - Check server logs for errors
   - Verify database connection
   - Check if class session is active

## Maintenance Procedures

### Daily Checks

- [ ] Check device status in dashboard
- [ ] Verify heartbeat received
- [ ] Check attendance records for anomalies

### Weekly Checks

- [ ] Review device health metrics
- [ ] Check signal strength
- [ ] Verify sensor calibration
- [ ] Review error logs

### Monthly Maintenance

- [ ] Physical inspection of devices
- [ ] Firmware update if available
- [ ] Certificate renewal if using TLS
- [ ] Full system integration test
