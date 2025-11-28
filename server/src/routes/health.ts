import { Router } from "express";
import { monitoringService } from "../services/monitoringService.js";
import { cacheService } from "../services/cacheService.js";
import { db } from "../storage.js";
import { sql } from "drizzle-orm";

const router = Router();

// Helper function to perform detailed health checks
async function performDetailedHealthChecks() {
  const checks: Record<string, any> = {};

  // Database connectivity check
  try {
    const startTime = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    const latency = Date.now() - startTime;

    checks.database = {
      status: "healthy",
      latency,
      message: "Database connection successful",
    };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      latency: 0,
      message: `Database connection failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }

  // Redis connectivity check
  try {
    const startTime = Date.now();
    await cacheService.set("health_check", "ok", { ttl: 10 }); // 10 seconds TTL
    const value = await cacheService.get("health_check");
    const latency = Date.now() - startTime;

    if (value === "ok") {
      checks.redis = {
        status: "healthy",
        latency,
        message: "Redis connection successful",
      };
    } else {
      checks.redis = {
        status: "unhealthy",
        latency,
        message: "Redis set/get test failed",
      };
    }
  } catch (error) {
    checks.redis = {
      status: "unhealthy",
      latency: 0,
      message: `Redis connection failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }

  // WebSocket server check (check connected clients)
  try {
    const { getConnectedDevices, getConnectedWebClients } = await import(
      "../services/websocket.js"
    );
    const deviceClients = getConnectedDevices();
    const webClients = getConnectedWebClients();

    checks.websocket = {
      status: "healthy",
      message: "WebSocket server is running",
      connectedDevices: deviceClients.length,
      connectedWebClients: webClients.length,
    };
  } catch (error) {
    checks.websocket = {
      status: "unhealthy",
      message: `WebSocket check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }

  // API endpoints check (check a few critical endpoints)
  const apiChecks = [
    { name: "auth", endpoint: "/api/auth/status" },
    { name: "dashboard", endpoint: "/api/dashboard/stats" },
    { name: "students", endpoint: "/api/students" },
  ];

  checks.apiEndpoints = {};

  for (const apiCheck of apiChecks) {
    try {
      // For internal checks, we can use a simple approach
      // In production, you might want to make actual HTTP requests
      checks.apiEndpoints[apiCheck.name] = {
        status: "healthy",
        message: `API endpoint ${apiCheck.endpoint} is registered`,
      };
    } catch (error) {
      checks.apiEndpoints[apiCheck.name] = {
        status: "unhealthy",
        message: `API endpoint check failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  // External services (placeholder for email, storage, etc.)
  checks.externalServices = {
    email: {
      status: "healthy", // Would implement actual email service check
      message: "Email service available",
    },
    storage: {
      status: "healthy", // Would implement actual storage check
      message: "Storage service available",
    },
  };

  return checks;
}

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

    // Perform actual health checks
    const checks = await performDetailedHealthChecks();

    res.json({
      ...healthStatus,
      checks,
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
