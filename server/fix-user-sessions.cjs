const { Pool } = require("pg");
const {
  getRequiredDatabaseUrl,
} = require("./scripts/database-url-utils.cjs");

const pool = new Pool({
  connectionString: getRequiredDatabaseUrl(),
});

async function fixTables() {
  const client = await pool.connect();

  try {
    console.log("Adding missing columns to tables...\n");

    // 1. Add sid, sess, expire to user_sessions
    console.log("=== Fixing user_sessions ===");

    // Check if sid exists
    const hasSid = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'sid'",
    );
    if (hasSid.rows.length === 0) {
      await client.query(
        "ALTER TABLE user_sessions ADD COLUMN sid VARCHAR(256)",
      );
      console.log("✓ Added sid column");
    } else {
      console.log("✓ sid column already exists");
    }

    // Check if sess exists
    const hasSess = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'sess'",
    );
    if (hasSess.rows.length === 0) {
      await client.query("ALTER TABLE user_sessions ADD COLUMN sess JSONB");
      console.log("✓ Added sess column");
    } else {
      console.log("✓ sess column already exists");
    }

    // Check if expire exists
    const hasExpire = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'expire'",
    );
    if (hasExpire.rows.length === 0) {
      await client.query(
        "ALTER TABLE user_sessions ADD COLUMN expire TIMESTAMP",
      );
      console.log("✓ Added expire column");
    } else {
      console.log("✓ expire column already exists");
    }

    // 2. Add request_id to error_logs
    console.log("\n=== Fixing error_logs ===");

    const hasRequestId = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'error_logs' AND column_name = 'request_id'",
    );
    if (hasRequestId.rows.length === 0) {
      await client.query(
        "ALTER TABLE error_logs ADD COLUMN request_id VARCHAR(100)",
      );
      console.log("✓ Added request_id column");
    } else {
      console.log("✓ request_id column already exists");
    }

    // Add other missing columns to error_logs
    const missingErrorCols = [
      "user_agent",
      "method",
      "url",
      "status_code",
      "response_time",
      "metadata",
      "resolved",
      "resolved_at",
      "resolved_by",
      "is_active",
    ];
    for (const col of missingErrorCols) {
      const hasCol = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'error_logs' AND column_name = $1",
        [col],
      );
      if (hasCol.rows.length === 0) {
        let type = "VARCHAR(500)";
        if (col === "metadata") type = "JSONB";
        if (col === "resolved") type = "BOOLEAN DEFAULT false";
        if (col === "resolved_at") type = "TIMESTAMP";
        if (col === "resolved_by") type = "INTEGER";
        if (col === "is_active") type = "BOOLEAN DEFAULT true";
        if (col === "status_code") type = "INTEGER";
        if (col === "response_time") type = "INTEGER";
        await client.query(`ALTER TABLE error_logs ADD COLUMN ${col} ${type}`);
        console.log(`✓ Added ${col} column`);
      }
    }

    // 3. Add old_values, new_values to audit_logs
    console.log("\n=== Fixing audit_logs ===");

    const hasOldValues = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'old_values'",
    );
    if (hasOldValues.rows.length === 0) {
      await client.query("ALTER TABLE audit_logs ADD COLUMN old_values JSONB");
      console.log("✓ Added old_values column");
    } else {
      console.log("✓ old_values column already exists");
    }

    const hasNewValues = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_values'",
    );
    if (hasNewValues.rows.length === 0) {
      await client.query("ALTER TABLE audit_logs ADD COLUMN new_values JSONB");
      console.log("✓ Added new_values column");
    } else {
      console.log("✓ new_values column already exists");
    }

    // Add other missing columns to audit_logs
    const missingAuditCols = ["hash", "previous_hash", "is_active"];
    for (const col of missingAuditCols) {
      const hasCol = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = $1",
        [col],
      );
      if (hasCol.rows.length === 0) {
        let type = "VARCHAR(500)";
        if (col === "is_active") type = "BOOLEAN DEFAULT true";
        await client.query(`ALTER TABLE audit_logs ADD COLUMN ${col} ${type}`);
        console.log(`✓ Added ${col} column`);
      }
    }

    console.log("\n=== Verifying tables ===");

    // Verify user_sessions
    const us = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position",
    );
    console.log(
      "user_sessions columns:",
      us.rows.map((r) => r.column_name).join(", "),
    );

    // Verify error_logs
    const err = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'error_logs' ORDER BY ordinal_position",
    );
    console.log(
      "error_logs columns:",
      err.rows.map((r) => r.column_name).join(", "),
    );

    // Verify audit_logs
    const audit = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position",
    );
    console.log(
      "audit_logs columns:",
      audit.rows.map((r) => r.column_name).join(", "),
    );

    console.log("\n✅ All fixes applied!");
  } finally {
    client.release();
    await pool.end();
  }
}

fixTables().catch(console.error);
