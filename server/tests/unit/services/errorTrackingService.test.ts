import {
  errorTrackingService,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from "../../../src/services/errorTrackingService";

// Mock external dependencies
jest.mock("../../../src/storage.js", () => ({
  db: {
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => [{ id: 1 }]),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => []),
        })),
      })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => []),
          })),
        })),
      })),
    })),
  },
}));

jest.mock("../../../src/services/monitoringService.js", () => ({
  monitoringService: {
    logError: jest.fn(),
  },
}));

jest.mock("../../../src/services/alertingService.js", () => ({
  alertingService: {
    sendCriticalErrorAlert: jest.fn(),
    sendDatabaseAlert: jest.fn(),
    sendSecurityAlert: jest.fn(),
  },
}));

describe("ErrorTrackingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Error Logging", () => {
    it("should log error successfully", async () => {
      const mockInsert = require("../../../src/storage.js").db.insert;
      const mockMonitoringLog =
        require("../../../src/services/monitoringService.js").monitoringService
          .logError;

      const error = new Error("Test error");
      const context = { userId: 1, endpoint: "/api/test" };
      const metadata = { tags: ["test"] };

      const errorId = await errorTrackingService.logError(
        error,
        context,
        metadata,
        ErrorCategory.SYSTEM,
        ErrorSeverity.MEDIUM
      );

      expect(mockMonitoringLog).toHaveBeenCalledWith(
        error,
        context,
        expect.any(Object)
      );
      expect(mockInsert).toHaveBeenCalled();
      expect(errorId).toBe(1);
    });

    it("should determine error category automatically", async () => {
      const mockInsert = require("../../../src/storage.js").db.insert;

      const validationError = new Error("Validation failed for field");
      const errorId = await errorTrackingService.logError(validationError);

      expect(mockInsert).toHaveBeenCalled();
      // Check that the category was determined as validation
      const insertCall = mockInsert.mock.calls[0][0].values.mock.calls[0][0];
      expect(insertCall.category).toBe(ErrorCategory.VALIDATION);
    });

    it("should handle database logging failure", async () => {
      const mockInsert = require("../../../src/storage.js").db.insert;
      mockInsert.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const error = new Error("Test error");
      const errorId = await errorTrackingService.logError(error);

      expect(errorId).toBe(-1);
    });

    it("should trigger critical error alerts", async () => {
      const mockAlerting =
        require("../../../src/services/alertingService.js").alertingService;

      const error = new Error("Critical system failure");
      const context = { userId: 1, endpoint: "/api/critical" };

      await errorTrackingService.logError(
        error,
        context,
        {},
        ErrorCategory.SYSTEM,
        ErrorSeverity.CRITICAL
      );

      expect(mockAlerting.sendCriticalErrorAlert).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          endpoint: "/api/critical",
          userId: 1,
        })
      );
    });

    it("should trigger database alerts for database errors", async () => {
      const mockAlerting =
        require("../../../src/services/alertingService.js").alertingService;

      const error = new Error("Database connection failed");
      const context = { endpoint: "/api/db" };

      await errorTrackingService.logError(
        error,
        context,
        {},
        ErrorCategory.DATABASE,
        ErrorSeverity.HIGH
      );

      expect(mockAlerting.sendDatabaseAlert).toHaveBeenCalledWith(
        expect.stringContaining("Database connection issue"),
        expect.any(Object)
      );
    });
  });

  describe("Recovery Attempts", () => {
    it("should log recovery attempt", async () => {
      const mockInsert = require("../../../src/storage.js").db.insert;

      await errorTrackingService["logRecoveryAttempt"](
        1,
        1,
        RecoveryStrategy.RETRY,
        "success"
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.any(Function),
        })
      );
    });

    it("should attempt recovery with retry strategy", async () => {
      const recoveryConfig = {
        strategy: RecoveryStrategy.RETRY,
        maxAttempts: 2,
      };

      const result = await errorTrackingService.attemptRecovery(
        1,
        recoveryConfig
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("recovery attempts failed");
    });

    it("should attempt recovery with fallback strategy", async () => {
      const recoveryConfig = {
        strategy: RecoveryStrategy.FALLBACK,
        fallbackData: { message: "Fallback data" },
      };

      const result = await errorTrackingService.attemptRecovery(
        1,
        recoveryConfig
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ message: "Fallback data" });
    });

    it("should handle circuit breaker open state", async () => {
      // Manually set circuit breaker to open
      (errorTrackingService as any).circuitBreakers.set("circuit_1", {
        failures: 5,
        lastFailure: new Date(),
        state: "open",
      });

      const recoveryConfig = {
        strategy: RecoveryStrategy.RETRY,
      };

      const result = await errorTrackingService.attemptRecovery(
        1,
        recoveryConfig
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Circuit breaker is open");
    });

    it("should execute graceful degradation", async () => {
      const recoveryConfig = {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
      };

      const result = await errorTrackingService.attemptRecovery(
        1,
        recoveryConfig
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        degraded: true,
        message: "Service operating in degraded mode",
      });
    });
  });

  describe("Error Resolution", () => {
    it("should resolve error", async () => {
      const mockUpdate = require("../../../src/storage.js").db.update;

      await errorTrackingService.resolveError(1, 123);

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("Error Statistics", () => {
    it("should get error stats", async () => {
      const mockSelect = require("../../../src/storage.js").db.select;
      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => [
                {
                  id: 1,
                  category: ErrorCategory.DATABASE,
                  metadata: { severity: ErrorSeverity.HIGH },
                  resolved: false,
                  timestamp: new Date(),
                },
                {
                  id: 2,
                  category: ErrorCategory.VALIDATION,
                  metadata: { severity: ErrorSeverity.LOW },
                  resolved: true,
                  timestamp: new Date(),
                },
              ],
            }),
          }),
        }),
      });

      const stats = await errorTrackingService.getErrorStats(24);

      expect(stats.total).toBe(2);
      expect(stats.byCategory[ErrorCategory.DATABASE]).toBe(1);
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1);
      expect(stats.unresolved).toBe(1);
    });

    it("should handle database errors in stats", async () => {
      const mockSelect = require("../../../src/storage.js").db.select;
      mockSelect.mockImplementation(() => {
        throw new Error("Database error");
      });

      const stats = await errorTrackingService.getErrorStats(24);

      expect(stats.total).toBe(0);
      expect(stats.unresolved).toBe(0);
    });
  });

  describe("Data Sanitization", () => {
    it("should sanitize sensitive data", () => {
      const data = {
        username: "testuser",
        password: "secret123",
        token: "abc123",
        email: "test@example.com",
      };

      const sanitized = (errorTrackingService as any).sanitizeData(data);

      expect(sanitized.username).toBe("testuser");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.email).toBe("test@example.com");
    });

    it("should sanitize headers", () => {
      const headers = {
        "content-type": "application/json",
        authorization: "Bearer token123",
        "x-api-key": "key123",
        cookie: "session=abc",
      };

      const sanitized = (errorTrackingService as any).sanitizeHeaders(headers);

      expect(sanitized["content-type"]).toBe("application/json");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized["x-api-key"]).toBe("[REDACTED]");
      expect(sanitized.cookie).toBe("[REDACTED]");
    });
  });

  describe("Category Determination", () => {
    it("should determine validation category", () => {
      const error = new Error("Validation failed");
      const category = (errorTrackingService as any).determineCategory(
        error,
        ErrorCategory.SYSTEM
      );

      expect(category).toBe(ErrorCategory.VALIDATION);
    });

    it("should determine database category", () => {
      const error = new Error("Database connection failed");
      const category = (errorTrackingService as any).determineCategory(
        error,
        ErrorCategory.SYSTEM
      );

      expect(category).toBe(ErrorCategory.DATABASE);
    });

    it("should determine security category", () => {
      const error = new Error("Unauthorized access");
      const category = (errorTrackingService as any).determineCategory(
        error,
        ErrorCategory.SYSTEM
      );

      expect(category).toBe(ErrorCategory.SECURITY);
    });

    it("should return provided category if no match", () => {
      const error = new Error("Unknown error");
      const category = (errorTrackingService as any).determineCategory(
        error,
        ErrorCategory.BUSINESS
      );

      expect(category).toBe(ErrorCategory.BUSINESS);
    });
  });

  describe("Circuit Breaker", () => {
    it("should record circuit failure", () => {
      (errorTrackingService as any).recordCircuitFailure("test_circuit");

      const circuit = (errorTrackingService as any).circuitBreakers.get(
        "test_circuit"
      );
      expect(circuit.failures).toBe(1);
      expect(circuit.state).toBe("closed");
    });

    it("should open circuit after 5 failures", () => {
      for (let i = 0; i < 5; i++) {
        (errorTrackingService as any).recordCircuitFailure("test_circuit");
      }

      const circuit = (errorTrackingService as any).circuitBreakers.get(
        "test_circuit"
      );
      expect(circuit.failures).toBe(5);
      expect(circuit.state).toBe("open");
    });

    it("should reset circuit breaker", () => {
      (errorTrackingService as any).circuitBreakers.set("test_circuit", {
        failures: 5,
        lastFailure: new Date(),
        state: "open",
      });

      (errorTrackingService as any).resetCircuitBreaker("test_circuit");

      const circuit = (errorTrackingService as any).circuitBreakers.get(
        "test_circuit"
      );
      expect(circuit.failures).toBe(0);
      expect(circuit.state).toBe("closed");
    });
  });
});
