import { Router, Request, Response } from "express";
import db, { safeExecute } from "../storage.js";
import { monitoringService } from "../services/monitoringService.js";
import { cacheService } from "../services/cacheService.js";
import { promMetrics } from "../services/monitoring/promMetrics.js";
import { getDeploymentInfo } from "../deploymentInfo.js";

const router = Router();

const isInternalMetricsRequest = (ipAddress?: string | null) => {
  if (!ipAddress) return false;

  const normalized = ipAddress.replace(/^::ffff:/, "").toLowerCase();

  if (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  ) {
    return true;
  }

  if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
    return true;
  }

  return normalized.startsWith("fc") || normalized.startsWith("fd");
};

// Comprehensive health check endpoint for production monitoring
router.get("/", async (req: Request, res: Response) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    deployment: getDeploymentInfo(),
    checks: {
      database: { status: "unknown", latency: null },
      memory: { status: "unknown", usage: null },
      environment: { status: "unknown", env: null },
    },
  };

  try {
    // Check database connection
    const dbStart = Date.now();
    await safeExecute("SELECT 1");
    health.checks.database = {
      status: "healthy",
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    health.checks.database = {
      status: "unhealthy",
      latency: null,
    };
    health.status = "degraded";
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status:
      memUsage.heapUsed / memUsage.heapTotal < 0.9 ? "healthy" : "warning",
    usage: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
    },
  };

  // Environment info
  health.checks.environment = {
    status: "healthy",
    env: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      port: process.env.PORT,
    },
  };

  // Set appropriate HTTP status
  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

// Liveness probe (basic check)
router.get("/live", (req: Request, res: Response) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (detailed check)
router.get("/ready", async (req: Request, res: Response) => {
  try {
    // Check database
    await safeExecute("SELECT 1");

    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      timestamp: new Date().toISOString(),
      error: "Database connection failed",
    });
  }
});

// Metrics endpoint for Prometheus
router.get("/metrics", async (req: Request, res: Response) => {
  // Allow disabling metrics explicitly (useful for dev/staging), but keep it on by default.
  const enabled =
    process.env.METRICS_ENABLED !== "false" &&
    // Backward compatibility: older env templates use ENABLE_METRICS
    process.env.ENABLE_METRICS !== "false";
  if (!enabled) {
    return res
      .status(404)
      .json({ success: false, message: "Metrics disabled" });
  }

  const allowPublicMetrics = process.env.METRICS_PUBLIC === "true";
  const isInternalRequest = isInternalMetricsRequest(
    req.ip || req.socket.remoteAddress,
  );
  const isAdminRequest =
    Boolean(req.session?.userId) && req.session?.userRole === "admin";

  if (!allowPublicMetrics && !isInternalRequest && !isAdminRequest) {
    return res.status(403).json({
      success: false,
      message: "Metrics access denied",
    });
  }

  const memUsage = process.memoryUsage();

  // Real service health signals.
  let dbUp = 0;
  try {
    await safeExecute("SELECT 1");
    dbUp = 1;
  } catch {
    dbUp = 0;
  }

  let redisUp = 0;
  try {
    redisUp = (await cacheService.ping()) ? 1 : 0;
  } catch {
    redisUp = 0;
  }

  const baseMetrics = [
    `# HELP presence_memory_heap_used_bytes Memory heap used in bytes`,
    `# TYPE presence_memory_heap_used_bytes gauge`,
    `presence_memory_heap_used_bytes ${memUsage.heapUsed}`,
    ``,
    `# HELP presence_memory_heap_total_bytes Memory heap total in bytes`,
    `# TYPE presence_memory_heap_total_bytes gauge`,
    `presence_memory_heap_total_bytes ${memUsage.heapTotal}`,
    ``,
    `# HELP presence_memory_rss_bytes Memory RSS in bytes`,
    `# TYPE presence_memory_rss_bytes gauge`,
    `presence_memory_rss_bytes ${memUsage.rss}`,
    ``,
    `# HELP presence_database_up Database connectivity (1 = up, 0 = down)`,
    `# TYPE presence_database_up gauge`,
    `presence_database_up ${dbUp}`,
    ``,
    `# HELP presence_redis_up Redis connectivity (1 = up, 0 = down)`,
    `# TYPE presence_redis_up gauge`,
    `presence_redis_up ${redisUp}`,
    ``,
  ].join("\n");

  // System health gauges collected asynchronously (CPU/memory/status) + in-process request metrics.
  const monitoringMetrics = await monitoringService.getPrometheusMetrics();
  const httpMetrics = promMetrics.render();

  const metrics = [baseMetrics, monitoringMetrics, "", httpMetrics].join("\n");

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(metrics);
});

export default router;
