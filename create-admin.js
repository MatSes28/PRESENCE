import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { users } from "./shared/schema.js";
import crypto from "crypto";

function generateRandomPassword() {
  return crypto.randomBytes(16).toString("hex");
}

const connectionString = process.env.DATABASE_URL;

async function createAdmin() {
  // Parse connection string to extract parameters
  const url = new URL(connectionString);
  const dbHost = url.hostname;
  const dbPort = parseInt(url.port) || 5432;
  const dbName = url.pathname.slice(1);
  const dbUser = url.username;
  const dbPassword = url.password;

  // SSL configuration for production (Railway)
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
    console.log("🔄 Setting up admin user...");

    // Get admin password from environment or generate random one
    const adminPassword =
      process.env.ADMIN_PASSWORD || generateRandomPassword();
    console.log(`Using admin password: ${adminPassword}`);

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@clsu.edu.ph"))
      .limit(1);

    if (existingAdmin.length > 0) {
      // Update existing admin user
      await db
        .update(users)
        .set({
          password: hashedPassword,
          name: "System Administrator",
          role: "admin",
          is_active: true,
        })
        .where(eq(users.email, "admin@clsu.edu.ph"));

      console.log("✅ Admin user updated successfully!");
    } else {
      // Create new admin user
      const newAdmin = await db
        .insert(users)
        .values({
          email: "admin@clsu.edu.ph",
          password: hashedPassword,
          name: "System Administrator",
          role: "admin",
        })
        .returning();

      if (newAdmin.length > 0) {
        console.log("✅ Admin user created successfully!");
      } else {
        console.log("❌ Failed to create admin user");
        return;
      }
    }

    console.log("Email: admin@clsu.edu.ph");
    console.log(`Password: ${adminPassword}`);
    console.log("Role: admin");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await client.end();
  }
}

createAdmin();
