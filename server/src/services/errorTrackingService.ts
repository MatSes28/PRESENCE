import db from "../storage.js";
import { errorLogs, errorRecoveryAttempts } from "../shared-schema.js";
import { monitoringService } from "./monitoringService.js";
import { alertingService } from "./alertingService.js";
import { eq, sql, desc } from "drizzle-orm";

// Error categories for better classification
export enum ErrorCategory {
  VALIDATION = "validation",
  DATABASE = "database",
  EXTERNAL = "external",
  SYSTEM = "system",
  BUSINESS = "business",
  NETWORK = "network",
  SECURITY = "security",
  PERFORMANCE = "performance",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Recovery strategies
export enum RecoveryStrategy {
  RETRY = "retry",
  CIRCUIT_BREAKER = "circuit_breaker",
  FALLBACK = "fallback",
  GRACEFUL_DEGRADATION = "graceful_degradation",
  MANUAL = "manual",
}

interface ErrorContext {
  userId?: number;
  sessionId?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress?: string;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
}

interface ErrorMetadata {
  stack?: string;
  originalError?: Error;
  requestBody?: any;
  queryParams?: any;
  headers?: any;
  userInfo?: any;
  systemInfo?: any;
  tags?: string[];
  [key: string]: any;
}

interface RecoveryAttempt {
  strategy: RecoveryStrategy;
  maxAttempts?: number;
  backoffMs?: number;
  timeoutMs?: number;
  fallbackData?: any;
}

class ErrorTrackingService {
  private circuitBreakers: Map<
    string,
    {
      failures: number;
      lastFailure: Date;
      state: "closed" | "open" | "half-open";
    }
  > = new Map();

  // Log error to both file (via monitoringService) and database
  async logError(
    error: Error,
    context: ErrorContext = {},
    metadata: ErrorMetadata = {},
    category: ErrorCategory = ErrorCategory.SYSTEM,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<number> {
    try {
      // Determine category from error type if not specified
      const determinedCategory = this.determineCategory(error, category);

      // Log to file system via monitoring service
      monitoringService.logError(error, context, {
        category: determinedCategory,
        severity,
        ...metadata,
      });

      // Log to database
      const errorLogData = {
        level:
          severity === ErrorSeverity.CRITICAL
            ? "error"
            : severity === ErrorSeverity.HIGH
            ? "error"
            : "warn",
        message: error.message,
        stack: error.stack,
        category: determinedCategory,
        endpoint: context.endpoint,
        userId: context.userId,
        sessionId: context.sessionId,
        requestId: context.requestId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        method: context.method,
        url: context.url,
        statusCode: context.statusCode,
        responseTime: context.responseTime,
        metadata: {
          severity,
          originalError: metadata.originalError?.message,
          requestBody: this.sanitizeData(metadata.requestBody),
          queryParams: metadata.queryParams,
          headers: this.sanitizeHeaders(metadata.headers),
          userInfo: metadata.userInfo,
          systemInfo: metadata.systemInfo,
          tags: metadata.tags,
          ...metadata,
        },
      };

      const [insertedError] = await db
        .insert(errorLogs)
        .values(errorLogData)
        .returning({ id: errorLogs.id });

      // Check if this error should trigger alerts
      await this.checkAlertConditions(
        error,
        context,
        determinedCategory,
        severity
      );

      return insertedError.id;
    } catch (loggingError) {
      // Fallback to console logging if database logging fails
      console.error("Failed to log error to database:", loggingError);
      console.error("Original error:", error);
      return -1;
    }
  }

  // Log recovery attempt
  async logRecoveryAttempt(
    errorLogId: number,
    attemptNumber: number,
    strategy: RecoveryStrategy,
    status: "pending" | "success" | "failed",
    result?: any
  ): Promise<void> {
    try {
      await db.insert(errorRecoveryAttempts).values({
        errorLogId,
        attemptNumber,
        strategy,
        status,
        result: result ? JSON.stringify(result) : null,
      });
    } catch (error) {
      console.error("Failed to log recovery attempt:", error);
    }
  }

  // Mark error as resolved
  async resolveError(errorLogId: number, resolvedBy: number): Promise<void> {
    try {
      await db
        .update(errorLogs)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy,
        })
        .where(eq(errorLogs.id, errorLogId));
    } catch (error) {
      console.error("Failed to resolve error:", error);
    }
  }

