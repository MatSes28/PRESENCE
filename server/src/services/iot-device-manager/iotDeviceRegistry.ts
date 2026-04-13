import db from "../../storage.js";
import { iotDevices, classrooms } from "../../schema.js";
import { eq, and } from "drizzle-orm";
import { cacheService } from "../cacheService.js";

export interface DeviceConfig {
  deviceId: string;
  classroomId: number;
  deviceType: string;
  config?: any;
}

export interface DeviceStatus {
  deviceId: string;
  status: "online" | "offline" | "maintenance";
  lastSeen: Date;
  config?: any;
}

export class IoTDeviceRegistry {
  private deviceStatuses = new Map<string, DeviceStatus>();

  private readonly deviceSelect = {
    id: iotDevices.id,
    deviceId: iotDevices.deviceId,
    classroomId: iotDevices.classroomId,
    deviceType: iotDevices.deviceType,
    status: iotDevices.status,
    lastSeen: iotDevices.lastSeen,
    config: iotDevices.config,
    apiKey: iotDevices.apiKey,
    isActive: iotDevices.isActive,
    createdAt: iotDevices.createdAt,
    updatedAt: iotDevices.updatedAt,
  };

  private readonly classroomSelect = {
    id: classrooms.id,
    name: classrooms.name,
    location: classrooms.location,
    type: classrooms.type,
    capacity: classrooms.capacity,
  };

  async registerDevice(config: DeviceConfig) {
    try {
      // Check if device already exists
      const existingDevice = await db
        .select(this.deviceSelect)
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
          .returning(this.deviceSelect);

        console.log(`Updated IoT device: ${config.deviceId}`);
        return updatedDevice;
      } else {
        // Generate API key for new device
        const crypto = await import("crypto");
        const apiKey = crypto.default.randomBytes(32).toString("hex");

        // Create new device
        const [newDevice] = await db
          .insert(iotDevices)
          .values({
            deviceId: config.deviceId,
            classroomId: config.classroomId,
            deviceType: config.deviceType,
            config: config.config,
            status: "offline",
            apiKey: apiKey,
          })
          .returning(this.deviceSelect);

        console.log(
          `Registered new IoT device: ${
            config.deviceId
          } with API key: ${apiKey.substring(0, 8)}...`
        );
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

      // Invalidate cache
      await cacheService.invalidateIoTDevices();
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
        .select(this.deviceSelect)
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
    const cacheKey = `iot_devices:classroom:${classroomId}`;

    // Try cache first
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const devices = await db
        .select({
          device: this.deviceSelect,
          classroom: this.classroomSelect,
        })
        .from(iotDevices)
        .innerJoin(classrooms, eq(iotDevices.classroomId, classrooms.id))
        .where(eq(iotDevices.classroomId, classroomId));

      // Cache for 5 minutes
      await cacheService.set(cacheKey, devices, { ttl: 300 });
      return devices;
    } catch (error) {
      console.error("Error getting devices by classroom:", error);
      return [];
    }
  }

  async getAllDevices() {
    const cacheKey = "iot_devices:all";

    // Try cache first
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const devices = await db
        .select({
          device: this.deviceSelect,
          classroom: this.classroomSelect,
        })
        .from(iotDevices)
        .innerJoin(classrooms, eq(iotDevices.classroomId, classrooms.id));

      // Cache for 5 minutes
      await cacheService.set(cacheKey, devices, { ttl: 300 });
      return devices;
    } catch (error) {
      console.error("Error getting all devices:", error);
      return [];
    }
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
    // Use configurable heartbeat timeout (default 5 minutes = 300 seconds)
    const offlineThreshold =
      parseInt(process.env.HEARTBEAT_TIMEOUT || "300", 10) * 1000;

    for (const [deviceId, status] of this.deviceStatuses) {
      if (now - status.lastSeen.getTime() > offlineThreshold) {
        await this.updateDeviceStatus(deviceId, "offline");
      }
    }

    console.log("Cleaned up offline devices");
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

  // Start periodic cleanup
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupOfflineDevices();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

export const iotDeviceRegistry = new IoTDeviceRegistry();
