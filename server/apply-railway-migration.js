// Script to fix all database issues for Railway PostgreSQL.
//
// SECURITY:
// - Never embed credentials.
// - Require DATABASE_URL explicitly.
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

async function fixDatabase() {
  console.log("🔌 Connecting to Railway PostgreSQL...");

  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // 1. Check and align user_sessions for connect-pg-simple
    console.log("\n📋 Checking 'user_sessions' table...");
    const sessionTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_sessions'
      ) as exists
    `;

    if (!sessionTableExists[0].exists) {
      throw new Error("Missing user_sessions table");
    } else {
      console.log("✅ 'user_sessions' table already exists");

      // Check if connect-pg-simple columns exist
      const sessionColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_sessions'
      `;
      const sessionCols = sessionColumns.map((c) => c.column_name);
      console.log("user_sessions columns:", sessionCols.join(", "));

      if (!sessionCols.includes("sid")) {
        console.log("➕ Adding 'sid' column...");
        await sql`ALTER TABLE "user_sessions" ADD COLUMN "sid" varchar`;
      }

      if (!sessionCols.includes("sess")) {
        console.log("➕ Adding 'sess' column...");
        await sql`ALTER TABLE "user_sessions" ADD COLUMN "sess" json`;
      }

      if (!sessionCols.includes("expire")) {
        console.log("➕ Adding 'expire' column...");
        await sql`ALTER TABLE "user_sessions" ADD COLUMN "expire" timestamp(6)`;
      }

      await sql`CREATE INDEX IF NOT EXISTS "user_sessions_expire_idx" ON "user_sessions" ("expire")`;
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

    if (!columnNames.includes("endpoint")) {
      console.log("➕ Adding endpoint column...");
      await sql`ALTER TABLE error_logs ADD COLUMN endpoint VARCHAR(255)`;
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

    // Add missing columns to audit_logs
    if (!auditCols.includes("timestamp")) {
      console.log("➕ Adding timestamp column to audit_logs...");
      await sql`ALTER TABLE audit_logs ADD COLUMN timestamp TIMESTAMP DEFAULT NOW()`;
    }

    if (!auditCols.includes("resource")) {
      console.log("➕ Adding resource column to audit_logs...");
      await sql`ALTER TABLE audit_logs ADD COLUMN resource VARCHAR(100)`;
    }

    if (!auditCols.includes("resource_id")) {
      console.log("➕ Adding resource_id column to audit_logs...");
      await sql`ALTER TABLE audit_logs ADD COLUMN resource_id INTEGER`;
    }

    // 4. Verify user_sessions columns
    console.log("\n📋 Checking user_sessions columns...");
    const userSessionsColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions'
    `;

    const userSessCols = userSessionsColumns.map((c) => c.column_name);
    console.log("user_sessions columns:", userSessCols.join(", "));

    if (!userSessCols.includes("user_id")) {
      console.log("➕ Adding user_id column...");
      await sql`ALTER TABLE user_sessions ADD COLUMN user_id INTEGER REFERENCES users(id)`;
    }

    if (!userSessCols.includes("is_active")) {
      console.log("➕ Adding is_active column...");
      await sql`ALTER TABLE user_sessions ADD COLUMN is_active BOOLEAN DEFAULT true`;
    }

    console.log("\n✅ All database fixes applied!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

fixDatabase();
