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

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-domain.com"] // Replace with your actual domain
        : ["http://localhost:5173"], // Vite dev server
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
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Serve static files from client build
app.use(express.static(path.join(process.cwd(), "public")));

// Routes
app.use("/api", routes);

// Catch all handler: send back React's index.html file for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public/index.html"));
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Test database connection
    await db.execute(sql`SELECT 1`);
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Setup WebSocket
setupWebSocket(wss);

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 WebSocket server ready`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // Test database connection on startup
  try {
    await db.execute(sql`SELECT 1`);
    console.log(`✅ Database connected successfully`);
  } catch (error) {
    console.error(`❌ Database connection failed:`, error);
    process.exit(1);
  }
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
