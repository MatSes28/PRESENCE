import { db } from "../storage.js";
import { iotDevices, classrooms } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { sendToDevice } from "./websocket.js";
import * as dgram from "dgram";
import * as net from "net";

interface DeviceConfig {
  deviceId: string;
  classroomId: number;
  deviceType: string;
  config?: any;
}

interface DeviceStatus {
  deviceId: string;
  status: "online" | "offline" | "maintenance";
  lastSeen: Date;
  config?: any;
}

interface DiscoveredDevice {
  ip: string;
  mac?: string;
  deviceId?: string;
  deviceType?: string;
  hostname?: string;
  services?: string[];
  lastSeen: Date;
}

interface HealthMetrics {
  deviceId: string;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  temperature?: number;
  signalStrength?: number;
  errorCount: number;
  lastHealthCheck: Date;
}

class IoTDeviceManager {
  private deviceStatuses = new Map<string, DeviceStatus>();
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  private healthMetrics = new Map<string, HealthMetrics>();
  private discoveryServer?: dgram.Socket;
  private isDiscovering = false;

  async registerDevice(config: DeviceConfig) {
    try {
      // Check if device already exists
      const existingDevice = await db
        .select()
        .from(iotDevices)
        .where(eq(iotDevices.deviceId, config.deviceId))
        .limit(1);

      if (existingDevice.length > 0) {
        // Update existing device
        const [updatedDevice] = await db
          .update(iotDevices)
          .set({
            classroomId: config.classroomId,
            deviceType: config.deviceType,
            config: config.config,
            status: "offline",
            updatedAt: new Date(),
          })
          .where(eq(iotDevices.deviceId, config.deviceId))
          .returning();

        console.log(`Updated IoT device: ${config.deviceId}`);
        return updatedDevice;
      } else {
        // Create new device
        const [newDevice] = await db
          .insert(iotDevices)
          .values({
            deviceId: config.deviceId,
            classroomId: config.classroomId,
            deviceType: config.deviceType,
            config: config.config,
            status: "offline",
          })
          .returning();

        console.log(`Registered new IoT device: ${config.deviceId}`);
        return newDevice;
      }
    } catch (error) {
      console.error("Error registering IoT device:", error);
      throw error;
    }
  }

  async updateDeviceStatus(
    deviceId: string,
    status: DeviceStatus["status"],
    config?: any
  ) {
    try {
      const now = new Date();

      // Update in-memory status
      this.deviceStatuses.set(deviceId, {
        deviceId,
        status,
        lastSeen: now,
        config,
      });

      // Update database
      await db
        .update(iotDevices)
        .set({
          status,
          lastSeen: now,
          config,
          updatedAt: now,
        })
        .where(eq(iotDevices.deviceId, deviceId));

      console.log(`Updated device status: ${deviceId} -> ${status}`);
    } catch (error) {
      console.error("Error updating device status:", error);
    }
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
    // Check in-memory cache first
    const cached = this.deviceStatuses.get(deviceId);
    if (cached && Date.now() - cached.lastSeen.getTime() < 60000) {
      // Within 1 minute
      return cached;
    }

    // Fallback to database
    try {
      const device = await db
        .select()
        .from(iotDevices)
        .where(eq(iotDevices.deviceId, deviceId))
        .limit(1);

      if (device.length > 0) {
        const dbDevice = device[0];
        const status: DeviceStatus = {
          deviceId: dbDevice.deviceId,
          status: dbDevice.status as DeviceStatus["status"],
          lastSeen: dbDevice.lastSeen || new Date(),
          config: dbDevice.config,
        };

        // Update cache
        this.deviceStatuses.set(deviceId, status);
        return status;
      }
    } catch (error) {
      console.error("Error getting device status:", error);
    }

    return null;
  }

  async getDevicesByClassroom(classroomId: number) {
    try {
      return await db
        .select({
          device: iotDevices,
          classroom: classrooms,
        })
        .from(iotDevices)
        .innerJoin(classrooms, eq(iotDevices.classroomId, classrooms.id))
        .where(eq(iotDevices.classroomId, classroomId));
    } catch (error) {
      console.error("Error getting devices by classroom:", error);
      return [];
    }
  }

  async getAllDevices() {
    try {
      return await db
        .select({
          device: iotDevices,
          classroom: classrooms,
        })
        .from(iotDevices)
        .innerJoin(classrooms, eq(iotDevices.classroomId, classrooms.id));
    } catch (error) {
      console.error("Error getting all devices:", error);
      return [];
    }
  }

  async sendCommandToDevice(
    deviceId: string,
    command: string,
    params?: any
  ): Promise<boolean> {
    const message = {
      type: "command",
      command,
      params,
      timestamp: new Date().toISOString(),
    };

    return sendToDevice(deviceId, "command", message);
  }

