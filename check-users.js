import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { users } from "./shared/schema.js";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:ivXwpKRBFPqDEzhjzMlfQOpBXZorhyTy@mainline.proxy.rlwy.net:22250/railway";

async function checkUsers() {
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema: { users } });

  try {
    console.log("Checking users...");

    const allUsers = await db.select().from(users);

    console.log("Users in database:");
    allUsers.forEach((user) => {
      console.log(`- ${user.email} (${user.role})`);
    });

    if (allUsers.length === 0) {
      console.log("No users found!");
    }
  } catch (error) {
    console.error("Error checking users:", error);
  } finally {
    await client.end();
  }
}

checkUsers();
