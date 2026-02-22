import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
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
  generalRateLimit,
  attendanceRateLimit,
  reportRateLimit,
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

// Environment variable validation for security
const requiredEnvVars = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

// In Railway/production, don't exit - allow deployment to succeed with warnings
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
const isProduction = process.env.NODE_ENV === "production" || isRailway;

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars);
  if (!isRailway && !isProduction) {
    console.error(
      "Please set these variables in your .env file or environment",
    );
    process.exit(1);
  } else {
    console.warn(
      "⚠️  Running in Railway with missing environment variables - some features may not work",
    );
  }
}

// Validate secret lengths (minimum 32 characters for security)
const secretsToValidate = [
  { name: "SESSION_SECRET", value: process.env.SESSION_SECRET },
  { name: "JWT_SECRET", value: process.env.JWT_SECRET },
  { name: "JWT_REFRESH_SECRET", value: process.env.JWT_REFRESH_SECRET },
];

for (const secret of secretsToValidate) {
  if (secret.value && secret.value.length < 32) {
    console.error(`❌ ${secret.name} must be at least 32 characters long`);
    if (!isRailway && !isProduction) {
      process.exit(1);
    } else {
      console.warn(
        `⚠️  ${secret.name} is too short - using fallback for Railway deployment`,
      );
    }
  }
}

if (
  missingEnvVars.length === 0 &&
  secretsToValidate.every((s) => !s.value || s.value.length >= 32)
) {
  console.log("✅ Environment variables validated successfully");
} else if (isRailway || isProduction) {
  console.log(
    "⚠️  Environment validation completed with warnings (Railway deployment)",
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create secure server (HTTPS in production, HTTP in development)
function createSecureServer(app: express.Application) {
  const isProduction =
    process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

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

// Health check endpoint (available during startup and after initialization)
app.get("/health", async (req, res) => {
  try {
    // If we haven't completed full initialization yet, return basic status
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
      });
    }

    // Full health check after initialization
    const healthChecks = {
      database: false,
      redis: false,
      filesystem: false,
      environment: missingEnvVars.length === 0,
    };

    // Check database connectivity
    try {
      await safeExecute("SELECT 1");
      healthChecks.database = true;
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    // Check Redis connectivity
    try {
      const isRedisHealthy = await cacheService.ping();
      healthChecks.redis = isRedisHealthy;
    } catch (error) {
      console.error("Redis health check failed:", error);
    }

    // Check filesystem access
    try {
      await fs.promises.access(process.cwd(), fs.constants.R_OK);
      healthChecks.filesystem = true;
    } catch (error) {
      console.error("Filesystem health check failed:", error);
    }

    // Determine overall health status
    const criticalChecks = [healthChecks.database, healthChecks.filesystem];
    const allHealthy =
      criticalChecks.every(Boolean) && healthChecks.environment;
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
      checks: healthChecks,
      services: {
        database: healthChecks.database ? "up" : "down",
        redis: healthChecks.redis ? "up" : "down",
        filesystem: healthChecks.filesystem ? "accessible" : "inaccessible",
        environment: healthChecks.environment
          ? "configured"
          : "missing_variables",
      },
      warnings:
        missingEnvVars.length > 0
          ? [`Missing environment variables: ${missingEnvVars.join(", ")}`]
          : [],
    };

    res
      .status(allHealthy ? 200 : status === "degraded" ? 200 : 503)
      .json(response);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      details: error.message,
    });
  }
});

const server = createSecureServer(app);
const wss = new WebSocketServer({
  server,
  // Additional security options for WebSocket
  perMessageDeflate: false, // Disable compression to prevent BREACH attacks
  maxPayload: 1024 * 1024, // 1MB max payload
});

