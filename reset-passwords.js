import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users } from "./shared/schema.js";
import { eq } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:ivXwpKRBFPqDEzhjzMlfQOpBXZorhyTy@mainline.proxy.rlwy.net:22250/railway";

async function resetPasswords() {
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema: { users } });

  try {
    console.log("🔄 Resetting user passwords...");

    // Hash new passwords
    const saltRounds = 12;
    const adminPassword = await bcrypt.hash("admin123", saltRounds);
    const facultyPassword = await bcrypt.hash("faculty123", saltRounds);

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
    console.log("Admin: admin@clsu.edu.ph / admin123");
    console.log("Faculty: faculty@clsu.edu.ph / faculty123");
  } catch (error) {
    console.error("❌ Error resetting passwords:", error);
  } finally {
    await client.end();
  }
}

resetPasswords();
