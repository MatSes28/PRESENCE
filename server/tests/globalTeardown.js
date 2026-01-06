const { db } = require("../src/storage");

module.exports = async function globalTeardown() {
  try {
    // Close database connections
    await db.$client.end();
    console.log("✅ Test database connections closed");
  } catch (error) {
    console.error("❌ Error during test teardown:", error);
  }
};
