import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import db from "../../../src/storage.js";
import { iotDeviceManager } from "../../../src/services/iotDeviceManager.js";

describe("IoTDeviceManager", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("Command queue", () => {
    it("queues command and exposes pending commands", async () => {
      const ok = await iotDeviceManager.sendCommandToDevice(
        "device123",
        "ping",
        {
          at: Date.now(),
        },
      );

      expect(ok).toBe(true);

      const pending = iotDeviceManager.getPendingCommandsForDevice("device123");
      expect(Array.isArray(pending)).toBe(true);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].device_id).toBe("device123");
      expect(pending[0].command).toBe("ping");
    });

    it("acknowledges queued command", async () => {
      await iotDeviceManager.sendCommandToDevice("device123", "ping");
      const [cmd] = iotDeviceManager.getPendingCommandsForDevice("device123");

      const acked = iotDeviceManager.markCommandAcknowledged(
        cmd.id,
        "device123",
      );
      expect(acked).toBe(true);

      const pendingAfterAck =
        iotDeviceManager.getPendingCommandsForDevice("device123");
      expect(pendingAfterAck.find((c) => c.id === cmd.id)).toBeUndefined();
    });
  });

  describe("Command authorization", () => {
    it("rejects unknown command", async () => {
      const result = await iotDeviceManager.validateAndAuthorizeCommand(
        "device123",
        "invalid_command",
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain("not allowed");
    });

    it("rejects missing RFID payload for rfid_scan", async () => {
      const result = await iotDeviceManager.validateAndAuthorizeCommand(
        "device123",
        "rfid_scan",
        {},
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain("rfidUid");
    });
  });

  describe("Simple service methods", () => {
    it("restarts device by queuing restart command", async () => {
      const ok = await iotDeviceManager.restartDevice("device123");
      expect(ok).toBe(true);

      const pending = iotDeviceManager.getPendingCommandsForDevice("device123");
      expect(pending.some((c) => c.command === "restart")).toBe(true);
    });

    it("returns static health check payload", async () => {
      const health = await iotDeviceManager.performHealthCheck("device123");
      expect(health.status).toBe("healthy");
      expect(health.uptime).toBeGreaterThan(0);
    });

    it("returns empty maintenance recommendations", async () => {
      const recommendations =
        await iotDeviceManager.getMaintenanceRecommendations();
      expect(recommendations).toEqual([]);
    });

    it("returns null for unknown API key when db select yields empty", async () => {
      (db as any).select = jest.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }));

      const result =
        await iotDeviceManager.authenticateDeviceByApiKey("invalid-key");
      expect(result).toBeNull();
    });
  });
});
