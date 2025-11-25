const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "8080", 10);

if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`Invalid PORT value: ${process.env.PORT}, defaulting to 8080`);
  PORT = 8080;
}

console.log("🚀 Starting static CLIRDEC:PRESENCE server...");
console.log("Environment variables:");
console.log("- PORT:", process.env.PORT);
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("- Current working directory:", process.cwd());
console.log("- Node version:", process.version);
console.log("- Platform:", process.platform);
console.log(`Parsed PORT: ${PORT} (from env: ${process.env.PORT})`);
console.log(`Attempting to listen on port ${PORT}...`);

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  console.log("Request from:", req.socket.remoteAddress);

  // Simple health check
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Static server is running",
        environment: process.env.NODE_ENV || "unknown",
        port: process.env.PORT || "unknown",
        request_url: req.url,
        remote_address: req.socket.remoteAddress,
      })
    );
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "not_found",
        message: "Endpoint not found",
        timestamp: new Date().toISOString(),
      })
    );
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Static server successfully listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Bound to all interfaces`);
  console.log(`Server address:`, server.address());
});

server.on("error", (error) => {
  console.error("❌ Failed to start static server:", error);
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
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    process.exit(0);
  });
});
