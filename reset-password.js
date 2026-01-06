import bcrypt from "bcryptjs";
import { db } from "./server/src/storage.js";
import { users } from "./server/src/schema.js";
import { eq } from "drizzle-orm";

const resets = [
  { email: "mattferia777@gmail.com", password: "Matt@123" },
  { email: "admin@clsu.edu.ph", password: "admin123" },
  { email: "faculty@clsu.edu.ph", password: "faculty132" },
];

async function resetPasswords() {
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");

    for (const { email, password } of resets) {
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email));

      console.log(`Password reset for ${email}`);
    }

    console.log("All passwords reset successfully");
  } catch (error) {
    console.error("Error resetting passwords:", error);
  } finally {
    process.exit(0);
  }
}

resetPasswords();