  // Get error statistics
  async getErrorStats(timeRangeHours: number = 24): Promise<{
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    unresolved: number;
    recentErrors: any[];
  }> {
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

      const errors = await db
        .select()
        .from(errorLogs)
        .where(sql`${errorLogs.timestamp} >= ${since}`)
        .orderBy(desc(errorLogs.timestamp))
        .limit(100);

      const stats = {
        total: errors.length,
        byCategory: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        unresolved: 0,
        recentErrors: errors.slice(0, 10),
      };

      errors.forEach((error) => {
        // Count by category
        stats.byCategory[error.category] =
          (stats.byCategory[error.category] || 0) + 1;

        // Count by severity (from metadata)
        const severity = (error.metadata as any)?.severity || "medium";
        stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

        // Count unresolved
        if (!error.resolved) {
          stats.unresolved++;
        }
      });

      return stats;
    } catch (error) {
      console.error("Failed to get error stats:", error);
      return {
        total: 0,
        byCategory: {},
        bySeverity: {},
        unresolved: 0,
        recentErrors: [],
      };
    }
  }

  // Attempt automatic recovery
  async attemptRecovery(
    errorLogId: number,
    recoveryConfig: RecoveryAttempt
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const {
      strategy,
      maxAttempts = 3,
      backoffMs = 1000,
      timeoutMs = 30000,
      fallbackData,
    } = recoveryConfig;

    try {
      // Check circuit breaker for applicable strategies
      if (
        [RecoveryStrategy.RETRY, RecoveryStrategy.FALLBACK].includes(strategy)
      ) {
        const circuitKey = `circuit_${errorLogId}`;
        const circuit = this.circuitBreakers.get(circuitKey);

        if (circuit?.state === "open") {
          // Circuit is open, fail fast
          await this.logRecoveryAttempt(errorLogId, 1, strategy, "failed", {
            reason: "circuit_open",
          });
          return { success: false, error: "Circuit breaker is open" };
        }
      }

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.logRecoveryAttempt(
            errorLogId,
            attempt,
            strategy,
            "pending"
          );

          let result: any;

          switch (strategy) {
            case RecoveryStrategy.RETRY:
              result = await this.executeRetry(errorLogId, attempt);
              break;
            case RecoveryStrategy.FALLBACK:
              result = fallbackData;
              break;
            case RecoveryStrategy.GRACEFUL_DEGRADATION:
              result = await this.executeGracefulDegradation(errorLogId);
              break;
            case RecoveryStrategy.CIRCUIT_BREAKER:
              // Circuit breaker is handled at the operation level
              result = {
                circuitBreaker: true,
                message: "Circuit breaker engaged",
              };
              break;
            default:
              throw new Error(`Unsupported recovery strategy: ${strategy}`);
          }

          await this.logRecoveryAttempt(
            errorLogId,
            attempt,
            strategy,
            "success",
            result
          );

          // Reset circuit breaker on success for applicable strategies
          if (
            [RecoveryStrategy.RETRY, RecoveryStrategy.FALLBACK].includes(
              strategy
            )
          ) {
            this.resetCircuitBreaker(`circuit_${errorLogId}`);
          }

          return { success: true, result };
        } catch (attemptError) {
          await this.logRecoveryAttempt(
            errorLogId,
            attempt,
            strategy,
            "failed",
            {
              error: attemptError.message,
              stack: attemptError.stack,
            }
          );

          // Update circuit breaker for applicable strategies
          if (
            [RecoveryStrategy.RETRY, RecoveryStrategy.FALLBACK].includes(
              strategy
            )
          ) {
            this.recordCircuitFailure(`circuit_${errorLogId}`);
          }

          // Wait before next attempt
          if (attempt < maxAttempts) {
            await new Promise((resolve) =>
              setTimeout(resolve, backoffMs * attempt)
            );
          }
        }
      }

      return {
        success: false,
        error: `All ${maxAttempts} recovery attempts failed`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Private helper methods
  private determineCategory(
    error: Error,
    providedCategory: ErrorCategory
  ): ErrorCategory {
    // Try to determine category from error type
    if (
      error.name === "ValidationError" ||
      error.message.includes("validation")
    ) {
      return ErrorCategory.VALIDATION;
    }
    if (
      error.name === "DatabaseError" ||
      error.message.includes("database") ||
      error.message.includes("postgres")
    ) {
      return ErrorCategory.DATABASE;
    }
    if (
      error.name === "ExternalServiceError" ||
      error.message.includes("external") ||
      error.message.includes("service")
    ) {
      return ErrorCategory.EXTERNAL;
    }
    if (
      error.message.includes("network") ||
      error.message.includes("connection")
    ) {
      return ErrorCategory.NETWORK;
    }
    if (
      error.message.includes("unauthorized") ||
      error.message.includes("forbidden") ||
      error.message.includes("security")
    ) {
      return ErrorCategory.SECURITY;
    }

    return providedCategory;
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    const sensitiveFields = [
      "password",
      "token",
      "secret",
      "key",
      "authorization",
    ];
    const sanitized = { ...data };

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return headers;

    const sanitized = { ...headers };
    const sensitiveHeaders = ["authorization", "x-api-key", "cookie"];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  private async checkAlertConditions(
    error: Error,
    context: ErrorContext,
    category: ErrorCategory,
    severity: ErrorSeverity
  ): Promise<void> {
    // Check for critical errors that need immediate alerting
    if (severity === ErrorSeverity.CRITICAL) {
      await alertingService.sendCriticalErrorAlert(error, {
        endpoint: context.endpoint,
        userId: context.userId,
        requestId: context.requestId,
        category,
        metadata: {
          severity,
          timestamp: new Date().toISOString(),
        },
      });

      console.error(
        `🚨 CRITICAL ERROR: ${error.message} at ${context.endpoint}`
      );
    }

    // Check for database connection issues
    if (
      category === ErrorCategory.DATABASE &&
      error.message.includes("connection")
    ) {
      await alertingService.sendDatabaseAlert(
        `Database connection issue: ${error.message}`,
        {
          endpoint: context.endpoint,
          userId: context.userId,
          requestId: context.requestId,
          category,
          timestamp: new Date().toISOString(),
        }
      );
    }

    // Check for security-related errors
    if (category === ErrorCategory.SECURITY) {
      await alertingService.sendSecurityAlert(
        `Security issue detected: ${error.message}`,
        {
          ipAddress: context.ipAddress,
          userId: context.userId,
          endpoint: context.endpoint,
          userAgent: context.userAgent,
          severity:
            severity === ErrorSeverity.CRITICAL
              ? "critical"
              : severity === ErrorSeverity.HIGH
              ? "high"
              : severity === ErrorSeverity.MEDIUM
              ? "medium"
              : "low",
        }
      );
    }
  }

  private async executeRetry(
    errorLogId: number,
    attempt: number
  ): Promise<any> {
    // This would be implemented based on the specific operation that failed
    // For now, just simulate a retry
    throw new Error("Retry logic not implemented for this operation");
  }

  private async executeGracefulDegradation(errorLogId: number): Promise<any> {
    // Return cached data or default values
    return { degraded: true, message: "Service operating in degraded mode" };
  }

  private recordCircuitFailure(circuitKey: string): void {
    const circuit = this.circuitBreakers.get(circuitKey) || {
      failures: 0,
      lastFailure: new Date(),
      state: "closed",
    };
    circuit.failures++;
    circuit.lastFailure = new Date();

    // Open circuit after 5 failures
    if (circuit.failures >= 5) {
      circuit.state = "open";
    }

    this.circuitBreakers.set(circuitKey, circuit);
  }

  private resetCircuitBreaker(circuitKey: string): void {
    this.circuitBreakers.set(circuitKey, {
      failures: 0,
      lastFailure: new Date(),
      state: "closed",
    });
  }
}

// Export singleton instance
export const errorTrackingService = new ErrorTrackingService();

// Helper function to create structured error logging
export function createErrorLogger(context: Partial<ErrorContext> = {}) {
  return {
    log: (
      error: Error,
      metadata: ErrorMetadata = {},
      category?: ErrorCategory,
      severity?: ErrorSeverity
    ) =>
      errorTrackingService.logError(
        error,
        context as ErrorContext,
        metadata,
        category,
        severity
      ),

    logValidationError: (
      message: string,
      field?: string,
      metadata: ErrorMetadata = {}
    ) =>
      errorTrackingService.logError(
        new Error(message),
        context as ErrorContext,
        { ...metadata, field },
        ErrorCategory.VALIDATION,
        ErrorSeverity.LOW
      ),

    logDatabaseError: (error: Error, metadata: ErrorMetadata = {}) =>
      errorTrackingService.logError(
        error,
        context as ErrorContext,
        metadata,
        ErrorCategory.DATABASE,
        ErrorSeverity.HIGH
      ),

    logExternalError: (
      error: Error,
      service: string,
      metadata: ErrorMetadata = {}
    ) =>
      errorTrackingService.logError(
        error,
        context as ErrorContext,
        { ...metadata, service },
        ErrorCategory.EXTERNAL,
        ErrorSeverity.MEDIUM
      ),
  };
}
