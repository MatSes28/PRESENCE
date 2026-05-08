import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import bcrypt from "bcryptjs";

import db, { dbClient, safeExecute, addExecuteMethod } from "./storage.js";
import routes from "./routes.js";
import { setupWebSocket } from "./services/websocket.js";
import { sql, eq } from "drizzle-orm";
import {
  isProductionLike,
  validateEnvironmentOrThrow,
} from "./config/env.js";
import { sessionMiddleware } from "./session.js";

// --------------------------------------------------------------------------------------
// Diagnostics: capture Node.js runtime warnings with stack traces.
//
// We observed `TimeoutOverflowWarning` in Railway logs (setTimeout delay > 2^31-1 ms).
// Node clamps such delays down to 1ms, which can cause unexpected tight loops.
// This handler prints the warning stack so we can identify the callsite in production.
// --------------------------------------------------------------------------------------
process.on("warning", (warning) => {
  // Avoid dumping large objects/secrets; keep the log actionable.
  const base = {
    name: warning.name,
    message: warning.message,
    // Helpful for diagnosing env-driven overflows (e.g. SESSION_MAX_AGE set in ms).
    env: {
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT
        ? "present"
        : "absent",
      SESSION_MAX_AGE: process.env.SESSION_MAX_AGE,
    },
  };

  if (warning.name === "TimeoutOverflowWarning") {
    console.error(
      "[DIAG][TimeoutOverflowWarning] Detected timer overflow; please inspect stack:",
      base,
    );
    if (warning.stack)
      console.error("[DIAG][TimeoutOverflowWarning] stack:\n", warning.stack);
    return;
  }

  // Log other warnings at warn level.
  console.warn("[DIAG][NodeWarning]", base);
  if (warning.stack)
    console.warn("[DIAG][NodeWarning] stack:\n", warning.stack);
});

// Extra guardrails: log any oversized timer delay with a stack trace at the callsite.
// This catches cases where Node would clamp the duration (and/or where warnings are not visible).
const MAX_TIMER_DELAY_MS = 2_147_483_647; // Max signed 32-bit int (Node timers limit)

const __origSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler: any, timeout?: any, ...args: any[]) => {
  if (typeof timeout === "number" && timeout > MAX_TIMER_DELAY_MS) {
    // Stack here points to the callsite that attempted the oversized timer.
    const stack = new Error().stack;
    console.error(
      "[DIAG][TimerOverflow] setTimeout delay exceeds 2^31-1ms; Node will clamp.",
      { timeout, max: MAX_TIMER_DELAY_MS },
    );
    if (stack) console.error("[DIAG][TimerOverflow] stack:\n", stack);
  }
  return (__origSetTimeout as any)(handler as any, timeout as any, ...args);
}) as any;

const __origSetInterval = globalThis.setInterval;
globalThis.setInterval = ((handler: any, timeout?: any, ...args: any[]) => {
  if (typeof timeout === "number" && timeout > MAX_TIMER_DELAY_MS) {
    const stack = new Error().stack;
    console.error(
      "[DIAG][TimerOverflow] setInterval delay exceeds 2^31-1ms; Node will clamp.",
      { timeout, max: MAX_TIMER_DELAY_MS },
    );
    if (stack) console.error("[DIAG][TimerOverflow] stack:\n", stack);
  }
  return (__origSetInterval as any)(handler as any, timeout as any, ...args);
}) as any;
import {
  generalRateLimit,
  attendanceRateLimit,
  iotRateLimit,
  apiOptimization,
  requestCache,
  requestDeduplication,
  requestLogging,
  corsOptimization,
  dbConnectionOptimization,
} from "./middleware/rateLimit.js";
import { cacheService } from "./services/cacheService.js";
import { databaseBackupService } from "./services/databaseBackup.js";
import { monitoringService } from "./services/monitoringService.js";
import { getSessionSyncHealth } from "./services/sessionSyncHealth.js";
import { getDeploymentInfo } from "./deploymentInfo.js";
import {
  errorHandler,
  requestIdMiddleware,
  notFoundHandler,
  asyncHandler,
} from "./middleware/errorHandler.js";
import {
  users,
  students,
  classrooms,
  subjects,
  schedules,
  classSessions,
  attendanceRecords,
  computers,
  computerAssignments,
  iotDevices,
  enrollments,
  emailNotifications,
} from "../../shared/schema.js";

