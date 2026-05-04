const { Pool } = require("pg");
const {
  getRequiredDatabaseUrl,
} = require("./scripts/database-url-utils.cjs");

const pool = new Pool({
  connectionString: getRequiredDatabaseUrl(),
});

async function checkTables() {
  const client = await pool.connect();

  try {
    // Check user_sessions table
    console.log("=== user_sessions ===");
    const us = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions' ORDER BY ordinal_position",
    );
    console.log(us.rows.map((r) => r.column_name).join(", "));

    // Check error_logs table
    console.log("\n=== error_logs ===");
    const err = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'error_logs' ORDER BY ordinal_position",
    );
    console.log(err.rows.map((r) => r.column_name).join(", "));

    // Check audit_logs table
    console.log("\n=== audit_logs ===");
    const audit = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position",
    );
    console.log(audit.rows.map((r) => r.column_name).join(", "));
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables().catch(console.error);