// Root route for SPA
app.get("/", (req, res) => {
  if (fs.existsSync(path.join(publicPath, "index.html"))) {
    res.sendFile(path.join(publicPath, "index.html"));
  } else {
    res.send(`
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
app.use("/api/reports", reportRateLimit);
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
const PgSession = connectPgSimple(session);

// Parse database URL for session store SSL config
const sessionDbConfig = {
  connectionString: process.env.DATABASE_URL,
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false, // Allow self-signed certificates (Railway)
    },
  }),
};

app.use(
  session({
    store: new PgSession({
      ...sessionDbConfig,
      tableName: "user_sessions", // Will be created automatically
      createTableIfMissing: true,
      // Clean up expired sessions every hour
      pruneSessionInterval: 60 * 60 * 1000, // 1 hour
    }),
    secret:
      process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    name: "presence.sid", // Change default session name for security
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    cookie: {
      secure:
        process.env.NODE_ENV === "production" ||
        !!process.env.RAILWAY_ENVIRONMENT, // Railway sets RAILWAY_ENVIRONMENT
      httpOnly: true,
      sameSite:
        process.env.NODE_ENV === "production" ||
        !!process.env.RAILWAY_ENVIRONMENT
          ? "none"
          : "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours (reduced for security)
      path: "/",
    },
  }),
);

// Serve static files from client build
const publicPath = path.join(__dirname, "../../../public");
console.log("Serving static files from:", publicPath);

// Ensure public directory exists
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
  console.log("Created public directory:", publicPath);
}

app.use(express.static(publicPath));

// Routes
app.use("/api", routes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Removed specific routes for client-side navigation - let React handle routing

// Catch all handler: send back React's index.html file for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

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

    // Enable pg_stat_statements extension
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");

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

    // Add unique constraint on sid for connect-pg-simple
    await pool
      .query(
        "ALTER TABLE user_sessions ADD CONSTRAINT IF NOT EXISTS session_sid_key UNIQUE (sid)",
      )
      .catch(() => {});

    // Add index on expire for better query performance
    await pool
      .query(
        "CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire)",
      )
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

    await pool.end();
    console.log("✅ Database column migrations completed");
  } catch (err) {
    console.error(
      "❌ Database column migration error:",
      err instanceof Error ? err.message : err,
    );
  }
}

const PORT = process.env.PORT || 3000;

const HOST = process.env.HOST || "0.0.0.0";

// Initialize database columns before starting server
initializeDatabaseColumns().then(() => {
  server.listen({ port: PORT, host: HOST }, () => {
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`🌐 WebSocket server ready`);

    // Start automated database backup (only in production)
    if (process.env.NODE_ENV === "production") {
      databaseBackupService.startAutomatedBackup();
      console.log("Automated database backup enabled");
    }

    // Add db.execute method for compatibility
    addExecuteMethod();

    // Check database and create admin user if needed
    checkDatabaseConnection().then(async (dbAvailable) => {
      if (dbAvailable) {
        await logTableCounts();

        // Create admin user if it doesn't exist
        try {
          const existingAdmin = await db
            .select()
            .from(users)
            .where(eq(users.email, "admin@clsu.edu.ph"))
            .limit(1);

          if (existingAdmin.length === 0) {
            const hashedPassword = await bcrypt.hash("admin123", 12);
            await db.insert(users).values({
              email: "admin@clsu.edu.ph",
              password: hashedPassword,
              name: "System Administrator",
              role: "admin",
              isActive: true,
            });
            console.log("✅ Admin user created: admin@clsu.edu.ph / admin123");
          } else {
            // Update password to ensure it's correct
            const hashedPassword = await bcrypt.hash("admin123", 12);
            await db
              .update(users)
              .set({ password: hashedPassword, isActive: true })
              .where(eq(users.email, "admin@clsu.edu.ph"));
            console.log(
              "✅ Admin user password updated: admin@clsu.edu.ph / admin123",
            );
          }
        } catch (error) {
          console.error("❌ Failed to setup admin user:", error);
          console.error("Error details:", error.message);
          // Don't exit - admin can be created manually if needed
        }
      }
    });

    console.log("Server started successfully");

    // Mark app as fully initialized for health checks
    (global as any).appInitialized = true;
  }); // End of server.listen callback
}); // End of initializeDatabaseColumns().then()

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
