const express = require("express");
const app = express();

console.log("🚀 Starting test server...");

app.get("/health", (req, res) => {
  console.log("Health check called");
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    message: "Test server is running",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
});
