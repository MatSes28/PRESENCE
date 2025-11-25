import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "⚠️ DATABASE_URL environment variable not set - database operations will fail"
  );
}

// Create the connection with better error handling (lazy connection)
let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getClient() {
  if (!client) {
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    try {
      client = postgres(connectionString, {
        prepare: false,
        max: 10, // Maximum number of connections
        idle_timeout: 20, // Close idle connections after 20 seconds
        connect_timeout: 10, // Connection timeout in seconds
        onnotice: () => {}, // Ignore notices
      });
    } catch (error) {
      console.error("Failed to create database client:", error);
      throw error;
    }
  }
  return client;
}

function getDb() {
  if (!dbInstance) {
    const client = getClient();
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

// Export the database instance with lazy initialization
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    const db = getDb();
    return db[prop as keyof typeof db];
  },
});

// Export types
export type Database = typeof db;
