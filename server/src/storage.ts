import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection with optimized pooling for production
const isProduction = process.env.NODE_ENV === "production";
const client = postgres(connectionString, {
  prepare: false,
  max: isProduction ? 20 : 10, // Higher connection pool in production
  idle_timeout: isProduction ? 30 : 20, // Longer idle timeout in production
  connect_timeout: 10, // Connection timeout in seconds
  onnotice: () => {}, // Ignore notices
  // Additional production optimizations
  ...(isProduction && {
    keep_alive: 60 * 1000, // Keep connections alive for 1 minute
    connection: {
      application_name: "clirdec_presence_api",
    },
  }),
});

// Create the database instance
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
