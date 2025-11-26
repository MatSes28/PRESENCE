import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

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

// Session configuration with PostgreSQL store
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "user_sessions", // Will be created automatically
      createTableIfMissing: true,
    }),
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
