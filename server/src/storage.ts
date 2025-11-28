import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Enhanced connection pooling configuration for production
const isProduction =
  process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

// Parse connection string to extract parameters
const url = new URL(connectionString);
const dbHost = url.hostname;
const dbPort = parseInt(url.port) || 5432;
const dbName = url.pathname.slice(1);
const dbUser = url.username;
const dbPassword = url.password;

// Advanced connection pooling configuration
const poolConfig = {
  host: dbHost,
  port: dbPort,
  database: dbName,
  username: dbUser,
  password: dbPassword,

  // Connection pool settings
  max: isProduction ? parseInt(process.env.DB_MAX_CONNECTIONS || "25") : 10,
  min: isProduction ? parseInt(process.env.DB_MIN_CONNECTIONS || "5") : 1,
  idle_timeout: isProduction ? 60000 : 20000, // 60s in prod, 20s in dev
  connect_timeout: 10000, // 10 seconds
  acquire_timeout: 60000, // 60 seconds

  // Connection validation and health checks
  keep_alive: isProduction ? 30000 : 0, // 30s keep-alive in production
  allow_exit_on_idle: !isProduction, // Allow exit in development

  // Performance optimizations
  prepare: true, // Enable prepared statements for better performance
  types: {}, // Use default type parsers

  // Connection retry and error handling
  retry_on_init_error: true,
  max_retries: 3,
  retry_delay: 1000,

  // Logging and debugging (only in development)
  debug: !isProduction
    ? (conn: any, query: string, params: any[]) => {
        if (process.env.DB_DEBUG === "true") {
          console.log(`[DB Query] ${query}`, params);
        }
      }
    : undefined,

  // Connection event handlers
  onconnect: (conn: any) => {
    if (!isProduction) {
      console.log(`✅ Database connection established (PID: ${conn.pid})`);
    }
  },

  onclose: (conn: any) => {
    if (!isProduction) {
      console.log(`❌ Database connection closed (PID: ${conn.pid})`);
    }
  },

  onerror: (err: Error, conn: any) => {
    console.error(
      `🚨 Database connection error (PID: ${conn?.pid}):`,
      err.message
    );
  },

  onnotice: (notice: any) => {
    // Log notices only in development or for important messages
    if (
      !isProduction ||
      notice.severity === "WARNING" ||
      notice.severity === "ERROR"
    ) {
      console.log(`📢 Database notice: ${notice.message}`);
    }
  },

  // Application identification
  connection: {
    application_name: `clirdec_presence_api_${isProduction ? "prod" : "dev"}`,
    timezone: "UTC",
  },

  // SSL configuration for production
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false, // Allow self-signed certificates (Railway)
      // Additional SSL options can be configured here
    },
  }),

  // Connection pool monitoring
  onpoolconnect: (client: any) => {
    if (process.env.DB_POOL_DEBUG === "true") {
      console.log(`🔗 Connection added to pool (total: ${client.totalCount})`);
    }
  },

  onpoolremove: (client: any) => {
    if (process.env.DB_POOL_DEBUG === "true") {
      console.log(
        `🔌 Connection removed from pool (total: ${client.totalCount})`
      );
    }
  },
};

// Create the connection with enhanced pooling
const client = postgres(connectionString, poolConfig);

// Create the database instance with enhanced error handling
export const db = drizzle(client, {
  schema,
  logger: !isProduction
    ? {
        logQuery: (query: string, params: unknown[]) => {
          if (process.env.DB_QUERY_LOG === "true") {
            console.log(`🔍 Query: ${query}`, params);
          }
        },
      }
    : undefined,
});

// Export types
export type Database = typeof db;

// Export connection pool for monitoring
export { client as dbClient };
