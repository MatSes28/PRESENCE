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
} from "../../shared/schema.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: true, // Allow all origins in development
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
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to false for development to work with HTTP
      httpOnly: true,
      sameSite: "lax", // Allow cookies to work with proxy
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Serve static files from client build
app.use(express.static(path.join(process.cwd(), "public")));
// Fallback for production: use absolute path
if (!require("fs").existsSync(path.join(process.cwd(), "public"))) {
  app.use(express.static("/app/server/public"));
}

// Routes
app.use("/api", routes);

// Catch all handler: send back React's index.html file for client-side routing
app.get("*", (req, res) => {
  const indexPath = path.join(process.cwd(), "public/index.html");
  if (require("fs").existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile("/app/server/public/index.html");
  }
});

// Health check endpoint
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
    } catch (error) {
      isDatabaseAvailable = false;
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
  }

  const isHealthy =
    healthStatus.database === "connected" &&
    healthStatus.emailService !== "error";
  healthStatus.status = isHealthy ? "ok" : "degraded";

  res.status(isHealthy ? 200 : 503).json(healthStatus);
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

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 WebSocket server ready`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // Test database connection on startup
  await checkDatabaseConnection();
  await logTableCounts();
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