// Fail-closed environment validation in production-like environments
let missingEnvVars: string[] = [];
try {
  validateEnvironmentOrThrow();
  console.log("✅ Environment variables validated successfully");
} catch (error: any) {
  const msg = error?.message || String(error);
  console.error(`❌ Environment validation failed: ${msg}`);

  if (isProductionLike()) {
    process.exit(1);
  }

  // Non-production: continue, but surface warnings.
  // Attempt to derive missing names from message.
  missingEnvVars = msg.includes("Missing required environment variable")
    ? [msg.split(":").pop()?.trim() || "unknown"]
    : [];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create secure server (HTTPS in production, HTTP in development)
function createSecureServer(app: express.Application) {
  const isProduction = isProductionLike();

  if (isProduction && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) {
    // Production: Use HTTPS
    try {
      const sslOptions = {
        cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        // Optional: CA certificate for client certificate authentication
        ca: process.env.SSL_CA_PATH
          ? fs.readFileSync(process.env.SSL_CA_PATH)
          : undefined,
        // Enforce minimum TLS version for security
        minVersion: "TLSv1.2" as const,
        // Disable insecure ciphers
        ciphers: [
          "ECDHE-RSA-AES128-GCM-SHA256",
          "ECDHE-RSA-AES256-GCM-SHA384",
          "ECDHE-RSA-AES128-SHA256",
          "ECDHE-RSA-AES256-SHA384",
        ].join(":"),
        // Honor cipher order
        honorCipherOrder: true,
      };

      console.log("🔒 Creating HTTPS server for production");
      return createHttpsServer(sslOptions, app);
    } catch (error) {
      console.error("❌ Failed to create HTTPS server:", error);
      console.log("⚠️  Falling back to HTTP server");
      return createServer(app);
    }
  } else {
    // Development: Use HTTP
    console.log("🔓 Creating HTTP server for development");
    return createServer(app);
  }
}

const app = express();

// Trust proxy for accurate IP detection behind reverse proxies
app.set("trust proxy", 1);

// Shared health check handler (used by /health and /api/health for load balancers)
async function healthCheckHandler(req: express.Request, res: express.Response) {
  try {
    if (!(global as any).appInitialized) {
      return res.status(200).json({
        status: "starting",
        timestamp: new Date().toISOString(),
        message: "Application is starting up",
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
          PORT: process.env.PORT,
        },
        deployment: getDeploymentInfo(),
      });
    }

    const healthChecks = {
      database: false,
      redis: false,
      filesystem: false,
      environment: missingEnvVars.length === 0,
    };

    try {
      await safeExecute("SELECT 1");
      healthChecks.database = true;
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    try {
      const isRedisHealthy = await cacheService.ping();
      healthChecks.redis = isRedisHealthy;
    } catch (error) {
      console.error("Redis health check failed:", error);
    }

    try {
      await fs.promises.access(process.cwd(), fs.constants.R_OK);
      healthChecks.filesystem = true;
    } catch (error) {
      console.error("Filesystem health check failed:", error);
    }

    const criticalChecks = [healthChecks.database, healthChecks.filesystem];
    const allHealthy =
      criticalChecks.every(Boolean) && healthChecks.environment;
    const sessionSyncHealth = getSessionSyncHealth();
    const status = allHealthy
      ? "healthy"
      : healthChecks.database && healthChecks.filesystem
        ? "degraded"
        : "unhealthy";

    const response = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      deployment: getDeploymentInfo(),
      checks: healthChecks,
      services: {
        database: healthChecks.database ? "up" : "down",
        redis: healthChecks.redis ? "up" : "down",
        filesystem: healthChecks.filesystem ? "accessible" : "inaccessible",
        environment: healthChecks.environment
          ? "configured"
          : "missing_variables",
        sessionSync:
          sessionSyncHealth.status === "ok" ? "healthy" : "degraded",
      },
      sessionSync: sessionSyncHealth,
      warnings:
        missingEnvVars.length > 0
          ? [`Missing environment variables: ${missingEnvVars.join(", ")}`]
          : [],
    };

    res
      .status(allHealthy ? 200 : status === "degraded" ? 200 : 503)
      .json(response);
  } catch (error: any) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      details: error?.message || "Unknown error",
    });
  }
}

