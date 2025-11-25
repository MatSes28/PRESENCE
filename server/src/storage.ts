import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:ivXwpKRBFPqDEzhjzMlfQOpBXZorhyTy@mainline.proxy.rlwy.net:22250/railway";

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection with better error handling
const client = postgres(connectionString, {
  prepare: false,
  max: 10, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  onnotice: () => {}, // Ignore notices
});

// Create the database instance
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
