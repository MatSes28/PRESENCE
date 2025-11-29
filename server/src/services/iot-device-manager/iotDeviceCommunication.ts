import { db } from "../../storage.js";
import { iotDevices } from "../../schema.js";
import { eq } from "drizzle-orm";
import { sendToDevice } from "../websocket.js";

export class IoTDeviceCommunication {
  async sendCommandToDevice(
    deviceId: string,
    command: string,
    params?: any
  ): Promise<boolean> {
    // Validate command before sending
    const validation = await this.validateAndAuthorizeCommand(
      deviceId,
      command,
      params
    );
    if (!validation.authorized) {
      console.error(
        `Command validation failed for device ${deviceId}: ${validation.reason}`
      );
      return false;
    }

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

  async validateAndAuthorizeCommand(
    deviceId: string,
    command: string,
    params?: any
  ): Promise<{ authorized: boolean; reason?: string }> {
    try {
      // Get device information
      const device = await db
        .select({
          deviceType: iotDevices.deviceType,
          classroomId: iotDevices.classroomId,
          isActive: iotDevices.isActive,
        })
        .from(iotDevices)
        .where(eq(iotDevices.deviceId, deviceId))
        .limit(1);

      if (device.length === 0 || !device[0].isActive) {
        return { authorized: false, reason: "Device not found or inactive" };
      }

      const deviceInfo = device[0];

      // Define allowed commands per device type
      const allowedCommands: Record<string, string[]> = {
        esp32_s3: [
          "ping",
          "restart",
          "update_config",
          "update_firmware",
          "health_check",
          "diagnostics",
          "rfid_scan",
          "sensor_trigger",
          "attendance_record",
          "heartbeat",
        ],
        rfid_reader: [
          "ping",
          "restart",
          "update_config",
          "update_firmware",
          "health_check",
          "diagnostics",
          "rfid_scan",
          "heartbeat",
        ],
        ultrasonic_sensor: [
          "ping",
          "restart",
          "update_config",
          "update_firmware",
          "health_check",
          "diagnostics",
          "sensor_trigger",
          "attendance_record",
          "heartbeat",
        ],
      };

      // Check if command is allowed for this device type
      const deviceAllowedCommands =
        allowedCommands[deviceInfo.deviceType] || [];
      if (!deviceAllowedCommands.includes(command)) {
        return {
          authorized: false,
          reason: `Command '${command}' not allowed for device type '${deviceInfo.deviceType}'`,
        };
      }

      // Validate command parameters
      const paramValidation = this.validateCommandParameters(command, params);
      if (!paramValidation.valid) {
        return { authorized: false, reason: paramValidation.reason };
      }

      // Additional authorization checks can be added here
      // For example, classroom-specific restrictions, time-based restrictions, etc.

      return { authorized: true };
    } catch (error) {
      console.error("Error validating command:", error);
      return { authorized: false, reason: "Validation service error" };
    }
  }

  private validateCommandParameters(
    command: string,
    params?: any
  ): { valid: boolean; reason?: string } {
    if (!params) {
      // Commands that don't require parameters
      const noParamCommands = [
        "ping",
        "restart",
        "health_check",
        "diagnostics",
        "heartbeat",
      ];
      if (noParamCommands.includes(command)) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: `Command '${command}' requires parameters`,
      };
    }

    switch (command) {
      case "update_config":
        if (typeof params !== "object") {
          return { valid: false, reason: "Config must be an object" };
        }
        // Validate config structure based on device type
        break;

      case "update_firmware":
        if (!params.firmwareUrl || typeof params.firmwareUrl !== "string") {
          return { valid: false, reason: "Valid firmwareUrl required" };
        }
        // Validate URL format
        try {
          new URL(params.firmwareUrl);
        } catch {
          return { valid: false, reason: "Invalid firmware URL format" };
        }
        break;

      case "rfid_scan":
        if (!params.rfidUid || typeof params.rfidUid !== "string") {
          return { valid: false, reason: "Valid rfidUid required" };
        }
        break;

      case "sensor_trigger":
        if (
          !params.sensorType ||
          !["entry", "exit"].includes(params.sensorType)
        ) {
          return {
            valid: false,
            reason: "Valid sensorType ('entry' or 'exit') required",
          };
        }
        break;

      case "attendance_record":
        // Attendance records can have various fields, basic validation
        if (typeof params !== "object") {
          return {
            valid: false,
            reason: "Attendance record must be an object",
          };
        }
        break;

      default:
        // For unknown commands, accept any parameters for now
        break;
    }

    return { valid: true };
  }
}

export const iotDeviceCommunication = new IoTDeviceCommunication();