app.get("/health", healthCheckHandler);
app.get("/api/health", healthCheckHandler);

const server = createSecureServer(app);
const wss = new WebSocketServer({
  server,
  // Additional security options for WebSocket
  perMessageDeflate: false, // Disable compression to prevent BREACH attacks
  maxPayload: 1024 * 1024, // 1MB max payload
});

// Export for integration tests (Supertest can run against the Express app instance)
export { app, server };

const serveSpa = (res: express.Response) => {
  if (fs.existsSync(path.join(publicPath, "index.html"))) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(path.join(publicPath, "index.html"));
  } else {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CLIRDEC:PRESENCE</title>
        </head>
        <body>
          <h1>CLIRDEC:PRESENCE</h1>
          <p>Index.html not found at: ${path.join(publicPath, "index.html")}</p>
          <p>Public path: ${publicPath}</p>
          <p>Working directory: ${process.cwd()}</p>
          <p>__dirname: ${__dirname}</p>
        </body>
      </html>
    `);
  }
};

// Root route for SPA
app.get("/", (req, res) => {
  serveSpa(res);
});

// Request ID middleware (must be first)
app.use(requestIdMiddleware);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    // Reduce cross-origin data leakage
    referrerPolicy: { policy: "no-referrer" },
    // Don't enable COEP by default (can break loading cross-origin resources)
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);
app.use(corsOptimization);

// HTTPS enforcement middleware
if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });
}

// Performance and optimization middleware
app.use(requestLogging);
app.use(apiOptimization);
app.use(dbConnectionOptimization);

// Rate limiting with different limits for different endpoints
app.use("/api/attendance", attendanceRateLimit);
app.use("/api/iot", iotRateLimit);
app.use("/api", generalRateLimit);

// Request deduplication for critical operations
app.use("/api/attendance", requestDeduplication(3000)); // 3 seconds
app.use("/api/auth", requestDeduplication(5000)); // 5 seconds

// API response caching for read operations
app.use("/api/dashboard", requestCache(60)); // 1 minute cache
app.use("/api/schedules", requestCache(300)); // 5 minutes cache
app.use("/api/students", requestCache(600)); // 10 minutes cache

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Import validation middleware
import { sanitizeInput, preventSQLInjection } from "./middleware/validation.js";

// Global input sanitization and security
app.use(sanitizeInput);
app.use(preventSQLInjection);

// Session configuration with PostgreSQL store
app.use(sessionMiddleware);

// Serve static files from client build
const publicPath = path.join(__dirname, "../../../public");
console.log("Serving static files from:", publicPath);

// Ensure public directory exists
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
  console.log("Created public directory:", publicPath);
}

app.use(
  express.static(publicPath, {
    setHeaders: (res, filePath) => {
      const normalizedPath = filePath.replace(/\\/g, "/");
      if (
        normalizedPath.endsWith("/index.html") ||
        normalizedPath.endsWith("/manifest.webmanifest") ||
        normalizedPath.endsWith("/sw.js") ||
        normalizedPath.includes("/workbox-")
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return;
      }

      if (normalizedPath.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }),
);

// TEMPORARY: Fix session constraint endpoint
app.get("/api/admin/fix-session", async (req, res) => {
  try {
    // This endpoint exists only for emergency migrations / one-off fixes.
    // Never expose this in production-like deployments.
    if (
      process.env.NODE_ENV === "production" ||
      process.env.RAILWAY_ENVIRONMENT
    ) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Must be explicitly enabled even in non-production.
    if (process.env.ALLOW_FIX_SESSION_ENDPOINT !== "true") {
      return res.status(403).json({
        success: false,
        message:
          "fix-session endpoint disabled (set ALLOW_FIX_SESSION_ENDPOINT=true to enable in non-production)",
      });
    }

    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    // Make user_id nullable to allow connect-pg-simple to create sessions
    try {
      await pool.query(
        "ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL",
      );
      console.log("✅ Made user_id nullable");
    } catch (err: any) {
      console.log(
        "ℹ️ user_id nullable:",
        err?.message || "already nullable or error",
      );
    }

    // Make ip_address nullable - try multiple approaches
    try {
      // First try: simple ALTER
      await pool.query(
        "ALTER TABLE user_sessions ALTER COLUMN ip_address DROP NOT NULL",
      );
      console.log("✅ Made ip_address nullable (method 1)");
    } catch (err: any) {
      console.log("ℹ️ ip_address method 1:", err?.message?.substring(0, 80));
      try {
        // Second try: drop column and recreate
        await pool.query(
          "ALTER TABLE user_sessions DROP COLUMN IF EXISTS ip_address",
        );
        await pool.query(
          "ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(45)",
        );
        console.log("✅ Made ip_address nullable (method 2 - recreate)");
      } catch (err2: any) {
        console.log("ℹ️ ip_address method 2:", err2?.message?.substring(0, 80));
      }
    }

    // Drop existing constraint if exists, then add new one
    await pool
      .query(
        "ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS session_sid_key",
      )
      .catch(() => {});
    await pool.query(
      "ALTER TABLE user_sessions ADD CONSTRAINT session_sid_key UNIQUE (sid)",
    );
    await pool
      .query("DROP INDEX IF EXISTS user_sessions_expire_idx")
      .catch(() => {});
    await pool.query(
      "CREATE INDEX user_sessions_expire_idx ON user_sessions (expire)",
    );

    await pool.end();
    res.json({
      success: true,
      message: "Session constraints, user_id and ip_address fixed",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Routes
app.use("/api", routes);

// SPA fallback for client-side routes.
// Keep this before the API notFound/error middleware so browser refreshes on
// frontend routes return index.html instead of a JSON 404 payload.
app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
  serveSpa(res);
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(wss);

// Global flag to track database availability
let isDatabaseAvailable = false;

// Function to check database connectivity
async function checkDatabaseConnection() {
  try {
    await safeExecute("SELECT 1");
    isDatabaseAvailable = true;
    console.log(`✅ Database connected successfully`);
    return true;
  } catch (error) {
    isDatabaseAvailable = false;
    console.error(`❌ Database connection failed:`, error);
    return false;
  }
}

// Function to log database table counts
async function logTableCounts() {
  if (!isDatabaseAvailable) {
    console.log(
      "⚠️  Skipping table count logging due to database unavailability",
    );
    return;
  }

  console.log("📊 Checking database table counts...");

  const tables = [
    { name: "users", table: users },
    { name: "students", table: students },
    { name: "classrooms", table: classrooms },
    { name: "subjects", table: subjects },
    { name: "schedules", table: schedules },
    { name: "class_sessions", table: classSessions },
    { name: "attendance_records", table: attendanceRecords },
    { name: "computers", table: computers },
    { name: "computer_assignments", table: computerAssignments },
    { name: "iot_devices", table: iotDevices },
    { name: "enrollments", table: enrollments },
    { name: "email_notifications", table: emailNotifications },
  ];

  for (const { name, table } of tables) {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(table);
      const count = result[0]?.count || 0;
      console.log(`  ${name}: ${count} records`);
    } catch (error) {
      console.log(
        `  ${name}: ERROR - ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }
}

