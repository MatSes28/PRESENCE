import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { users } from "./shared/schema.js";
import crypto from "crypto";

const connectionString = process.env.DATABASE_URL;

async function fixAdminPassword() {
  // Parse connection string
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

  const db = drizzle(client, { schema: { users } });

  try {
    console.log("🔄 Fixing admin password...");

    // Hash the password - use environment variable or generate random
    const saltRounds = 12;
    const adminPlainPassword =
      process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(adminPlainPassword, saltRounds);

    // Update admin user password
    const result = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, "admin@clsu.edu.ph"))
      .returning();

    if (result.length > 0) {
      console.log("✅ Admin password updated successfully!");
      console.log("Email: admin@clsu.edu.ph");
      console.log(`Password: ${adminPlainPassword}`);
    } else {
      console.log("❌ Admin user not found");
    }
  } catch (error) {
    console.error("❌ Error updating admin password:", error);
  } finally {
    await client.end();
  }
}

fixAdminPassword();
