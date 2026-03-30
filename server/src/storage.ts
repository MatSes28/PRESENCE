import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { drizzle as drizzleBetterSqlite3 } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import type { Statement } from "better-sqlite3";
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

  const normalizeSqliteParam = (value: unknown): unknown => {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  };

  const normalizeSqliteParams = (params: unknown[]) =>
    params.map((param) => normalizeSqliteParam(param));

  const originalPrepare = sqlite.prepare.bind(sqlite);
  sqlite.prepare = ((sql: string) => {
    const statement = originalPrepare(sql);
    const originalRun = statement.run.bind(statement);
    const originalGet = statement.get.bind(statement);
    const originalAll = statement.all.bind(statement);
    const originalIterate = statement.iterate.bind(statement);

    statement.run = ((...params: unknown[]) =>
      originalRun(...normalizeSqliteParams(params))) as typeof statement.run;
    statement.get = ((...params: unknown[]) =>
      originalGet(...normalizeSqliteParams(params))) as typeof statement.get;
    statement.all = ((...params: unknown[]) =>
      originalAll(...normalizeSqliteParams(params))) as typeof statement.all;
    statement.iterate = ((...params: unknown[]) =>
      originalIterate(
        ...normalizeSqliteParams(params),
      )) as typeof statement.iterate;

    return statement;
  }) as typeof sqlite.prepare;

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

type SqliteCompiledQuery = { text: string; params: unknown[] };

function isSqliteClient(client: any): client is Database.Database {
  return (
    !!client &&
    typeof client.prepare === "function" &&
    typeof client.exec === "function"
  );
}

function compileDrizzleSqlForSqlite(input: any): SqliteCompiledQuery {
  // Supported inputs:
  // - string
  // - drizzle `sql\`...\`` SQL object (has queryChunks)
  // - nested SQL objects inside queryChunks

  if (typeof input === "string") return { text: input, params: [] };

  // Drizzle SQL object (drizzle-orm v0.3x): { queryChunks: (StringChunk | value | SQL)[] }
  if (input && typeof input === "object" && Array.isArray(input.queryChunks)) {
    let text = "";
    const params: unknown[] = [];

    for (const chunk of input.queryChunks) {
      // StringChunk
      if (chunk && typeof chunk === "object" && "value" in chunk) {
        const v: any = (chunk as any).value;
        if (Array.isArray(v)) {
          text += v.join("");
        } else if (typeof v === "string") {
          text += v;
        } else {
          text += String(v);
        }
        continue;
      }

      // Nested SQL
      if (
        chunk &&
        typeof chunk === "object" &&
        Array.isArray((chunk as any).queryChunks)
      ) {
        const nested = compileDrizzleSqlForSqlite(chunk);
        text += nested.text;
        params.push(...nested.params);
        continue;
      }

      // Parameter value
      text += "?";
      params.push(chunk);
    }

    return { text, params };
  }

  // Anything else: best-effort string coercion
  return { text: String(input), params: [] };
}

function sqliteIsSelectLike(sqlText: string): boolean {
  const trimmed = sqlText.trimStart().toLowerCase();
  return (
    trimmed.startsWith("select") ||
    trimmed.startsWith("with") ||
    trimmed.startsWith("pragma") ||
    trimmed.startsWith("explain")
  );
}

// Safe database execute wrapper to handle errors gracefully
export async function safeExecute(
  query: any,
  params: any[] = [],
): Promise<any> {
  try {
    // Use dbClient for raw SQL execution
    // Check if we're using SQLite by checking the dbClient type
    if (isSqliteClient(dbClient)) {
      // For SQLite, use the raw database connection
      const stmt = dbClient.prepare(String(query));
      if (sqliteIsSelectLike(String(query))) {
        return params.length > 0 ? stmt.all(...params) : stmt.all();
      }
      return params.length > 0 ? stmt.run(...params) : stmt.run();
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
        if (isSqliteClient(dbClient)) {
          const compiled = compileDrizzleSqlForSqlite(sqlQuery);
          const stmt: Statement = dbClient.prepare(compiled.text);
          if (sqliteIsSelectLike(compiled.text)) {
            return compiled.params.length > 0
              ? stmt.all(...compiled.params)
              : stmt.all();
          }
          return compiled.params.length > 0
            ? stmt.run(...compiled.params)
            : stmt.run();
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
