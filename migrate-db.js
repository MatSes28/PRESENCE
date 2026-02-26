import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

async function runMigrations() {
  console.log("🔄 Running database migrations...");

  // Parse connection string for SSL config
  const url = new URL(connectionString);
  const dbHost = url.hostname;
  const dbPort = parseInt(url.port) || 5432;
  const dbName = url.pathname.slice(1);
  const dbUser = url.username;
  const dbPassword = url.password;

  // SSL config for Railway
  const isProduction =
    process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;
  const sslConfig = isProduction ? { rejectUnauthorized: false } : undefined;

  const client = postgres({
    host: dbHost,
    port: dbPort,
    database: dbName,
    username: dbUser,
    password: dbPassword,
    ssl: sslConfig,
    prepare: false,
  });

  const db = drizzle(client);

  try {
    // Run migrations
    await migrate(db, { migrationsFolder: "./server/drizzle" });
    console.log("✅ Database migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