  async configureDevice(deviceId: string, config: any): Promise<boolean> {
    try {
      // Update database
      await db
        .update(iotDevices)
        .set({
          config,
          updatedAt: new Date(),
        })
        .where(eq(iotDevices.deviceId, deviceId));

      // Send config to device
      return this.sendCommandToDevice(deviceId, "update_config", config);
    } catch (error) {
      console.error("Error configuring device:", error);
      return false;
    }
  }

  async restartDevice(deviceId: string): Promise<boolean> {
    return this.sendCommandToDevice(deviceId, "restart");
  }

  async updateDeviceFirmware(
    deviceId: string,
    firmwareUrl: string
  ): Promise<boolean> {
    return this.sendCommandToDevice(deviceId, "update_firmware", {
      firmwareUrl,
    });
  }

  async getOnlineDevices(): Promise<string[]> {
    const onlineDevices: string[] = [];

    for (const [deviceId, status] of this.deviceStatuses) {
      if (
        status.status === "online" &&
        Date.now() - status.lastSeen.getTime() < 300000
      ) {
        // Within 5 minutes
        onlineDevices.push(deviceId);
      }
    }

    return onlineDevices;
  }

  async cleanupOfflineDevices() {
    const now = Date.now();
    const offlineThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [deviceId, status] of this.deviceStatuses) {
      if (now - status.lastSeen.getTime() > offlineThreshold) {
        await this.updateDeviceStatus(deviceId, "offline");
      }
    }

