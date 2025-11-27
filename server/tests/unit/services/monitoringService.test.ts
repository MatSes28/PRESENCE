import { monitoringService } from "../../../src/services/monitoringService";
import {
  ValidationError,
  AuthenticationError,
} from "../../../src/middleware/errorHandler";

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

      monitoringService.logError(error, context, metadata);

      // Verify the logger was called (mocked)
      expect(monitoringService.logError).toHaveBeenCalledWith(
        error,
        context,
        metadata
      );
    });

    it("should log warnings with proper context", () => {
      const message = "Test warning";
      const context = {
        endpoint: "/api/test",
        userId: 123,
      };

      monitoringService.logWarning(message, context);

      expect(monitoringService.logWarning).toHaveBeenCalledWith(
        message,
        context,
        {}
      );
    });

    it("should log info messages", () => {
      const message = "Test info";
      const context = { endpoint: "/api/test" };

      monitoringService.logInfo(message, context);

      expect(monitoringService.logInfo).toHaveBeenCalledWith(
        message,
        context,
        {}
      );
    });
  });

  describe("Performance Tracing", () => {
    it("should start and end traces correctly", () => {
      const operation = "test-operation";
      const metadata = { userId: 123, endpoint: "/api/test" };

      const traceId = monitoringService.startTrace(operation, metadata);
      expect(typeof traceId).toBe("string");
      expect(traceId).toContain("trace_");

      monitoringService.endTrace(traceId, true, { responseTime: 150 });

      expect(monitoringService.startTrace).toHaveBeenCalledWith(
        operation,
        metadata
      );
      expect(monitoringService.endTrace).toHaveBeenCalledWith(traceId, true, {
        responseTime: 150,
      });
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
      expect(metrics).toContain("# TYPE");
    });

    it("should include system metrics in Prometheus format", async () => {
      const metrics = await monitoringService.getPrometheusMetrics();

      expect(metrics).toContain("presence_system_cpu_usage");
      expect(metrics).toContain("presence_system_memory_usage");
      expect(metrics).toContain("presence_system_status");
      expect(metrics).toContain("presence_uptime_seconds");
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
