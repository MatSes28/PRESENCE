/**
 * Migration script to fix all database schema issues on Railway's actual database
 * This fixes the hopper database that Railway is actually connecting to
 */

const postgres = require("postgres");
const {
  getRequiredDatabaseUrl,
  getDatabaseLabel,
} = require("./scripts/database-url-utils.cjs");

async function migrate() {
  const databaseUrl = getRequiredDatabaseUrl();
  console.log(`🔌 Connecting to Railway database (${getDatabaseLabel(databaseUrl)})...`);
  const sql = postgres(databaseUrl);

  try {
    // Check current users count
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`📊 Current users in database: ${userCount[0].count}`);

    // ===== 1. Fix user_sessions for connect-pg-simple =====
    console.log("\n🔧 Fixing user_sessions table...");

    // Check if session table exists
    const sessionTable = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_sessions'
    `;

    if (sessionTable.length === 0) {
      throw new Error("user_sessions table is missing");
    } else {
      console.log("   user_sessions table exists, checking columns...");

      // Check for sess column
      const sessCol = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_sessions' AND column_name = 'sess'
      `;

      if (sessCol.length === 0) {
        console.log("   Adding sess column...");
        await sql`ALTER TABLE "user_sessions" ADD COLUMN "sess" json`;
      }

      // Check for expire column
      const expireCol = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'user_sessions' AND column_name = 'expire'
      `;

      if (expireCol.length === 0) {
        console.log("   Adding expire column...");
        await sql`ALTER TABLE "user_sessions" ADD COLUMN "expire" timestamp(6)`;
      }

      const sidCol = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'user_sessions' AND column_name = 'sid'
      `;

      if (sidCol.length === 0) {
        console.log("   Adding sid column...");
        await sql`ALTER TABLE "user_sessions" ADD COLUMN "sid" character varying`;
      }

      // Create index if not exists
      const indexExists = await sql`
        SELECT indexname 
        FROM pg_indexes 
        WHERE indexname = 'user_sessions_expire_idx'
      `;

      if (indexExists.length === 0) {
        console.log("   Creating expire index...");
        await sql`CREATE INDEX "user_sessions_expire_idx" ON "user_sessions" ("expire")`;
      }

      console.log("   ✅ Session table fixed");
    }

    // ===== 2. Fix AUDIT_LOGS table =====
    console.log("\n🔧 Fixing audit_logs table...");

    // Check for old_values column
    const oldValuesCol = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND column_name = 'old_values'
    `;

    if (oldValuesCol.length === 0) {
      console.log("   Adding old_values column...");
      await sql`ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "old_values" jsonb`;
      console.log("   ✅ old_values column added");
    } else {
      console.log("   ✅ old_values column exists");
    }

    // ===== 3. Fix ERROR_LOGS table =====
    console.log("\n🔧 Fixing error_logs table...");

    // Check for request_id column
    const requestIdCol = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'error_logs' AND column_name = 'request_id'
    `;

    if (requestIdCol.length === 0) {
      console.log("   Adding request_id column...");
      await sql`ALTER TABLE "error_logs" ADD COLUMN IF NOT EXISTS "request_id" character varying(255)`;
      console.log("   ✅ request_id column added");
    } else {
      console.log("   ✅ request_id column exists");
    }

    // ===== 4. Verify all tables =====
    console.log("\n📊 Verifying database tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log("   Tables in database:");
    for (const t of tables) {
      console.log(`   - ${t.table_name}`);
    }

    console.log("\n✅ All migrations completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

migrate()
  .then(() => {
    console.log("\n🚀 Migration script completed!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n💥 Error:", err);
    process.exit(1);
  });
