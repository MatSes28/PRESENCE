const express = require("express");
const app = express();

console.log("🚀 Starting minimal CLIRDEC:PRESENCE server...");
console.log("Environment variables:");
console.log("- PORT:", process.env.PORT);
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("- Current working directory:", process.cwd());
console.log("- Node version:", process.version);
console.log("- Platform:", process.platform);

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("Health check received at", new Date().toISOString());
  console.log("Health check from IP:", req.ip);
  console.log("Health check user-agent:", req.get("User-Agent"));
  console.log("Health check headers:", JSON.stringify(req.headers));

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Minimal server is running",
    environment: process.env.NODE_ENV || "unknown",
    port: process.env.PORT || "unknown",
    server_address: serverInstance
      ? serverInstance.address()
      : "server not started",
    request_ip: req.ip,
    connection_remoteAddress: req.connection.remoteAddress,
    socket_remoteAddress: req.socket.remoteAddress,
  });
});

// Variable to hold server reference
let serverInstance = null;

// Catch-all for SPA and health checks
app.get("*", (req, res) => {
  console.log("Request received at", new Date().toISOString());
  console.log("Request path:", req.path);
  console.log("Request from IP:", req.ip);
  console.log("Request user-agent:", req.get("User-Agent"));

  // Always return health response for Railway compatibility
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Minimal server is running",
    environment: process.env.NODE_ENV || "unknown",
    port: process.env.PORT || "unknown",
    server_address: serverInstance
      ? serverInstance.address()
      : "server not started",
    request_path: req.path,
    request_ip: req.ip,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

let PORT = parseInt(process.env.PORT || "8080", 10);

if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`Invalid PORT value: ${process.env.PORT}, defaulting to 8080`);
  PORT = 8080;
}

console.log(`Parsed PORT: ${PORT} (from env: ${process.env.PORT})`);
console.log(`Attempting to listen on port ${PORT}...`);

serverInstance = app
  .listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Minimal server successfully listening on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🌍 Bound to all interfaces`);
    console.log(`Server address:`, serverInstance.address());
  })
  .on("error", (error) => {
    console.error("❌ Failed to start minimal server:", error);
    process.exit(1);
  });

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle process termination
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});