// Database initialization for Railway (ephemeral PostgreSQL)
async function initializeDatabaseColumns() {
  // Run on Railway or if DATABASE_URL contains railway
  const isRailway =
    process.env.RAILWAY_ENVIRONMENT ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("railway"));

  if (!isRailway) {
    return;
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    console.log("🔧 Running database column migrations...");

    // Note: pg_stat_statements extension is NOT supported on Railway PostgreSQL
    // It requires shared_preload_libraries configuration which isn't available on Railway
    // Performance metrics will show as 0
    console.log("ℹ️ pg_stat_statements not available on Railway - skipping");

    // Add columns to user_sessions table for connect-pg-simple
    await pool
      .query("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sid VARCHAR")
      .catch(() => {});
    await pool
      .query("ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sess JSONB")
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expire TIMESTAMP",
      )
      .catch(() => {});

    // Make user_id nullable to allow connect-pg-simple to create sessions
    try {
      await pool.query(
        "ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL",
      );
      console.log("✅ Made user_id nullable");
    } catch {}

    // Make ip_address nullable to allow connect-pg-simple to create sessions
    try {
      await pool.query(
        "ALTER TABLE user_sessions ALTER COLUMN ip_address DROP NOT NULL",
      );
      console.log("✅ Made ip_address nullable");
    } catch (err: any) {
      console.log(
        "ℹ️ ip_address:",
        err?.message?.substring(0, 50) || "already nullable",
      );
    }

    // Make expires_at nullable - critical for connect-pg-simple
    try {
      await pool.query(
        "ALTER TABLE user_sessions ALTER COLUMN expires_at DROP NOT NULL",
      );
      console.log("✅ Made expires_at nullable");
    } catch (err: any) {
      console.log(
        "ℹ️ expires_at:",
        err?.message?.substring(0, 50) || "already nullable",
      );
    }

    // Add unique constraint on sid for connect-pg-simple
    // First, make session_id nullable to avoid conflict with connect-pg-simple
    await pool
      .query("ALTER TABLE user_sessions ALTER COLUMN session_id DROP NOT NULL")
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS session_sid_key",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE user_sessions ADD CONSTRAINT session_sid_key UNIQUE (sid)",
      )
      .catch(() => {});

    // Add index on expire for better query performance
    await pool
      .query("DROP INDEX IF EXISTS user_sessions_expire_idx")
      .catch(() => {});
    await pool
      .query("CREATE INDEX user_sessions_expire_idx ON user_sessions (expire)")
      .catch(() => {});

    // Add columns to error_logs table
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR",
      )
      .catch(() => {});
    await pool
      .query("ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS method VARCHAR")
      .catch(() => {});

    // Ensure students RFID hash column exists for deterministic UID lookup.
    // This is required by current queries and may be missing on older Railway DBs.
    await pool
      .query(
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS rfid_uid_hash VARCHAR(64)",
      )
      .catch(() => {});
    await pool
      .query(
        "CREATE UNIQUE INDEX IF NOT EXISTS students_rfid_uid_hash_unique ON students (rfid_uid_hash)",
      )
      .catch(() => {});

    // Encrypted student fields are JSON envelopes. PostgreSQL VARCHAR limits from
    // older schemas can reject valid encrypted RFID/parent data during inserts.
    await pool
      .query(
        "ALTER TABLE students DROP CONSTRAINT IF EXISTS students_rfid_uid_unique",
      )
      .catch(() => {});
    await pool
      .query("ALTER TABLE students DROP CONSTRAINT IF EXISTS students_rfid_uid_key")
      .catch(() => {});
    await pool
      .query("DROP INDEX IF EXISTS students_rfid_uid_unique")
      .catch(() => {});
    await pool
      .query("ALTER TABLE students ALTER COLUMN rfid_uid TYPE TEXT")
      .catch(() => {});
    await pool
      .query("ALTER TABLE students ALTER COLUMN parent_email TYPE TEXT")
      .catch(() => {});
    await pool
      .query("ALTER TABLE students ALTER COLUMN parent_name TYPE TEXT")
      .catch(() => {});

    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS api_key VARCHAR(128)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS name VARCHAR(255)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS location VARCHAR(255)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS sensor_type VARCHAR(50)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS mqtt_topic VARCHAR(255)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50)")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS battery_level INTEGER")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS signal_strength INTEGER")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true")
      .catch(() => {});
    await pool
      .query("UPDATE iot_devices SET is_active = true WHERE is_active IS NULL")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ALTER COLUMN is_active SET DEFAULT true")
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ALTER COLUMN is_active SET NOT NULL")
      .catch(() => {});
    await pool
      .query(
        "UPDATE iot_devices SET api_key = CONCAT('pk_migrated_', md5(random()::text || clock_timestamp()::text || device_id)) WHERE api_key IS NULL OR api_key = ''",
      )
      .catch(() => {});
    await pool
      .query(
        "CREATE UNIQUE INDEX IF NOT EXISTS iot_devices_api_key_unique ON iot_devices (api_key)",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS certificate_fingerprint VARCHAR(128)",
      )
      .catch(() => {});
    await pool
      .query("ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS certificate_data TEXT")
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR",
      )
      .catch(() => {});
    await pool
      .query("ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS url VARCHAR")
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS status_code INTEGER",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS response_time INTEGER",
      )
      .catch(() => {});
    await pool
      .query("ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS metadata JSONB")
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_by VARCHAR",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true",
      )
      .catch(() => {});

    // Add columns to audit_logs table
    await pool
      .query("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB")
      .catch(() => {});
    await pool
      .query("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB")
      .catch(() => {});
    await pool
      .query("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB")
      .catch(() => {});
    await pool
      .query("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash VARCHAR")
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash VARCHAR",
      )
      .catch(() => {});
    await pool
      .query(
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true",
      )
      .catch(() => {});
    await pool
      .query(`
        CREATE TABLE IF NOT EXISTS academic_holidays (
          id SERIAL PRIMARY KEY,
          holiday_date VARCHAR(10) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          recurs_annually BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)
      .catch(() => {});

    await pool.end();
    console.log("✅ Database column migrations completed");
  } catch (err) {
    console.error(
      "❌ Database column migration error:",
      err instanceof Error ? err.message : err,
    );
  }
}

function initializeSqliteColumns() {
  if (!dbClient || typeof dbClient.exec !== "function") {
    return;
  }

  try {
    dbClient.exec(`
      ALTER TABLE students ADD COLUMN rfid_uid_hash TEXT;
    `);
  } catch (error: any) {
    if (!String(error?.message || error).includes("duplicate column name")) {
      console.warn("SQLite migration warning (students.rfid_uid_hash):", error);
    }
  }

  try {
    dbClient.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS students_rfid_uid_hash_unique
      ON students(rfid_uid_hash);
    `);
  } catch (error) {
    console.warn("SQLite migration warning (students RFID hash index):", error);
  }

  try {
    dbClient.exec(`
      ALTER TABLE iot_devices ADD COLUMN api_key TEXT;
    `);
  } catch (error: any) {
    if (!String(error?.message || error).includes("duplicate column name")) {
      console.warn("SQLite migration warning (iot_devices.api_key):", error);
    }
  }

  try {
    dbClient.exec(`
      UPDATE iot_devices
      SET api_key = 'pk_migrated_' || lower(hex(randomblob(16)))
      WHERE api_key IS NULL OR api_key = '';
      CREATE UNIQUE INDEX IF NOT EXISTS iot_devices_api_key_unique
      ON iot_devices(api_key);
    `);
  } catch (error) {
    console.warn("SQLite migration warning (iot_devices API key backfill):", error);
  }

  try {
    dbClient.exec(`
      ALTER TABLE iot_devices ADD COLUMN certificate_fingerprint TEXT;
    `);
  } catch (error: any) {
    if (!String(error?.message || error).includes("duplicate column name")) {
      console.warn(
        "SQLite migration warning (iot_devices.certificate_fingerprint):",
        error,
      );
    }
  }

  try {
    dbClient.exec(`
      ALTER TABLE iot_devices ADD COLUMN certificate_data TEXT;
    `);
  } catch (error: any) {
    if (!String(error?.message || error).includes("duplicate column name")) {
      console.warn("SQLite migration warning (iot_devices.certificate_data):", error);
    }
  }

  try {
    dbClient.exec(`
      CREATE TABLE IF NOT EXISTS academic_holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holiday_date TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        recurs_annually INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.warn("SQLite migration warning (academic_holidays):", error);
  }
}

const PORT = process.env.PORT || 3000;

const HOST = process.env.HOST || "0.0.0.0";

// Initialize database columns + start listener (disabled under Jest/test).
// Integration tests should import [`app`](server/src/index.ts:123) and run Supertest
// without binding a real TCP port.
const isDevScript = process.env.npm_lifecycle_event === "dev";
const shouldStartListener =
  isDevScript ||
  (process.env.NODE_ENV !== "test" && process.env.JEST_WORKER_ID === undefined);

if (shouldStartListener) {
  initializeDatabaseColumns().then(() => {
    initializeSqliteColumns();

    server.listen({ port: PORT, host: HOST }, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      console.log(`🌐 WebSocket server ready`);

      // Start automated database backup (only in production)
      if (process.env.NODE_ENV === "production") {
        if (process.env.BACKUP_ENABLED === "true") {
          databaseBackupService.startAutomatedBackup();
          console.log(
            "Automated database backup enabled (BACKUP_ENABLED=true)",
          );
        } else {
          console.log(
            "Automated database backup disabled (set BACKUP_ENABLED=true to enable)",
          );
        }
      }

      // Add db.execute method for compatibility
      addExecuteMethod();

      // Check database connection and print table counts
      checkDatabaseConnection().then(async (dbAvailable) => {
        if (dbAvailable) {
          await logTableCounts();

          // SECURITY: Do NOT auto-create or reset a default admin in production.
          // Use an explicit bootstrap flow when needed.
          const bootstrapEnabled = process.env.BOOTSTRAP_ADMIN === "true";
          if (bootstrapEnabled) {
            try {
              const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
              const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

              if (!email || !password) {
                console.error(
                  "❌ BOOTSTRAP_ADMIN is enabled but BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD is missing",
                );
                return;
              }

              if (password.length < 12) {
                console.error(
                  "❌ BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters",
                );
                return;
              }

              const existingAdmin = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

              if (existingAdmin.length === 0) {
                const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                await db.insert(users).values({
                  email,
                  password: hashedPassword,
                  name: "System Administrator",
                  role: "admin",
                  isActive: true,
                });
                console.log(
                  `✅ Bootstrap admin user created: ${email} (BOOTSTRAP_ADMIN=true)`,
                );
              } else {
                console.log(
                  `ℹ️ Bootstrap admin skipped: user already exists (${email})`,
                );
              }
            } catch (error) {
              console.error("❌ Failed during BOOTSTRAP_ADMIN flow:", error);
            }
          }
        }
      });

      console.log("Server started successfully");

      // Mark app as fully initialized for health checks
      (global as any).appInitialized = true;
    }); // End of server.listen callback
  }); // End of initializeDatabaseColumns().then()
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received, initiating graceful shutdown...`);

  try {
    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error("Error closing HTTP server:", err);
        process.exit(1);
      }
      console.log("HTTP server closed");
    });

    // Close WebSocket server
    if (wss) {
      wss.clients.forEach((client) => {
        client.close(1001, "Server shutting down");
      });
      wss.close((err) => {
        if (err) {
          console.error("Error closing WebSocket server:", err);
        } else {
          console.log("WebSocket server closed");
        }
      });
    }

    // Stop monitoring service
    monitoringService.destroy();
    console.log("Monitoring service stopped");

    // Close Redis connections
    await cacheService.disconnect();
    console.log("Redis connections closed");

    // Close database connections (if needed)
    // Drizzle ORM handles connection pooling automatically

    // Stop automated database backup
    if (process.env.NODE_ENV === "production") {
      databaseBackupService.stopAutomatedBackup();
      console.log("Automated database backup stopped");
    }

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
