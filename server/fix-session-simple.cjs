// Simple migration to fix session table on Railway
// Run with: node server/fix-session-simple.cjs

const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

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

    // 1. Check and fix session table
    console.log("=== Checking session table ===");

    // Check if session table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'session'
    `);

    if (tableCheck.rows.length === 0) {
      console.log("Creating session table...");
      await client.query(`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          PRIMARY KEY ("sid")
        )
      `);
      console.log("✓ Created session table");

      // Create index
      await client.query(
        `CREATE INDEX "IDX_session_expire" ON "session" ("expire")`,
      );
      console.log("✓ Created index on session.expire");
    } else {
      console.log("Session table exists, checking columns...");

      // Check if sess column exists
      const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'session' AND column_name = 'sess'
      `);

      if (colCheck.rows.length === 0) {
        console.log("Adding sess column...");
        await client.query(
          `ALTER TABLE "session" ADD COLUMN "sess" json NOT NULL DEFAULT '{}'`,
        );
        console.log("✓ Added sess column");
      } else {
        console.log("✓ sess column already exists");
      }
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