    console.log("Cleaned up offline devices");
  }

  // Start periodic cleanup
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupOfflineDevices();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async getDeviceStats() {
    const allDevices = await this.getAllDevices();
    const onlineDevices = await this.getOnlineDevices();

    return {
      total: allDevices.length,
      online: onlineDevices.length,
      offline: allDevices.length - onlineDevices.length,
      byType: allDevices.reduce((acc, item) => {
        const type = item.device.classroomId.toString(); // Simplified - group by classroom
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // Hardware Auto-Discovery Methods
  async startNetworkDiscovery(
    subnet: string = "192.168.1.0/24"
  ): Promise<void> {
    if (this.isDiscovering) {
      throw new Error("Network discovery already in progress");
    }

    this.isDiscovering = true;
    console.log(`Starting network discovery on subnet: ${subnet}`);

    try {
      // Parse subnet
      const [baseIP, mask] = subnet.split("/");
      const prefix = baseIP.split(".").slice(0, 3).join(".");

      // Create UDP discovery server
      this.discoveryServer = dgram.createSocket("udp4");

      this.discoveryServer.on("message", (msg, rinfo) => {
        try {
          const message = JSON.parse(msg.toString());
          if (message.type === "device_announce") {
            this.handleDeviceAnnouncement(message, rinfo.address);
          }
        } catch (error) {
          // Ignore invalid messages
        }
      });

      this.discoveryServer.bind(41234, () => {
        console.log("Discovery server listening on port 41234");
      });

      // Send discovery broadcasts
      await this.sendDiscoveryBroadcasts(prefix);

      // Wait for responses
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
    } finally {
      this.stopNetworkDiscovery();
    }
  }

  private async sendDiscoveryBroadcasts(prefix: string): Promise<void> {
    const client = dgram.createSocket("udp4");

    for (let i = 1; i <= 254; i++) {
      const targetIP = `${prefix}.${i}`;
      const message = JSON.stringify({
        type: "discovery_request",
        serverIP: this.getLocalIP(),
        timestamp: new Date().toISOString(),
      });

      client.send(message, 0, message.length, 41234, targetIP, (err) => {
        if (err) {
          // Ignore send errors
        }
      });
    }

    // Also try broadcast
    const broadcastMessage = JSON.stringify({
      type: "discovery_broadcast",
      serverIP: this.getLocalIP(),
      timestamp: new Date().toISOString(),
    });

    client.send(
      broadcastMessage,
      0,
      broadcastMessage.length,
      41234,
      `${prefix}.255`
    );
    client.close();
  }

  private handleDeviceAnnouncement(message: any, ip: string): void {
    const device: DiscoveredDevice = {
      ip,
      mac: message.mac,
      deviceId: message.deviceId,
      deviceType: message.deviceType,
      hostname: message.hostname,
      services: message.services || [],
      lastSeen: new Date(),
    };

    this.discoveredDevices.set(ip, device);
    console.log(
      `Discovered device: ${device.deviceId || device.hostname} at ${ip}`
    );
  }

  async stopNetworkDiscovery(): Promise<void> {
    if (this.discoveryServer) {
      this.discoveryServer.close();
      this.discoveryServer = undefined;
    }
    this.isDiscovering = false;
    console.log("Network discovery stopped");
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  async registerDiscoveredDevice(
    ip: string,
    classroomId: number
  ): Promise<boolean> {
    const device = this.discoveredDevices.get(ip);
    if (!device || !device.deviceId) {
      return false;
    }

    try {
      await this.registerDevice({
        deviceId: device.deviceId,
        classroomId,
        deviceType: device.deviceType || "unknown",
        config: {
          ip: device.ip,
          mac: device.mac,
          hostname: device.hostname,
          services: device.services,
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to register discovered device:", error);
      return false;
    }
  }

  // Health Monitoring Methods
  async performHealthCheck(deviceId: string): Promise<HealthMetrics | null> {
    try {
      // Request health data from device
      const success = await this.sendCommandToDevice(deviceId, "health_check");

      if (!success) {
        return null;
      }

      // In a real implementation, the device would respond with health data
      // For now, we'll simulate health metrics
      const metrics: HealthMetrics = {
        deviceId,
        uptime: Math.floor(Math.random() * 86400), // Random uptime in seconds
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        temperature: 25 + Math.random() * 30, // 25-55°C
        signalStrength: Math.floor(Math.random() * 100),
        errorCount: Math.floor(Math.random() * 10),
        lastHealthCheck: new Date(),
      };

      this.healthMetrics.set(deviceId, metrics);
      return metrics;
    } catch (error) {
      console.error(`Health check failed for device ${deviceId}:`, error);
      return null;
    }
  }

  async getDeviceHealthMetrics(
    deviceId: string
  ): Promise<HealthMetrics | null> {
    return this.healthMetrics.get(deviceId) || null;
  }

  async getAllHealthMetrics(): Promise<HealthMetrics[]> {
    return Array.from(this.healthMetrics.values());
  }

  async performBulkHealthCheck(): Promise<{
    checked: number;
    healthy: number;
    issues: number;
  }> {
    const allDevices = await this.getAllDevices();
    let checked = 0;
    let healthy = 0;
    let issues = 0;

    for (const device of allDevices) {
      const metrics = await this.performHealthCheck(device.device.deviceId);
      if (metrics) {
        checked++;
        // Simple health check: CPU < 90%, Memory < 90%, Temperature < 50°C
        if (
          metrics.cpuUsage < 90 &&
          metrics.memoryUsage < 90 &&
          (!metrics.temperature || metrics.temperature < 50)
        ) {
          healthy++;
        } else {
          issues++;
        }
      }
    }

    return { checked, healthy, issues };
  }

  // Predictive Maintenance
  async getMaintenanceRecommendations(): Promise<
    Array<{
      deviceId: string;
      recommendation: string;
      priority: "low" | "medium" | "high";
      reason: string;
    }>
  > {
    const recommendations = [];
    const healthMetrics = await this.getAllHealthMetrics();

    for (const metrics of healthMetrics) {
      if (metrics.cpuUsage > 85) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Schedule CPU performance check",
          priority: "medium",
          reason: `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        });
      }

      if (metrics.memoryUsage > 85) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Check memory usage and clear cache",
          priority: "medium",
          reason: `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
        });
      }

      if (metrics.temperature && metrics.temperature > 45) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Check cooling system and ventilation",
          priority: "high",
          reason: `High temperature: ${metrics.temperature.toFixed(1)}°C`,
        });
      }

      if (metrics.errorCount > 5) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Review error logs and firmware update",
          priority: "high",
          reason: `High error count: ${metrics.errorCount} errors`,
        });
      }
    }

    return recommendations;
  }

  // Utility Methods
  private getLocalIP(): string {
    // In a real implementation, you'd detect the local IP
    // For now, return a placeholder
    return "192.168.1.100";
  }

  // Start periodic health monitoring
  startHealthMonitoring(): void {
    // Perform health checks every 30 minutes
    setInterval(async () => {
      await this.performBulkHealthCheck();
    }, 30 * 60 * 1000);

    // Clean up old discovered devices every hour
    setInterval(() => {
      this.cleanupDiscoveredDevices();
    }, 60 * 60 * 1000);
  }

  private cleanupDiscoveredDevices(): void {
    const now = Date.now();
    const timeout = 24 * 60 * 60 * 1000; // 24 hours

    for (const [ip, device] of this.discoveredDevices) {
      if (now - device.lastSeen.getTime() > timeout) {
        this.discoveredDevices.delete(ip);
      }
    }

    console.log("Cleaned up old discovered devices");
  }
}

export const iotDeviceManager = new IoTDeviceManager();

// Start periodic cleanup when module is loaded
iotDeviceManager.startPeriodicCleanup();
