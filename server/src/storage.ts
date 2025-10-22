import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:ivXwpKRBFPqDEzhjzMlfQOpBXZorhyTy@mainline.proxy.rlwy.net:22250/railway";

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the connection
const client = postgres(connectionString, { prepare: false });

// Create the database instance
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
