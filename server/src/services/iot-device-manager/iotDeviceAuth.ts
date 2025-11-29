import { db } from "../../storage.js";
import { iotDevices } from "../../schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export class IoTDeviceAuth {
  async authenticateDeviceByApiKey(
    apiKey: string
  ): Promise<{ deviceId: string; classroomId: number } | null> {
    try {
      const device = await db
        .select({
          deviceId: iotDevices.deviceId,
          classroomId: iotDevices.classroomId,
          isActive: iotDevices.isActive,
        })
        .from(iotDevices)
        .where(eq(iotDevices.apiKey, apiKey))
        .limit(1);

      if (device.length === 0 || !device[0].isActive) {
        return null;
      }

      return {
        deviceId: device[0].deviceId,
        classroomId: device[0].classroomId,
      };
    } catch (error) {
      console.error("Error authenticating device by API key:", error);
      return null;
    }
  }

  async authenticateDeviceByCertificate(
    fingerprint: string
  ): Promise<{ deviceId: string; classroomId: number } | null> {
    try {
      const device = await db
        .select({
          deviceId: iotDevices.deviceId,
          classroomId: iotDevices.classroomId,
          isActive: iotDevices.isActive,
        })
        .from(iotDevices)
        .where(eq(iotDevices.certificateFingerprint, fingerprint))
        .limit(1);

      if (device.length === 0 || !device[0].isActive) {
        return null;
      }

      return {
        deviceId: device[0].deviceId,
        classroomId: device[0].classroomId,
      };
    } catch (error) {
      console.error("Error authenticating device by certificate:", error);
      return null;
    }
  }

  async updateDeviceCertificate(
    deviceId: string,
    certificateData: string,
    fingerprint: string
  ): Promise<boolean> {
    try {
      await db
        .update(iotDevices)
        .set({
          certificateData: certificateData,
          certificateFingerprint: fingerprint,
          updatedAt: new Date(),
        })
        .where(eq(iotDevices.deviceId, deviceId));

      console.log(`Updated certificate for device: ${deviceId}`);
      return true;
    } catch (error) {
      console.error("Error updating device certificate:", error);
      return false;
    }
  }

  async getDeviceApiKey(deviceId: string): Promise<string | null> {
    try {
      const device = await db
        .select({ apiKey: iotDevices.apiKey })
        .from(iotDevices)
        .where(eq(iotDevices.deviceId, deviceId))
        .limit(1);

      return device.length > 0 ? device[0].apiKey : null;
    } catch (error) {
      console.error("Error getting device API key:", error);
      return null;
    }
  }

  async regenerateDeviceApiKey(deviceId: string): Promise<string | null> {
    try {
      const newApiKey = crypto.randomBytes(32).toString("hex");

      await db
        .update(iotDevices)
        .set({
          apiKey: newApiKey,
          updatedAt: new Date(),
        })
        .where(eq(iotDevices.deviceId, deviceId));

      console.log(`Regenerated API key for device: ${deviceId}`);
      return newApiKey;
    } catch (error) {
      console.error("Error regenerating device API key:", error);
      return null;
    }
  }
}

export const iotDeviceAuth = new IoTDeviceAuth();
