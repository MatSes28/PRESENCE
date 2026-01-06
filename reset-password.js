import bcrypt from "bcryptjs";
import { db } from "./server/src/storage.js";
import { users } from "./server/src/schema.js";
import { eq } from "drizzle-orm";

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log("Usage: node reset-password.js <email> <newPassword>");
  process.exit(1);
}

async function resetPassword() {
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.email, email));

    console.log(`Password reset for ${email}`);
  } catch (error) {
    console.error("Error resetting password:", error);
  }
}

resetPassword();
