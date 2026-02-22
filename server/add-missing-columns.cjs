const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway",
});

async function migrate() {
  console.log("Starting migration...");

  try {
    // Add columns to user_sessions for connect-pg-simple
    console.log("1. Adding columns to user_sessions...");
    await pool.query(
      `ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sid VARCHAR(255)`,
    );
    console.log("   - sid added");
    await pool.query(
      `ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS sess JSONB`,
    );
    console.log("   - sess added");
    await pool.query(
      `ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expire TIMESTAMP`,
    );
    console.log("   - expire added");
    console.log("   ✅ user_sessions done");

    // Add columns to error_logs
    console.log("2. Adding columns to error_logs...");
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(255)`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_agent TEXT`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS method VARCHAR(50)`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS url TEXT`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS status_code INTEGER`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS response_time INTEGER`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS metadata JSONB`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(255)`,
    );
    await pool.query(
      `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    );
    console.log("   ✅ error_logs done");

    // Add columns to audit_logs
    console.log("3. Adding columns to audit_logs...");
    await pool.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB`,
    );
    await pool.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB`,
    );
    await pool.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash VARCHAR(255)`,
    );
    await pool.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(255)`,
    );
    await pool.query(
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
    );
    console.log("   ✅ audit_logs done");

    console.log("\n✅ All migrations completed successfully!");

    // Verify the columns exist
    console.log("\nVerifying columns...");
    const us = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions'`,
    );
    console.log(
      "user_sessions columns:",
      us.rows.map((r) => r.column_name),
    );
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
