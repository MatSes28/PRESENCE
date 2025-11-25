const http = require("http");

const PORT = parseInt(process.env.PORT || "3000", 10);

console.log("🔥 Simple Railway server script starting...");
console.log("🚀 Starting simple Railway-compatible HTTP server...");
console.log("Environment variables:");
console.log("- PORT:", process.env.PORT);
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");

// Railway-specific logging
if (process.env.RAILWAY_ENVIRONMENT) {
  console.log("🌐 Running on Railway");
  console.log("- RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT);
  console.log("- RAILWAY_PROJECT_ID:", process.env.RAILWAY_PROJECT_ID);
}

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Health check endpoint
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Simple Railway server is running",
        environment: process.env.NODE_ENV || "unknown",
        port: PORT,
        railway_env: process.env.RAILWAY_ENVIRONMENT || "not_railway",
        uptime: process.uptime(),
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

server.listen(PORT, "0.0.0.0", (err) => {
  if (err) {
    console.error("❌ Failed to start simple Railway server:", err);
    process.exit(1);
  }
  console.log(
    `🚀 Simple Railway server successfully listening on port ${PORT}`
  );
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Bound to all interfaces`);
  console.log(`Server address:`, server.address());
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => process.exit(0));
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
