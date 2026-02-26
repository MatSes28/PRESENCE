import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { drizzle as drizzleBetterSqlite3 } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
// Use the shared Drizzle schema for DB access.
// This avoids duplicated schema modules and simplifies Jest/ts-jest resolution.
import * as schema from "../../shared/schema.js";

// Check if using SQLite for local development
// Default behavior:
// - dev: SQLite unless explicitly configured otherwise
// - test: follow DATABASE_URL; CI provides Postgres
// - prod-like: Postgres (DATABASE_URL must be present)
const isTestEnv =
  process.env.NODE_ENV === "test" ||
  typeof process.env.JEST_WORKER_ID !== "undefined";

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

  // Compatibility: some schemas/defaults (and generated queries) assume Postgres-style helpers.
  // Provide a minimal `now()` function so SQLite DEFAULT now() works in local/test databases.
  // Returns an ISO timestamp string.
  sqlite.function("now", () => new Date().toISOString());

  // Enable WAL mode for better performance
  sqlite.pragma("journal_mode = WAL");

  // NOTE: The SQLite DB uses the same logical schema as the app's Drizzle schema.
  // Keep the schema mapping consistent so route code can run unchanged.
  db = drizzleBetterSqlite3(sqlite, { schema });
  dbClient = sqlite;

  console.log("✅ SQLite database connection established");
} else {
  // PostgreSQL configuration for production
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is required for PostgreSQL",
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
      if (!isProduction && !isTestEnv) {
        console.log(`✅ Database connection established (PID: ${conn.pid})`);
      }
    },

    onclose: (conn: any) => {
      if (!isProduction && !isTestEnv) {
        console.log(`❌ Database connection closed (PID: ${conn.pid})`);
      }
    },

    onerror: (err: Error, conn: any) => {
      console.error(
        `🚨 Database connection error (PID: ${conn?.pid}):`,
        err.message,
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
          `🔗 Connection added to pool (total: ${client.totalCount})`,
        );
      }
    },

    onpoolremove: (client: any) => {
      if (process.env.DB_POOL_DEBUG === "true") {
        console.log(
          `🔌 Connection removed from pool (total: ${client.totalCount})`,
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

// Safe database execute wrapper to handle errors gracefully
export async function safeExecute(
  query: any,
  params: any[] = [],
): Promise<any> {
  try {
    // Use dbClient for raw SQL execution
    // Check if we're using SQLite by checking the dbClient type
    if (dbClient.prepare && dbClient.exec) {
      // For SQLite, use the raw database connection
      if (params.length > 0) {
        return await dbClient.prepare(query).run(params);
      } else {
        return await dbClient.exec(query);
      }
    } else {
      // For PostgreSQL, use the client directly
      if (typeof dbClient.query === "function") {
        return await dbClient.query(query, params);
      } else {
        // Fallback for PostgreSQL client that doesn't have query method
        const result = await dbClient.unsafe(query, params);
        return result;
      }
    }
  } catch (error) {
    console.error("Database execution error:", error);
    throw new Error("Database operation failed");
  }
}

// Add db.execute method for compatibility with existing code
export function addExecuteMethod() {
  if (!db.execute) {
    db.execute = async function (sqlQuery: any) {
      try {
        // Check if we're using SQLite
        if (dbClient.prepare && dbClient.exec) {
          // For SQLite, use prepare/run for queries that return results
          // or exec for queries that don't
          let queryString;
          if (typeof sqlQuery === "object" && sqlQuery.sql) {
            // Handle drizzle SQL object
            queryString = sqlQuery.sql;
          } else if (typeof sqlQuery === "string") {
            queryString = sqlQuery;
          } else {
            queryString = sqlQuery.toString();
          }

          if (queryString.toLowerCase().startsWith("select")) {
            return dbClient.prepare(queryString).all();
          } else {
            return dbClient.exec(queryString);
          }
        } else {
          // For PostgreSQL, use the existing safeExecute
          return safeExecute(sqlQuery);
        }
      } catch (error) {
        console.error("db.execute error:", error);
        throw error;
      }
    };
  }
}
