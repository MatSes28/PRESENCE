import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users } from "./shared/schema.js";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:ivXwpKRBFPqDEzhjzMlfQOpBXZorhyTy@mainline.proxy.rlwy.net:22250/railway";

async function createAdmin() {
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema: { users } });

  try {
    console.log("🔄 Creating admin user...");

    // Hash the password "admin123"
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash("admin123", saltRounds);

    // Create admin user
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
      console.log("Email: admin@clsu.edu.ph");
      console.log("Password: admin123");
      console.log("Role: admin");
    } else {
      console.log("❌ Failed to create admin user");
    }
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await client.end();
  }
}

createAdmin();
