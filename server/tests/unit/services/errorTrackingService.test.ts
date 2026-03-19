import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createRequire } from "module";
import {
  errorTrackingService,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
} from "../../../src/services/errorTrackingService.js";

const require = createRequire(import.meta.url);

describe("ErrorTrackingService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (errorTrackingService as any).circuitBreakers?.clear?.();
  });

  describe("category + sanitization helpers", () => {
    it("determines validation category", () => {
      const category = (errorTrackingService as any).determineCategory(
        new Error("Validation failed"),
        ErrorCategory.SYSTEM,
      );
      expect(category).toBe(ErrorCategory.VALIDATION);
    });

    it("sanitizes sensitive headers", () => {
      const sanitized = (errorTrackingService as any).sanitizeHeaders({
        authorization: "Bearer abc",
        cookie: "s=1",
        "content-type": "application/json",
      });

      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.cookie).toBe("[REDACTED]");
      expect(sanitized["content-type"]).toBe("application/json");
    });
  });

  describe("recovery", () => {
    it("returns fallback result", async () => {
      const result = await errorTrackingService.attemptRecovery(1, {
        strategy: RecoveryStrategy.FALLBACK,
        fallbackData: { ok: true },
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ ok: true });
    });

    it("returns degraded result", async () => {
      const result = await errorTrackingService.attemptRecovery(1, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        degraded: true,
        message: "Service operating in degraded mode",
      });
    });

    it("fails when circuit is open", async () => {
      (errorTrackingService as any).circuitBreakers.set("circuit_1", {
        failures: 5,
        lastFailure: new Date(),
        state: "open",
      });

      const result = await errorTrackingService.attemptRecovery(1, {
        strategy: RecoveryStrategy.RETRY,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Circuit breaker is open");
    });
  });

  // DB-heavy paths are covered by integration tests.
});
