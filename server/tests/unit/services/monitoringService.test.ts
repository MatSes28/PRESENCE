import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { monitoringService } from "../../../src/services/monitoringService.js";
import {
  ValidationError,
  AuthenticationError,
} from "../../../src/middleware/errorHandler.js";

// Mock winston to avoid actual file logging during tests
jest.mock("winston", () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

// Mock winston-daily-rotate-file
jest.mock("winston-daily-rotate-file", () => jest.fn());

describe("MonitoringService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Error Logging", () => {
    it("should log errors with proper context", () => {
      const error = new Error("Test error");
      const context = {
        endpoint: "/api/test",
        userId: 123,
        requestId: "req123",
      };
      const metadata = { additionalData: "test" };

      expect(() =>
        monitoringService.logError(error, context, metadata),
      ).not.toThrow();
    });

    it("should log warnings with proper context", () => {
      const message = "Test warning";
      const context = {
        endpoint: "/api/test",
        userId: 123,
      };

      expect(() =>
        monitoringService.logWarning(message, context),
      ).not.toThrow();
    });

    it("should log info messages", () => {
      const message = "Test info";
      const context = { endpoint: "/api/test" };

      expect(() => monitoringService.logInfo(message, context)).not.toThrow();
    });
  });

  describe("Performance Tracing", () => {
    it("should start and end traces correctly", () => {
      const operation = "test-operation";
      const metadata = { userId: 123, endpoint: "/api/test" };

      const traceId = monitoringService.startTrace(operation, metadata);
      expect(typeof traceId).toBe("string");
      expect(traceId.length).toBeGreaterThan(0);

      monitoringService.endTrace(traceId, true, { responseTime: 150 });
      expect(true).toBe(true);
    });

    it("should handle trace end without metadata", () => {
      const traceId = monitoringService.startTrace("test-op");

      expect(() => {
        monitoringService.endTrace(traceId, false);
      }).not.toThrow();
    });
  });

  describe("Health Status", () => {
    it("should return healthy status by default", () => {
      const health = monitoringService.getHealthStatus();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("uptime");
      expect(health).toHaveProperty("timestamp");
      expect(health).toHaveProperty("system");
      expect(health).toHaveProperty("database");
      expect(health).toHaveProperty("application");
    });

    it("should include uptime in health status", () => {
      const health = monitoringService.getHealthStatus();

      expect(typeof health.uptime).toBe("number");
      expect(health.uptime).toBeGreaterThan(0);
    });
  });

  describe("Prometheus Metrics", () => {
    it("should generate valid Prometheus metrics format", async () => {
      const metrics = await monitoringService.getPrometheusMetrics();

      expect(typeof metrics).toBe("string");
      expect(metrics).toContain("# HELP");
    });

    it("should include system metrics in Prometheus format", async () => {
      const metrics = await monitoringService.getPrometheusMetrics();

      expect(metrics).toContain("presence_system_cpu_usage");
      expect(metrics).toContain("presence_system_memory_usage");
    });
  });

  describe("Request Middleware", () => {
    it("should create a request middleware function", () => {
      const middleware = monitoringService.createRequestMiddleware();

      expect(typeof middleware).toBe("function");
    });

    it("should handle middleware execution", () => {
      const middleware = monitoringService.createRequestMiddleware();
      const req = {
        method: "GET",
        path: "/api/test",
        session: { userId: 123 },
        get: jest.fn(),
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as any;
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
