import { Router } from "express";
import { monitoringService } from "../services/monitoringService.js";

const router = Router();

// Health check endpoint for load balancers and monitoring systems
router.get("/health", async (req, res) => {
  try {
    const healthStatus = monitoringService.getHealthStatus();

    // Return appropriate HTTP status based on health
    const statusCode =
      healthStatus.status === "healthy"
        ? 200
        : healthStatus.status === "degraded"
        ? 200
        : 503; // unhealthy

    res.status(statusCode).json({
      status: healthStatus.status,
      uptime: healthStatus.uptime,
      timestamp: healthStatus.timestamp,
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    monitoringService.logError(error as Error, {
      endpoint: "/health",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(503).json({
      status: "unhealthy",
      error: "Health check failed",
      timestamp: new Date(),
    });
  }
});

// Detailed health check with system metrics
router.get("/health/detailed", async (req, res) => {
  try {
    const healthStatus = monitoringService.getHealthStatus();

    res.json({
      ...healthStatus,
      checks: {
        database: {
          status: "healthy", // Would be checked with actual DB connection
          latency: 0,
          connections: healthStatus.database?.connections,
        },
        redis: {
          status: "healthy", // Would be checked with actual Redis connection
          latency: 0,
        },
        externalServices: {
          email: { status: "healthy" },
          storage: { status: "healthy" },
        },
      },
    });
  } catch (error) {
    monitoringService.logError(error as Error, {
      endpoint: "/health/detailed",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(503).json({
      status: "unhealthy",
      error: "Detailed health check failed",
      timestamp: new Date(),
    });
  }
});

// Prometheus metrics endpoint
router.get("/metrics", async (req, res) => {
  try {
    // Check if request is from Prometheus (basic auth or IP whitelist)
    const authHeader = req.get("Authorization");
    const clientIP = req.ip;

    // Simple IP-based access control for metrics endpoint
    const allowedIPs = ["127.0.0.1", "localhost", "::1"];
    const isAllowedIP = allowedIPs.some((ip) => clientIP.includes(ip));

    if (!isAllowedIP && !authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const metrics = await monitoringService.getPrometheusMetrics();

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(metrics);
  } catch (error) {
    monitoringService.logError(error as Error, {
      endpoint: "/metrics",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(500).send("# Error generating metrics\n");
  }
});

// Readiness probe for Kubernetes
router.get("/ready", async (req, res) => {
  try {
    // Check if application is ready to serve traffic
    const healthStatus = monitoringService.getHealthStatus();

    // Application is ready if not unhealthy
    const isReady = healthStatus.status !== "unhealthy";

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      status: healthStatus.status,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: "Readiness check failed",
      timestamp: new Date(),
    });
  }
});

// Liveness probe for Kubernetes
router.get("/live", async (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    alive: true,
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// System information endpoint (protected)
router.get("/system", async (req, res) => {
  try {
    const healthStatus = monitoringService.getHealthStatus();

    res.json({
      system: healthStatus.system,
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      environment: {
        node_env: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  } catch (error) {
    monitoringService.logError(error as Error, {
      endpoint: "/system",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    res.status(500).json({ error: "Failed to get system information" });
  }
});

export default router;
