import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import { users } from "./shared/schema.js";

const connectionString = process.env.DATABASE_URL;

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

    // Verify admin user exists
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@clsu.edu.ph"))
      .limit(1);

    if (adminUser.length === 0) {
      console.log("⚠️  Admin user not found, creating...");
      // This should have been created on startup, but let's ensure it exists
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash("admin123", 12);

      await db.insert(users).values({
        email: "admin@clsu.edu.ph",
        password: hashedPassword,
        name: "System Administrator",
        role: "admin",
        isActive: true,
      });
      console.log("✅ Admin user created");
    } else {
      console.log("✅ Admin user exists");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
