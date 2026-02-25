import { loggerService } from "./logger.js";
import { alertManager } from "./alertManager.js";
import { metricsCollector } from "./metricsCollector.js";
import { performanceMonitor } from "./performanceMonitor.js";
import { profilingService } from "./profilingService.js";

export class MonitoringService {
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Avoid background intervals during unit tests.
    if (process.env.NODE_ENV !== "test") {
      this.startMetricsCollection();
    }
  }

  // Start collecting system and application metrics
  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const systemMetrics = await metricsCollector.collectSystemMetrics();
        const databaseMetrics = await metricsCollector.collectDatabaseMetrics();
        const applicationMetrics =
          await metricsCollector.collectApplicationMetrics();

        // Update performance monitor history
        performanceMonitor.updateMetricsHistory(
          systemMetrics,
          applicationMetrics,
        );

        // Check Redis connectivity
        let redisConnected = false;
        try {
          // Import cacheService dynamically to avoid circular dependency
          const { cacheService } =
            await import("../../services/cacheService.js");
          redisConnected = await cacheService.ping();
        } catch (error) {
          console.warn("Redis health check failed:", error);
        }

        // Check for alerts based on collected metrics
        alertManager.checkAlerts({
          system: systemMetrics,
          database: databaseMetrics,
          application: applicationMetrics,
          redis: { connected: redisConnected },
        });

        // Log metrics for monitoring
        loggerService.getLogger().info("System Metrics Collected", {
          type: "metrics",
          category: "system",
          data: systemMetrics,
        });

        loggerService.getLogger().info("Database Metrics Collected", {
          type: "metrics",
          category: "database",
          data: databaseMetrics,
        });

        loggerService.getLogger().info("Application Metrics Collected", {
          type: "metrics",
          category: "application",
          data: applicationMetrics,
        });
      } catch (error) {
        loggerService.getLogger().error("Failed to collect metrics", {
          error: error.message,
          stack: error.stack,
        });
      }
    }, 30000); // 30 seconds

    // Don't keep the event loop alive just for metrics.
    this.metricsInterval.unref?.();
  }

  // Error logging methods (delegate to logger service)
  public logError(
    error: Error,
    context: Parameters<typeof loggerService.logError>[1] = {},
    metadata: Parameters<typeof loggerService.logError>[2] = {},
  ): void {
    loggerService.logError(error, context, metadata);
  }

  public logWarning(
    message: string,
    context: Parameters<typeof loggerService.logWarning>[1] = {},
    metadata: Parameters<typeof loggerService.logWarning>[2] = {},
  ): void {
    loggerService.logWarning(message, context, metadata);
  }

  public logInfo(
    message: string,
    context: Parameters<typeof loggerService.logInfo>[1] = {},
    metadata: Parameters<typeof loggerService.logInfo>[2] = {},
  ): void {
    loggerService.logInfo(message, context, metadata);
  }

  // Performance monitoring methods (delegate to performance monitor)
  public startTrace = performanceMonitor.startTrace.bind(performanceMonitor);
  public endTrace = performanceMonitor.endTrace.bind(performanceMonitor);
  public createRequestMiddleware =
    performanceMonitor.createRequestMiddleware.bind(performanceMonitor);
  public getHealthStatus =
    performanceMonitor.getHealthStatus.bind(performanceMonitor);
  public getPrometheusMetrics =
    performanceMonitor.getPrometheusMetrics.bind(performanceMonitor);
  public getMemoryStats =
    performanceMonitor.getMemoryStats.bind(performanceMonitor);

  // Alert management methods (delegate to alert manager)
  public getActiveAlerts = alertManager.getActiveAlerts.bind(alertManager);
  public resolveAlert = alertManager.resolveAlert.bind(alertManager);
  public getAlertRules = alertManager.getAlertRules.bind(alertManager);
  public updateAlertRule = alertManager.updateAlertRule.bind(alertManager);
  public addAlertRule = alertManager.addAlertRule.bind(alertManager);
  public removeAlertRule = alertManager.removeAlertRule.bind(alertManager);
  public clearAllAlerts = alertManager.clearAllAlerts.bind(alertManager);

  // Profiling methods (delegate to profiling service)
  public takeHeapSnapshot =
    profilingService.takeHeapSnapshot.bind(profilingService);
  public startCpuProfiling =
    profilingService.startCpuProfiling.bind(profilingService);
  public stopCpuProfiling =
    profilingService.stopCpuProfiling.bind(profilingService);
  public getHeapStatistics =
    profilingService.getHeapStatistics.bind(profilingService);
  public getHeapSpaceStatistics =
    profilingService.getHeapSpaceStatistics.bind(profilingService);
  public forceGarbageCollection =
    profilingService.forceGarbageCollection.bind(profilingService);
  public getMemoryProfile =
    profilingService.getMemoryProfile.bind(profilingService);
  public cleanupOldProfiles =
    profilingService.cleanupOldProfiles.bind(profilingService);
  public getProfilingStatus =
    profilingService.getProfilingStatus.bind(profilingService);

  // Metrics collection methods (delegate to metrics collector)
  public collectSystemMetrics =
    metricsCollector.collectSystemMetrics.bind(metricsCollector);
  public collectDatabaseMetrics =
    metricsCollector.collectDatabaseMetrics.bind(metricsCollector);
  public collectApplicationMetrics =
    metricsCollector.collectApplicationMetrics.bind(metricsCollector);

  // Get metrics history
  public getMetricsHistory =
    performanceMonitor.getMetricsHistory.bind(performanceMonitor);

  // Cleanup method
  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

// Graceful shutdown
process.on("SIGINT", () => {
  monitoringService.destroy();
});

process.on("SIGTERM", () => {
  monitoringService.destroy();
});

// Re-export types for backward compatibility
export type {
  SystemMetrics,
  DatabaseMetrics,
  ApplicationMetrics,
} from "./metricsCollector.js";

export type { AlertRule, Alert } from "./alertManager.js";

export type { PerformanceTrace } from "./performanceMonitor.js";

export type { ErrorLogEntry } from "./logger.js";
