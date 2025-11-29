import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users } from "./shared/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const connectionString = process.env.DATABASE_URL;

async function resetPasswords() {
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema: { users } });

  try {
    console.log("🔄 Resetting user passwords...");

    // Hash new passwords - use environment variables or generate random
    const saltRounds = 12;
    const adminPlainPassword =
      process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
    const facultyPlainPassword =
      process.env.FACULTY_PASSWORD || crypto.randomBytes(16).toString("hex");
    const adminPassword = await bcrypt.hash(adminPlainPassword, saltRounds);
    const facultyPassword = await bcrypt.hash(facultyPlainPassword, saltRounds);

    // Update admin password
    const adminResult = await db
      .update(users)
      .set({ password: adminPassword })
      .where(eq(users.email, "admin@clsu.edu.ph"))
      .returning();

    if (adminResult.length > 0) {
      console.log("✅ Admin password reset successfully");
    } else {
      console.log("❌ Admin user not found");
    }

    // Check if faculty user exists
    const existingFaculty = await db
      .select()
      .from(users)
      .where(eq(users.email, "faculty@clsu.edu.ph"))
      .limit(1);

    if (existingFaculty.length > 0) {
      // Update existing faculty password
      await db
        .update(users)
        .set({ password: facultyPassword })
        .where(eq(users.email, "faculty@clsu.edu.ph"));
      console.log("✅ Faculty password reset successfully");
    } else {
      // Create new faculty user
      const newFaculty = await db
        .insert(users)
        .values({
          email: "faculty@clsu.edu.ph",
          password: facultyPassword,
          name: "Faculty Member",
          role: "faculty",
        })
        .returning();

      if (newFaculty.length > 0) {
        console.log("✅ Faculty user created successfully");
      }
    }

    console.log("\n🎉 Password reset complete!");
    console.log(`Admin: admin@clsu.edu.ph / ${adminPlainPassword}`);
    console.log(`Faculty: faculty@clsu.edu.ph / ${facultyPlainPassword}`);
  } catch (error) {
    console.error("❌ Error resetting passwords:", error);
  } finally {
    await client.end();
  }
}

resetPasswords();
