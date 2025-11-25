const express = require("express");
const app = express();

console.log("🚀 Starting minimal CLIRDEC:PRESENCE server...");

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("Health check received at", new Date().toISOString());
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Minimal server is running",
    environment: process.env.NODE_ENV || "unknown",
    port: process.env.PORT || "unknown",
  });
});

// Catch-all for SPA
app.get("*", (req, res) => {
  res.json({
    message: "CLIRDEC:PRESENCE API",
    status: "running",
    timestamp: new Date().toISOString(),
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

const PORT = parseInt(process.env.PORT || "3000", 10);

app
  .listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Minimal server listening on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🌍 Bound to all interfaces`);
  })
  .on("error", (error) => {
    console.error("❌ Failed to start minimal server:", error);
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
