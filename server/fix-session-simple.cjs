// Simple migration to fix session table on Railway
// Run with: node server/fix-session-simple.cjs

const { Client } = require("pg");
const {
  getRequiredDatabaseUrl,
} = require("./scripts/database-url-utils.cjs");

const DATABASE_URL = getRequiredDatabaseUrl();

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to Railway PostgreSQL...");
    await client.connect();
    console.log("Connected!\n");

    // 1. Check and fix user_sessions table
    console.log("=== Checking user_sessions table ===");

    // Check if session table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_sessions'
    `);

    if (tableCheck.rows.length === 0) {
      console.log("❌ user_sessions table does not exist");
      throw new Error("user_sessions table is missing");
    } else {
      console.log("user_sessions table exists, checking columns...");

      const requiredColumns = [
        ['sid', `ALTER TABLE "user_sessions" ADD COLUMN "sid" varchar`],
        ['sess', `ALTER TABLE "user_sessions" ADD COLUMN "sess" json`],
        ['expire', `ALTER TABLE "user_sessions" ADD COLUMN "expire" timestamp(6)`],
      ];

      for (const [columnName, statement] of requiredColumns) {
        const colCheck = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = '${columnName}'
        `);

        if (colCheck.rows.length === 0) {
          console.log(`Adding ${columnName} column...`);
          await client.query(statement);
          console.log(`✓ Added ${columnName} column`);
        } else {
          console.log(`✓ ${columnName} column already exists`);
        }
      }

      await client.query(`
        CREATE INDEX IF NOT EXISTS "user_sessions_expire_idx" ON "user_sessions" ("expire")
      `);
      console.log("✓ Ensured index on user_sessions.expire");
    }

    // 2. Fix error_logs table
    console.log("\n=== Checking error_logs table ===");

    const errorLogCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'error_logs'
    `);

    if (errorLogCheck.rows.length > 0) {
      const sessionIdCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'error_logs' AND column_name = 'session_id'
      `);

      if (sessionIdCheck.rows.length === 0) {
        console.log("Adding session_id column to error_logs...");
        await client.query(
          `ALTER TABLE "error_logs" ADD COLUMN "session_id" varchar`,
        );
        console.log("✓ Added session_id column");
      } else {
        console.log("✓ session_id column already exists");
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration();
