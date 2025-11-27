import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { db } from "./storage.js";
import routes from "./routes.js";
import { setupWebSocket } from "./services/websocket.js";
import { sql } from "drizzle-orm";
import {
  generalRateLimit,
  authRateLimit,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy for accurate IP detection behind reverse proxies
app.set("trust proxy", 1);

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Health check endpoint (before other middleware)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Server is healthy",
  });
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

// Security middleware
app.use(helmet());
app.use(corsOptimization);

// Performance and optimization middleware
app.use(requestLogging);
app.use(apiOptimization);
app.use(dbConnectionOptimization);

// Rate limiting with different limits for different endpoints
app.use("/api/auth", authRateLimit);
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

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
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
  })
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
        }`
      );
    }
  }
}

const PORT = process.env.PORT || 3000;

const HOST = process.env.HOST || "0.0.0.0";

server.listen({ port: PORT, host: HOST }, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🌐 WebSocket server ready`);

  // Don't check database on startup to avoid crashes
  console.log("Server started successfully");
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
