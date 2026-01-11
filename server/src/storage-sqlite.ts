import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";
import * as path from "path";
import * as fs from "fs";

// Determine database path - use SQLite for local development
const dbPath =
  process.env.SQLITE_DB_PATH || path.join(process.cwd(), "presence.db");

// Ensure the database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create the SQLite database connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma("journal_mode = WAL");

// Enable foreign keys
sqlite.pragma("foreign_keys = ON");

// Configure busy timeout for concurrent access
sqlite.pragma("busy_timeout = 30000");

// Create the drizzle database instance
export const db = drizzle(sqlite, {
  schema,
  logger: process.env.DB_QUERY_LOG === "true",
});

// Export types
export type Database = typeof db;

// Export the SQLite instance for direct queries if needed
export { sqlite };

// Log the database location
console.log(`📦 SQLite database initialized at: ${dbPath}`);
