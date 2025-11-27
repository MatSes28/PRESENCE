import { db } from "../src/storage.js";

export default async function globalTeardown() {
  try {
    // Close database connections
    await db.$client.end();
    console.log("✅ Test database connections closed");
  } catch (error) {
    console.error("❌ Error during test teardown:", error);
  }
}
