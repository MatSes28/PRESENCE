import { defineConfig } from "drizzle-kit";

const dialect =
  (process.env.DATABASE_DIALECT as
    | "postgresql"
    | "mysql"
    | "sqlite"
    | "turso"
    | "singlestore"
    | "gel") || "sqlite";

const config = {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: dialect,
  dbCredentials: {
    url: process.env.DATABASE_URL || "./presence.db",
  },
};

export default defineConfig(config);
