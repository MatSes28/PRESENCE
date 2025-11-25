const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

console.log("🚀 Starting Railway-compatible Express server...");
console.log("Environment variables:");
console.log("- PORT:", process.env.PORT);
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("- Current working directory:", process.cwd());
console.log("- Node version:", process.version);
console.log("- Platform:", process.platform);

// Railway-specific logging
if (process.env.RAILWAY_ENVIRONMENT) {
  console.log("🌐 Running on Railway");
  console.log("- RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT);
  console.log("- RAILWAY_PROJECT_ID:", process.env.RAILWAY_PROJECT_ID);
}

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Railway-compatible server is running",
    environment: process.env.NODE_ENV || "unknown",
    port: PORT,
    railway_env: process.env.RAILWAY_ENVIRONMENT || "not_railway",
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "CLIRDEC:PRESENCE Railway server is running",
    environment: process.env.NODE_ENV || "unknown",
    port: PORT,
    railway_env: process.env.RAILWAY_ENVIRONMENT || "not_railway",
    uptime: process.uptime(),
  });
});

// Catch all handler
app.use("*", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "CLIRDEC:PRESENCE server endpoint",
    method: req.method,
    path: req.path,
    environment: process.env.NODE_ENV || "unknown",
    port: PORT,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Railway server successfully listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Bound to all interfaces`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});
