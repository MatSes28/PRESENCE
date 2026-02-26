import * as v8 from "v8";
import * as path from "path";
import * as fs from "fs";
import { loggerService } from "./logger.js";
import { promMetrics } from "./promMetrics.js";
import {
  metricsCollector,
  SystemMetrics,
  DatabaseMetrics,
  ApplicationMetrics,
} from "./metricsCollector.js";

// Performance Trace
export interface PerformanceTrace {
  id: string;
  timestamp: Date;
  operation: string;
  duration: number;
  success: boolean;
  metadata: {
    userId?: number;
    endpoint?: string;
    databaseQueries?: number;
    cacheHits?: number;
    externalCalls?: number;
    responseTime?: number;
  };
}

export class PerformanceMonitor {
  private traces: Map<string, PerformanceTrace> = new Map();
  private systemMetricsHistory: SystemMetrics[] = [];
  private applicationMetricsHistory: ApplicationMetrics[] = [];

  // Performance monitoring methods
  public startTrace(
    operation: string,
    metadata: Partial<PerformanceTrace["metadata"]> = {},
  ): string {
    const traceId = `trace_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const trace: PerformanceTrace = {
      id: traceId,
      timestamp: new Date(),
      operation,
      duration: 0,
      success: false,
      metadata: {
        userId: metadata.userId,
        endpoint: metadata.endpoint,
        databaseQueries: 0,
        cacheHits: 0,
        externalCalls: 0,
      },
    };

    this.traces.set(traceId, trace);
    return traceId;
  }

  public endTrace(
    traceId: string,
    success: boolean = true,
    additionalMetadata: Partial<PerformanceTrace["metadata"]> = {},
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.duration = Date.now() - trace.timestamp.getTime();
    trace.success = success;

    // Merge additional metadata
    Object.assign(trace.metadata, additionalMetadata);

    // Log performance trace
    loggerService.getLogger().info("Performance Trace", {
      type: "performance",
      trace,
    });

    // Remove completed trace
    this.traces.delete(traceId);
  }

  // Middleware for request monitoring
  public createRequestMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const traceId = this.startTrace(`${req.method} ${req.path}`, {
        endpoint: req.path,
        userId: req.session?.userId,
      });

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args: any[]) => {
        const duration = Date.now() - startTime;

        // Normalized path for metrics to avoid high-cardinality values.
        // Prefer Express route templates like "/:id" when available.
        const routePath =
          typeof req?.route?.path === "string" ? req.route.path : req.path;
        const baseUrl = typeof req?.baseUrl === "string" ? req.baseUrl : "";
        const normalizedPath =
          `${baseUrl}${routePath}` || req.path || "unknown";

        promMetrics.recordHttpRequest({
          method: req.method,
          path: normalizedPath,
          status: res.statusCode,
          durationSeconds: duration / 1000,
        });

        // Update application metrics
        const currentMetrics =
          this.applicationMetricsHistory[
            this.applicationMetricsHistory.length - 1
          ];
        if (currentMetrics) {
          currentMetrics.requests.total++;
          if (res.statusCode >= 200 && res.statusCode < 400) {
            currentMetrics.requests.successful++;
          } else {
            currentMetrics.requests.failed++;
          }
        }

        // Log request details
        loggerService.getLogger().info("HTTP Request", {
          type: "request",
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get("User-Agent"),
          ipAddress: req.ip,
          userId: req.session?.userId,
          traceId,
        });

        this.endTrace(traceId, res.statusCode >= 200 && res.statusCode < 400, {
          responseTime: duration,
        });

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Health check endpoint data
  public getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;
    system: Partial<SystemMetrics>;
    database: Partial<DatabaseMetrics>;
    application: Partial<ApplicationMetrics>;
    timestamp: Date;
  } {
    const latestSystem =
      this.systemMetricsHistory[this.systemMetricsHistory.length - 1];
    const latestApp =
      this.applicationMetricsHistory[this.applicationMetricsHistory.length - 1];

    // Determine overall health status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (latestSystem) {
      if (
        latestSystem.cpu.usage > 90 ||
        latestSystem.memory.usagePercent > 90
      ) {
        status = "unhealthy";
      } else if (
        latestSystem.cpu.usage > 70 ||
        latestSystem.memory.usagePercent > 80
      ) {
        status = "degraded";
      }
    }

    return {
      status,
      uptime: process.uptime(),
      system: latestSystem
        ? {
            cpu: latestSystem.cpu,
            memory: latestSystem.memory,
            disk: latestSystem.disk,
          }
        : {},
      database: {}, // Would be populated with latest database metrics
      application: latestApp
        ? {
            requests: latestApp.requests,
            errors: latestApp.errors,
            business: latestApp.business,
          }
        : {},
      timestamp: new Date(),
    };
  }

  // Get metrics for Prometheus
  public async getPrometheusMetrics(): Promise<string> {
    const health = this.getHealthStatus();
    const latestSystem =
      this.systemMetricsHistory[this.systemMetricsHistory.length - 1];

    const systemMetricsAvailable = latestSystem ? 1 : 0;

    let metrics =
      "# HELP presence_system_metrics_available Whether system metrics have been collected at least once (1=yes, 0=no)\n";
    metrics += "# TYPE presence_system_metrics_available gauge\n";
    metrics += `presence_system_metrics_available ${systemMetricsAvailable}\n`;

    metrics += "# HELP presence_system_cpu_usage CPU usage percentage\n";
    metrics += "# TYPE presence_system_cpu_usage gauge\n";
    metrics += `presence_system_cpu_usage ${latestSystem ? latestSystem.cpu.usage : 0}\n`;

    metrics += "# HELP presence_system_memory_usage Memory usage percentage\n";
    metrics += "# TYPE presence_system_memory_usage gauge\n";
    metrics += `presence_system_memory_usage ${latestSystem ? latestSystem.memory.usagePercent : 0}\n`;

    metrics +=
      "# HELP presence_system_status System health status (0=healthy, 1=degraded, 2=unhealthy)\n";
    metrics += "# TYPE presence_system_status gauge\n";
    const statusValue =
      health.status === "healthy" ? 0 : health.status === "degraded" ? 1 : 2;
    metrics += `presence_system_status ${statusValue}\n`;

    metrics += "# HELP presence_uptime_seconds Application uptime in seconds\n";
    metrics += "# TYPE presence_uptime_seconds counter\n";
    metrics += `presence_uptime_seconds ${health.uptime}\n`;

    return metrics;
  }

  // Update metrics history
  public updateMetricsHistory(
    systemMetrics: SystemMetrics,
    applicationMetrics: ApplicationMetrics,
  ): void {
    this.systemMetricsHistory.push(systemMetrics);
    this.applicationMetricsHistory.push(applicationMetrics);

    // Keep only last 100 entries (5 minutes of data)
    if (this.systemMetricsHistory.length > 100) {
      this.systemMetricsHistory.shift();
    }
    if (this.applicationMetricsHistory.length > 100) {
      this.applicationMetricsHistory.shift();
    }
  }

  // Get metrics history
  public getMetricsHistory(): {
    system: SystemMetrics[];
    application: ApplicationMetrics[];
  } {
    return {
      system: [...this.systemMetricsHistory],
      application: [...this.applicationMetricsHistory],
    };
  }

  // Get memory statistics
  public getMemoryStats(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUsagePercent: number;
  } {
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsagePercent,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
