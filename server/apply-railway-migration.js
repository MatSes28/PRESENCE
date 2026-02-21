// Script to check and create session tables in Railway PostgreSQL
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

async function checkAndCreateSessionTable() {
  console.log("🔌 Connecting to Railway PostgreSQL...");

  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // Check what tables exist
    console.log("\n📋 Checking existing tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    console.log("Existing tables:", tables.map((t) => t.table_name).join(", "));

    // Check if 'session' table exists
    const sessionTableExists = tables.some((t) => t.table_name === "session");

    if (!sessionTableExists) {
      console.log("\n➕ Creating 'session' table for connect-pg-simple...");

      await sql`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          PRIMARY KEY ("sid")
        )
      `;
      console.log("✅ Created 'session' table");

      // Create index
      await sql`
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
      `;
      console.log("✅ Created index on expire");
    } else {
      console.log("✅ 'session' table already exists");
    }

    // Check user_sessions table columns
    console.log("\n📋 Checking user_sessions columns...");
    const userSessionsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions'
    `;

    const columnNames = userSessionsColumns.map((c) => c.column_name);
    console.log("user_sessions columns:", columnNames.join(", "));

    // Add missing columns to user_sessions if needed
    if (!columnNames.includes("user_id")) {
      console.log("➕ Adding user_id column to user_sessions...");
      await sql`ALTER TABLE user_sessions ADD COLUMN user_id INTEGER`;
      console.log("✅ Added user_id column");
    }

    if (!columnNames.includes("is_active")) {
      console.log("➕ Adding is_active column to user_sessions...");
      await sql`ALTER TABLE user_sessions ADD COLUMN is_active BOOLEAN DEFAULT true`;
      console.log("✅ Added is_active column");
    }

    // Enable pg_stat_statements extension
    console.log("\n➕ Enabling pg_stat_statements extension...");
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
      console.log("✅ pg_stat_statements enabled");
    } catch (e) {
      console.log("⚠️  pg_stat_statements:", e.message);
    }

    // Check error_logs table
    console.log("\n📋 Checking error_logs columns...");
    const errorLogsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'error_logs'
    `;

    const errorLogCols = errorLogsColumns.map((c) => c.column_name);
    console.log("error_logs columns:", errorLogCols.join(", "));

    // Add level column if missing
    if (!errorLogCols.includes("level")) {
      console.log("➕ Adding level column to error_logs...");
      await sql`ALTER TABLE error_logs ADD COLUMN level varchar(20) NOT NULL DEFAULT 'error'`;
      console.log("✅ Added level column");
    }

    console.log("\n✅ Migration verification completed!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

checkAndCreateSessionTable();
