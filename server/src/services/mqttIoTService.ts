/**
 * MQTT IoT Service for ESP32 Attendance Devices
 * Handles real-time communication with attendance sensors
 */

import { EventEmitter } from "events";
import * as mqtt from "mqtt";
import db from "../storage";
import { attendanceSessions, deviceAttendanceLogs, devices } from "../schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IoTDeviceConfig {
  deviceId: string;
  topic: string;
  location: string;
  roomName: string;
  sensorType: "fingerprint" | "rfid" | "face_recognition" | "dual_sensor";
}

export interface AttendanceRecord {
  deviceId: string;
  studentId: string;
  timestamp: Date;
  status: "present" | "absent" | "late";
  confidence?: number;
  method: "fingerprint" | "rfid" | "face_recognition" | "dual_sensor";
}

export interface DeviceHeartbeat {
  deviceId: string;
  timestamp: Date;
  status: "online" | "offline";
  batteryLevel?: number;
  signalStrength?: number;
  freeMemory?: number;
}

class MQTTIoTService extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private brokerUrl: string;
  private options: mqtt.IClientOptions;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private deviceConfigs: Map<string, IoTDeviceConfig> = new Map();

  constructor() {
    super();
    this.brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
    this.options = {
      clientId: `presence_server_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 30000,
      reconnectPeriod: 5000,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      keepalive: 60,
      protocolVersion: 5,
    };
  }

  /**
   * Initialize and connect to MQTT broker
   */
  async initialize(): Promise<void> {
    if (this.client) {
      console.log("[IoT] MQTT client already initialized");
      return;
    }

    try {
      console.log(`[IoT] Connecting to MQTT broker at ${this.brokerUrl}`);

      this.client = mqtt.connect(this.brokerUrl, this.options);

      this.client.on("connect", () => {
        console.log("[IoT] Connected to MQTT broker");
        this.reconnectAttempts = 0;
        this.subscribeToTopics();
        this.startHeartbeatMonitor();
        this.emit("connected");
      });

      this.client.on("message", (topic, message) => {
        this.handleMessage(topic, message.toString());
      });

      this.client.on("error", (error) => {
        console.error("[IoT] MQTT error:", error.message);
        this.emit("error", error);
      });

      this.client.on("close", () => {
        console.log("[IoT] MQTT connection closed");
        this.emit("disconnected");
      });

      this.client.on("reconnect", () => {
        console.log("[IoT] Attempting to reconnect...");
        this.reconnectAttempts++;
      });

      this.client.on("offline", () => {
        console.log("[IoT] Client is offline");
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error("[IoT] Max reconnection attempts reached");
          this.emit("maxReconnectReached");
        }
      });

      // Load device configurations from database
      await this.loadDeviceConfigurations();
    } catch (error) {
      console.error("[IoT] Failed to initialize MQTT service:", error);
      throw error;
    }
  }

  /**
   * Subscribe to all required IoT topics
   */
  private subscribeToTopics(): void {
    if (!this.client) return;

    const topics = [
      "presence/devices/+/attendance", // Individual device attendance
      "presence/devices/+/heartbeat", // Device heartbeat/status
      "presence/devices/+/config", // Device configuration updates
      "presence/devices/+/data", // Raw sensor data
      "presence/devices/+/alert", // Device alerts
      "presence/broadcast/announcements", // Server-to-device messages
      "presence/devices/register", // New device registration
    ];

    topics.forEach((topic) => {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[IoT] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`[IoT] Subscribed to ${topic}`);
        }
      });
    });
  }

  /**
   * Load device configurations from database
   */
  private async loadDeviceConfigurations(): Promise<void> {
    try {
      const deviceRecords = await db.query.devices.findMany({
        where: (devices, { isNotNull }) => isNotNull(devices.mqttTopic),
      });

      deviceRecords.forEach((device) => {
        if (device.id && device.mqttTopic) {
          const config: IoTDeviceConfig = {
            deviceId: device.id,
            topic: device.mqttTopic,
            location: device.location || "Unknown",
            roomName: device.name || "Unknown Room",
            sensorType:
              (device.sensorType as IoTDeviceConfig["sensorType"]) || "rfid",
          };
          this.deviceConfigs.set(device.id, config);
        }
      });

      console.log(
        `[IoT] Loaded ${this.deviceConfigs.size} device configurations`
      );
    } catch (error) {
      console.error("[IoT] Failed to load device configurations:", error);
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  private async handleMessage(topic: string, message: string): Promise<void> {
    try {
      const payload = JSON.parse(message);
      const topicParts = topic.split("/");
      const deviceId = topicParts[2];

      console.log(`[IoT] Received message on ${topic}:`, payload);

      switch (true) {
        case topic.includes("/attendance"):
          await this.handleAttendanceRecord(deviceId, payload);
          break;
        case topic.includes("/heartbeat"):
          await this.handleHeartbeat(deviceId, payload);
          break;
        case topic.includes("/config"):
          await this.handleConfigUpdate(deviceId, payload);
          break;
        case topic.includes("/data"):
          await this.handleSensorData(deviceId, payload);
          break;
        case topic.includes("/alert"):
          await this.handleDeviceAlert(deviceId, payload);
          break;
        case topic.includes("/register"):
          await this.handleDeviceRegistration(payload);
          break;
        default:
          console.log(`[IoT] Unknown topic: ${topic}`);
      }
    } catch (error) {
      console.error("[IoT] Error handling message:", error);
    }
  }

  /**
   * Handle attendance record from device
   */
  private async handleAttendanceRecord(
    deviceId: string,
    payload: AttendanceRecord
  ): Promise<void> {
    try {
      const record: typeof deviceAttendanceLogs.$inferInsert = {
        deviceId: payload.deviceId || deviceId,
        studentId: payload.studentId,
        sessionId: payload.sessionId || null,
        timestamp: new Date(payload.timestamp),
        status: payload.status || "present",
        confidence: payload.confidence || null,
        method: payload.method || "rfid",
        synced: true,
      };

      await db.insert(deviceAttendanceLogs).values(record);

      // Emit event for real-time updates
      this.emit("attendanceRecorded", {
        deviceId,
        studentId: payload.studentId,
        timestamp: record.timestamp,
        status: record.status,
      });

      console.log(
        `[IoT] Attendance recorded: ${payload.studentId} at ${deviceId}`
      );
    } catch (error) {
      console.error("[IoT] Error recording attendance:", error);
    }
  }

  /**
   * Handle device heartbeat
   */
  private async handleHeartbeat(
    deviceId: string,
    payload: DeviceHeartbeat
  ): Promise<void> {
    try {
      const heartbeat: typeof deviceAttendanceLogs.$inferInsert = {
        deviceId: payload.deviceId || deviceId,
        timestamp: new Date(payload.timestamp || Date.now()),
        status: payload.status || "online",
        synced: true,
      };

      // Update device status in database
      await db
        .update(devices)
        .set({
          lastSeen: new Date(),
          status: payload.status === "online" ? "active" : "offline",
          batteryLevel: payload.batteryLevel || null,
          signalStrength: payload.signalStrength || null,
        })
        .where(eq(devices.id, deviceId));

      this.emit("deviceHeartbeat", payload);
      console.log(`[IoT] Heartbeat from ${deviceId}: ${payload.status}`);
    } catch (error) {
      console.error("[IoT] Error handling heartbeat:", error);
    }
  }

  /**
   * Handle device configuration update
   */
  private async handleConfigUpdate(
    deviceId: string,
    payload: any
  ): Promise<void> {
    try {
      await db
        .update(devices)
        .set({
          config: JSON.stringify(payload),
          updatedAt: new Date(),
        })
        .where(eq(devices.id, deviceId));

      this.emit("configUpdated", { deviceId, config: payload });
      console.log(`[IoT] Configuration updated for ${deviceId}`);
    } catch (error) {
      console.error("[IoT] Error updating config:", error);
    }
  }

  /**
   * Handle raw sensor data
   */
  private async handleSensorData(
    deviceId: string,
    payload: any
  ): Promise<void> {
    this.emit("sensorData", { deviceId, data: payload });
    // Optionally store raw data for analytics
  }

  /**
   * Handle device alerts
   */
  private async handleDeviceAlert(
    deviceId: string,
    payload: any
  ): Promise<void> {
    this.emit("deviceAlert", { deviceId, alert: payload });
    console.warn(`[IoT] Alert from ${deviceId}:`, payload.alertMessage);
  }

  /**
   * Handle new device registration
   */
  private async handleDeviceRegistration(payload: any): Promise<void> {
    try {
      const deviceData: typeof devices.$inferInsert = {
        id: payload.deviceId,
        name: payload.deviceName || `Device ${payload.deviceId}`,
        location: payload.location || "Unassigned",
        roomId: payload.roomId || null,
        deviceType: payload.deviceType || "esp32",
        sensorType: payload.sensorType || "rfid",
        mqttTopic: `presence/devices/${payload.deviceId}`,
        macAddress: payload.macAddress || null,
        firmwareVersion: payload.firmwareVersion || "1.0.0",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(devices).values(deviceData).onConflictDoNothing();

      // Auto-approve device
      await db
        .update(devices)
        .set({ status: "active" })
        .where(eq(devices.id, payload.deviceId));

      this.emit("deviceRegistered", payload);
      console.log(`[IoT] New device registered: ${payload.deviceId}`);
    } catch (error) {
      console.error("[IoT] Error registering device:", error);
    }
  }

  /**
   * Start monitoring device heartbeats
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(async () => {
      const timeoutThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes

      try {
        await db.update(devices).set({ status: "offline" });
        and(
          eq.where(
            (devices.status, "active"),
            lte(devices.lastSeen, timeoutThreshold)
          )
        );

        // Find devices that haven't sent heartbeat recently
        const offlineDevices = await db.query.devices.findMany({
          where: (devices, { and, eq }) =>
            and(
              eq(devices.status, "active"),
              lte(devices.lastSeen, timeoutThreshold)
            ),
        });

        if (offlineDevices.length > 0) {
          console.log(`[IoT] ${offlineDevices.length} devices may be offline`);
          this.emit("devicesPotentiallyOffline", offlineDevices);
        }
      } catch (error) {
        console.error("[IoT] Heartbeat monitor error:", error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Publish message to device or topic
   */
  publish(topic: string, message: object, qos: number = 1): void {
    if (!this.client || !this.client.connected) {
      console.error("[IoT] Cannot publish: MQTT client not connected");
      return;
    }

    this.client.publish(topic, JSON.stringify(message), { qos }, (err) => {
      if (err) {
        console.error("[IoT] Publish error:", err);
      } else {
        console.log(`[IoT] Published to ${topic}:`, message);
      }
    });
  }

  /**
   * Send command to specific device
   */
  sendCommandToDevice(deviceId: string, command: string, payload: any): void {
    const topic = `presence/devices/${deviceId}/commands`;
    this.publish(topic, { command, ...payload, timestamp: Date.now() });
  }

  /**
   * Broadcast announcement to all devices
   */
  broadcastAnnouncement(message: string): void {
    const topic = "presence/broadcast/announcements";
    this.publish(topic, { message, timestamp: Date.now() });
  }

  /**
   * Request device sync
   */
  requestDeviceSync(deviceId: string): void {
    this.sendCommandToDevice(deviceId, "sync", { requestTime: Date.now() });
  }

  /**
   * Get all registered devices
   */
  getRegisteredDevices(): IoTDeviceConfig[] {
    return Array.from(this.deviceConfigs.values());
  }

  /**
   * Check if service is connected
   */
  isConnected(): boolean {
    return this.client?.connected || false;
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.client) {
      return new Promise((resolve) => {
        this.client?.end(true, () => {
          console.log("[IoT] Disconnected from MQTT broker");
          this.client = null;
          resolve();
        });
      });
    }
  }
}

// Export singleton instance
export const mqttIoTService = new MQTTIoTService();
