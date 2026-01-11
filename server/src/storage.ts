import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { drizzle as drizzleBetterSqlite3 } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";

// Check if using SQLite for local development
const useSqlite =
  process.env.USE_SQLITE === "true" ||
  process.env.NODE_ENV === "development" ||
  !process.env.DATABASE_URL?.startsWith("postgres");

let db: any;
let dbClient: any;

if (useSqlite) {
  // SQLite configuration for local development
  const sqlitePath = process.env.SQLITE_PATH || "./presence.db";
  console.log(`📦 Using SQLite database at: ${sqlitePath}`);

  const sqlite = new Database(sqlitePath);

  // Enable WAL mode for better performance
  sqlite.pragma("journal_mode = WAL");

  db = drizzleBetterSqlite3(sqlite, { schema });
  dbClient = sqlite;

  console.log("✅ SQLite database connection established");
} else {
  // PostgreSQL configuration for production
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required for PostgreSQL"
    );
  }

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

    max: isProduction ? parseInt(process.env.DB_MAX_CONNECTIONS || "25") : 10,
    min: isProduction ? parseInt(process.env.DB_MIN_CONNECTIONS || "5") : 1,
    idle_timeout: isProduction ? 60000 : 20000,
    connect_timeout: 10000,
    acquire_timeout: 60000,

    keep_alive: isProduction ? 30000 : 0,
    allow_exit_on_idle: !isProduction,

    prepare: true,
    types: {},

    retry_on_init_error: true,
    max_retries: 3,
    retry_delay: 1000,

    debug: !isProduction
      ? (conn: any, query: string, params: any[]) => {
          if (process.env.DB_DEBUG === "true") {
            console.log(`[DB Query] ${query}`, params);
          }
        }
      : undefined,

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
      if (
        !isProduction ||
        notice.severity === "WARNING" ||
        notice.severity === "ERROR"
      ) {
        console.log(`📢 Database notice: ${notice.message}`);
      }
    },

    connection: {
      application_name: `clirdec_presence_api_${isProduction ? "prod" : "dev"}`,
      timezone: "UTC",
    },

    ...(isProduction && {
      ssl: {
        rejectUnauthorized: false,
      },
    }),

    onpoolconnect: (client: any) => {
      if (process.env.DB_POOL_DEBUG === "true") {
        console.log(
          `🔗 Connection added to pool (total: ${client.totalCount})`
        );
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

  const client = postgres(connectionString, poolConfig);

  db = drizzle(client, {
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

  dbClient = client;
  console.log("✅ PostgreSQL database connection established");
}

// Export db as default
export default db;

// Export connection pool/client for monitoring
export { dbClient };
