// Script to fix all database issues for Railway PostgreSQL
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

async function fixDatabase() {
  console.log("🔌 Connecting to Railway PostgreSQL...");

  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // 1. Check and create session table
    console.log("\n📋 Checking 'session' table...");
    const sessionTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'session'
      ) as exists
    `;

    if (!sessionTableExists[0].exists) {
      console.log("➕ Creating 'session' table...");
      await sql`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          PRIMARY KEY ("sid")
        )
      `;
      console.log("✅ Created 'session' table");

      await sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`;
      console.log("✅ Created index");
    } else {
      console.log("✅ 'session' table already exists");
    }

    // 2. Check current error_logs structure
    console.log("\n📋 Checking error_logs columns...");
    const errorLogsColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'error_logs'
    `;

    const columnNames = errorLogsColumns.map((c) => c.column_name);
    console.log("Current columns:", columnNames.join(", "));

    // Add missing columns to error_logs
    if (!columnNames.includes("message")) {
      console.log("➕ Adding message column...");
      await sql`ALTER TABLE error_logs ADD COLUMN message TEXT NOT NULL DEFAULT ''`;
    }

    if (!columnNames.includes("stack")) {
      console.log("➕ Adding stack column...");
      await sql`ALTER TABLE error_logs ADD COLUMN stack TEXT`;
    }

    if (!columnNames.includes("level")) {
      console.log("➕ Adding level column...");
      await sql`ALTER TABLE error_logs ADD COLUMN level VARCHAR(20) NOT NULL DEFAULT 'error'`;
    }

    if (!columnNames.includes("category")) {
      console.log("➕ Adding category column...");
      await sql`ALTER TABLE error_logs ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'system'`;
    }

    console.log("✅ error_logs table updated");

    // 3. Verify audit_logs table structure
    console.log("\n📋 Checking audit_logs columns...");
    const auditLogsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
    `;

    const auditCols = auditLogsColumns.map((c) => c.column_name);
    console.log("audit_logs columns:", auditCols.join(", "));

    if (!auditCols.includes("timestamp")) {
      console.log("➕ Adding timestamp column to audit_logs...");
      try {
        await sql`ALTER TABLE audit_logs ADD COLUMN timestamp TIMESTAMP DEFAULT NOW()`;
      } catch (e) {
        console.log("Note:", e.message);
      }
    }

    console.log("\n✅ All database fixes applied!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

fixDatabase();
