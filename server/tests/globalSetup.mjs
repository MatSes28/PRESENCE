import { db } from "../src/storage.js";
import { sql } from "drizzle-orm";

export default async function globalSetup() {
  try {
    // Ensure test database is available
    await db.execute(sql`SELECT 1`);

    // Create test schema if needed
    console.log("✅ Test database connection established");

    // You could create test-specific tables or data here
    // For now, we'll rely on the existing schema
  } catch (error) {
    console.error("❌ Failed to setup test database:", error);
    throw error;
  }
}
