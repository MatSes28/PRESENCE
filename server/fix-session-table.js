// Migration script to fix Railway PostgreSQL database schema issues
// Fixes: session table missing 'sess' column for connect-pg-simple
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
    // 1. Check and create/fix session table for connect-pg-simple
    console.log("Checking session table...");

    // Check if session table exists
    const sessionTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'session'
      ) as exists;
    `;

    if (!sessionTableExists[0].exists) {
      console.log("Creating session table...");
      await sql`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          PRIMARY KEY ("sid")
        );
      `;
      console.log("✓ Created session table");

      // Create index on expire
      await sql`
        CREATE INDEX "IDX_session_expire" ON "session" ("expire");
      `;
      console.log("✓ Created index on session.expire");
    } else {
      console.log("Session table exists, checking columns...");

      // Check if 'sess' column exists
      const sessColumnExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'session'
          AND column_name = 'sess'
        ) as exists;
      `;

      if (!sessColumnExists[0].exists) {
        console.log("Adding sess column to session table...");
        await sql`
          ALTER TABLE "session" ADD COLUMN "sess" json NOT NULL DEFAULT '{}';
        `;
        console.log("✓ Added sess column to session table");
      } else {
        console.log("✓ sess column already exists in session table");
      }
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
