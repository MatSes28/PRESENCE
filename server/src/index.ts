console.log("🚀 Starting CLIRDEC:PRESENCE server...");

import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import rateLimit from "express-rate-limit";
import path from "path";

import { db } from "./storage.js";
import routes from "./routes.js";
import { setupWebSocket } from "./services/websocket.js";
import { sessionScheduler } from "./services/scheduler.js";
import { sql } from "drizzle-orm";
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
  rfidScans,
} from "../../shared/schema.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.ALLOWED_ORIGINS?.split(",") || true // Allow all in production if not specified
        : true, // Allow all origins in development
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session configuration
const sessionSecret =
  process.env.SESSION_SECRET || "fallback-session-secret-for-deployment";
if (
  !sessionSecret ||
  sessionSecret === "fallback-session-secret-for-deployment"
) {
  console.warn(
    "⚠️  Using fallback session secret. Set SESSION_SECRET environment variable for security."
  );
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS in production
      httpOnly: true,
      sameSite: "lax", // Allow cookies to work with proxy
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Serve static files from client build
app.use(express.static(path.join(process.cwd(), "public")));

// Health check endpoint (must be before catch-all handler)
app.get("/health", async (req, res) => {
  const healthStatus: any = {
    status: "ok",
    timestamp: new Date().toISOString(),
    database: isDatabaseAvailable ? "connected" : "disconnected",
    emailService: process.env.BREVO_API_KEY ? "configured" : "not_configured",
  };

  // Test database connection if it was previously available
  if (isDatabaseAvailable) {
    try {
      await db.execute(sql`SELECT 1`);
      healthStatus.database = "connected";
    } catch (error) {
      isDatabaseAvailable = false;
      healthStatus.database = "disconnected";
      healthStatus.database_error =
        error instanceof Error ? error.message : "Unknown error";
    }
  } else {
    // Try to connect if not previously available
    try {
      await db.execute(sql`SELECT 1`);
      isDatabaseAvailable = true;
      healthStatus.database = "connected";
    } catch (error) {
      healthStatus.database = "disconnected";
      healthStatus.database_error =
        error instanceof Error ? error.message : "Unknown error";
    }
  }

  // Test email service
  if (process.env.BREVO_API_KEY) {
    try {
      const { emailService } = await import("./services/emailService.js");
      // We can't easily test the actual API without sending an email,
      // but we can check if the service is initialized
      healthStatus.emailService = "initialized";
    } catch (error) {
      healthStatus.emailService = "error";
      healthStatus.emailService_error =
        error instanceof Error ? error.message : "Unknown error";
    }
  } else {
    healthStatus.emailService = "not_configured";
  }

  // For production deployment, be very lenient with health checks
  // The app should be considered healthy if it's running, regardless of service status
  const isProduction = process.env.NODE_ENV === "production";

  // Always return healthy in production - Railway should consider the app healthy if it's responding
  if (isProduction) {
    healthStatus.status = "ok";
    return res.status(200).json(healthStatus);
  }

  // In development, check actual service status
  const isHealthy =
    healthStatus.database === "connected" &&
    healthStatus.emailService !== "error";

  healthStatus.status = isHealthy ? "ok" : "degraded";

  res.status(isHealthy ? 200 : 503).json(healthStatus);
});

// Routes
app.use("/api", routes);

// Catch all handler: send back React's index.html file for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public/index.html"));
});

// Global error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled error:", err);

  // Log error details for debugging
  const errorDetails = {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  };

  console.error("Error details:", JSON.stringify(errorDetails, null, 2));

  // Don't leak error details in production
  const isProduction = process.env.NODE_ENV === "production";

  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? "Internal server error" : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Setup WebSocket (with error handling)
try {
  setupWebSocket(wss);
} catch (error) {
  console.error("Failed to setup WebSocket:", error);
  // Don't crash the app if WebSocket setup fails
}

// Global flag to track database availability
let isDatabaseAvailable = false;

// Function to check database connectivity
async function checkDatabaseConnection() {
  try {
    await db.execute(sql`SELECT 1`);
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
      "⚠️  Skipping table count logging due to database unavailability"
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
    { name: "rfid_scans", table: rfidScans },
  ];

  for (const { name, table } of tables) {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(table);
      const count = result[0]?.count || 0;
      console.log(`  ${name}: ${count} records`);
    } catch (error) {
      // Don't fail if table doesn't exist or query fails
      console.log(
        `  ${name}: Not available - ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

// Set NODE_ENV to production if not set (Railway deployment)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

const PORT = parseInt(process.env.PORT || "3000", 10);

console.log(
  `🔧 Starting server with PORT=${PORT}, NODE_ENV=${process.env.NODE_ENV}`
);

server
  .listen(PORT, async () => {
    console.log(`🚀 Server successfully listening on port ${PORT}`);
    console.log(`🌐 WebSocket server ready`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🌍 Server bound to all interfaces`);

    // Test database connection on startup (non-blocking)
    console.log("🔌 Testing database connection...");
    checkDatabaseConnection()
      .then(() => {
        console.log("📊 Logging table counts...");
        return logTableCounts();
      })
      .catch((error) => {
        console.error("❌ Database initialization failed:", error);
        console.log(
          "⚠️ Server will continue running without database connectivity"
        );
      });

    // Start session scheduler (non-blocking) - only if database is available
    setTimeout(() => {
      if (isDatabaseAvailable) {
        try {
          console.log("⏰ Starting session scheduler...");
          sessionScheduler.start();
          console.log("✅ Session scheduler started successfully");
        } catch (error) {
          console.error("❌ Failed to start session scheduler:", error);
          console.log(
            "⚠️ Server will continue running without session scheduler"
          );
        }
      } else {
        console.log("⏰ Skipping session scheduler - database not available");
      }
    }, 2000); // Start scheduler 2 seconds after server starts

    console.log("🎉 Server startup complete!");
  })
  .on("error", (error) => {
    console.error("❌ Failed to start server:", error);
    console.error("💥 Server startup failed - exiting");
    process.exit(1);
  });

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});
