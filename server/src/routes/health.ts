import { Router, Request, Response } from "express";
import db, { safeExecute } from "../storage.js";

const router = Router();

// Comprehensive health check endpoint for production monitoring
router.get("/", async (req: Request, res: Response) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  const metrics = [
    `# HELP presence_uptime_seconds Application uptime in seconds`,
    `# TYPE presence_uptime_seconds counter`,
    `presence_uptime_seconds ${uptime}`,
    ``,
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
    `# HELP presence_database_connections_active Active database connections`,
    `# TYPE presence_database_connections_active gauge`,
    `presence_database_connections_active 1`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.send(metrics);
});

export default router;
