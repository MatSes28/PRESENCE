// Migration script to fix Railway PostgreSQL database schema issues
// Fixes: user_sessions missing connect-pg-simple columns
// Fixes: error_logs table missing 'session_id' column

import postgres from "postgres";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function runMigrations() {
  console.log("Starting database migrations...\n");

  try {
    // 1. Check and align user_sessions for connect-pg-simple
    console.log("Checking user_sessions table...");

    // Check if user_sessions table exists
    const sessionTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_sessions'
      ) as exists;
    `;

    if (!sessionTableExists[0].exists) {
      throw new Error("user_sessions table is missing");
    } else {
      console.log("user_sessions table exists, checking columns...");

      const sidColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'user_sessions'
          AND column_name = 'sid'
        ) as exists;
      `;

      if (!sidColumnExists[0].exists) {
        console.log("Adding sid column to user_sessions table...");
        await sql`
          ALTER TABLE "user_sessions" ADD COLUMN "sid" varchar;
        `;
        console.log("✓ Added sid column to user_sessions table");
      } else {
        console.log("✓ sid column already exists in user_sessions table");
      }

      const sessColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'user_sessions'
          AND column_name = 'sess'
        ) as exists;
      `;

      if (!sessColumnExists[0].exists) {
        console.log("Adding sess column to user_sessions table...");
        await sql`
          ALTER TABLE "user_sessions" ADD COLUMN "sess" json;
        `;
        console.log("✓ Added sess column to user_sessions table");
      } else {
        console.log("✓ sess column already exists in user_sessions table");
      }

      const expireColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'user_sessions'
          AND column_name = 'expire'
        ) as exists;
      `;

      if (!expireColumnExists[0].exists) {
        console.log("Adding expire column to user_sessions table...");
        await sql`
          ALTER TABLE "user_sessions" ADD COLUMN "expire" timestamp(6);
        `;
        console.log("✓ Added expire column to user_sessions table");
      } else {
        console.log("✓ expire column already exists in user_sessions table");
      }

      await sql`
        CREATE INDEX IF NOT EXISTS "user_sessions_expire_idx" ON "user_sessions" ("expire");
      `;
      console.log("✓ Ensured index on user_sessions.expire");
    }

    // 2. Fix error_logs table - add session_id column
    console.log("\nChecking error_logs table...");

    const errorLogsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'error_logs'
      ) as exists;
    `;

    if (errorLogsTableExists[0].exists) {
      // Check if session_id column exists
      const sessionIdColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'error_logs'
          AND column_name = 'session_id'
        ) as exists;
      `;

      if (!sessionIdColumnExists[0].exists) {
        console.log("Adding session_id column to error_logs table...");
        await sql`
          ALTER TABLE "error_logs" ADD COLUMN "session_id" varchar;
        `;
        console.log("✓ Added session_id column to error_logs table");
      } else {
        console.log("✓ session_id column already exists in error_logs table");
      }
    }

    console.log("\n✅ All migrations completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

runMigrations();
