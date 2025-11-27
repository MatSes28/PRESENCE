import { attendanceMonitor } from "../../../src/services/attendanceMonitor";

// Mock database operations
jest.mock("../../../src/storage.js", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => []),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => []),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => []),
        })),
      })),
    })),
  },
}));

// Mock WebSocket service
jest.mock("../../../src/services/websocket.js", () => ({
  getWebSocketClient: jest.fn(() => ({
    emit: jest.fn(),
  })),
}));

describe("AttendanceMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("RFID Processing", () => {
    it("should process valid RFID scan", async () => {
      const rfidData = {
        deviceId: "reader1",
        rfidUid: "ABC123",
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processRFIDScan(rfidData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("processed");
    });

    it("should handle invalid RFID format", async () => {
      const rfidData = {
        deviceId: "reader1",
        rfidUid: "", // Empty RFID
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processRFIDScan(rfidData);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid RFID");
    });

    it("should handle database errors during RFID processing", async () => {
      // Mock database error
      const mockDb = require("../../../src/storage.js").db;
      mockDb.select.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const rfidData = {
        deviceId: "reader1",
        rfidUid: "ABC123",
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processRFIDScan(rfidData);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Database error");
    });
  });

  describe("Sensor Processing", () => {
    it("should process valid entry sensor trigger", async () => {
      const sensorData = {
        deviceId: "sensor1",
        sensorType: "entry" as const,
        distance: 25, // Valid distance
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processSensorTrigger(sensorData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("processed");
    });

    it("should reject invalid sensor type", async () => {
      const sensorData = {
        deviceId: "sensor1",
        sensorType: "invalid" as any,
        distance: 50,
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processSensorTrigger(sensorData);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid sensor type");
    });

    it("should handle exit sensor with valid distance", async () => {
      const sensorData = {
        deviceId: "sensor2",
        sensorType: "exit" as const,
        distance: 30,
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processSensorTrigger(sensorData);

      expect(result.success).toBe(true);
    });

    it("should reject sensor trigger with invalid distance", async () => {
      const sensorData = {
        deviceId: "sensor1",
        sensorType: "entry" as const,
        distance: 150, // Too far
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processSensorTrigger(sensorData);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid distance");
    });
  });

  describe("Attendance Validation", () => {
    it("should validate attendance record successfully", async () => {
      const recordId = 1;

      const result = await attendanceMonitor.validateAttendanceRecord(recordId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("validated");
    });

    it("should handle validation of non-existent record", async () => {
      // Mock empty result
      const mockDb = require("../../../src/storage.js").db;
      mockDb.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      });

      const recordId = 999;

      const result = await attendanceMonitor.validateAttendanceRecord(recordId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("Attendance Statistics", () => {
    it("should calculate attendance statistics", async () => {
      const sessionId = 1;

      const stats = await attendanceMonitor.getAttendanceStats(sessionId);

      expect(stats).toHaveProperty("totalStudents");
      expect(stats).toHaveProperty("presentCount");
      expect(stats).toHaveProperty("absentCount");
      expect(stats).toHaveProperty("attendanceRate");
    });

    it("should handle empty session statistics", async () => {
      // Mock empty results
      const mockDb = require("../../../src/storage.js").db;
      mockDb.select.mockReturnValue({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              groupBy: () => [],
            }),
          }),
        }),
      });

      const sessionId = 1;

      const stats = await attendanceMonitor.getAttendanceStats(sessionId);

      expect(stats.totalStudents).toBe(0);
      expect(stats.presentCount).toBe(0);
      expect(stats.absentCount).toBe(0);
      expect(stats.attendanceRate).toBe(0);
    });
  });

  describe("Real-time Updates", () => {
    it("should emit WebSocket events for RFID scans", async () => {
      const mockWsClient =
        require("../../../src/services/websocket.js").getWebSocketClient();

      const rfidData = {
        deviceId: "reader1",
        rfidUid: "ABC123",
        timestamp: new Date().toISOString(),
      };

      await attendanceMonitor.processRFIDScan(rfidData);

      expect(mockWsClient.emit).toHaveBeenCalledWith(
        "rfidScan",
        expect.any(Object)
      );
    });

    it("should emit WebSocket events for sensor triggers", async () => {
      const mockWsClient =
        require("../../../src/services/websocket.js").getWebSocketClient();

      const sensorData = {
        deviceId: "sensor1",
        sensorType: "entry" as const,
        distance: 25,
        timestamp: new Date().toISOString(),
      };

      await attendanceMonitor.processSensorTrigger(sensorData);

      expect(mockWsClient.emit).toHaveBeenCalledWith(
        "sensorTrigger",
        expect.any(Object)
      );
    });

    it("should emit WebSocket events for attendance records", async () => {
      const mockWsClient =
        require("../../../src/services/websocket.js").getWebSocketClient();

      // This would be triggered internally when attendance is recorded
      // We test the emission mechanism indirectly
      expect(mockWsClient.emit).toHaveBeenCalledTimes(0); // Initially no calls

      // After processing, it should emit
      const rfidData = {
        deviceId: "reader1",
        rfidUid: "ABC123",
        timestamp: new Date().toISOString(),
      };

      await attendanceMonitor.processRFIDScan(rfidData);

      expect(mockWsClient.emit).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      const mockDb = require("../../../src/storage.js").db;
      mockDb.select.mockImplementation(() => {
        throw new Error("Connection timeout");
      });

      const rfidData = {
        deviceId: "reader1",
        rfidUid: "ABC123",
        timestamp: new Date().toISOString(),
      };

      const result = await attendanceMonitor.processRFIDScan(rfidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection timeout");
    });

    it("should handle WebSocket emission errors", async () => {
      const mockWsClient =
        require("../../../src/services/websocket.js").getWebSocketClient();
      mockWsClient.emit.mockImplementation(() => {
        throw new Error("WebSocket error");
      });

      const rfidData = {
        deviceId: "reader1",
        rfidUid: "ABC123",
        timestamp: new Date().toISOString(),
      };

      // Should not throw, should handle error internally
      const result = await attendanceMonitor.processRFIDScan(rfidData);

      expect(result.success).toBe(true); // Processing succeeds even if WS fails
    });
  });
});
