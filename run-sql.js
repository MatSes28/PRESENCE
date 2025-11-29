const postgres = require("postgres");
const fs = require("fs");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:XcHxhpIlNzRbviwtaqaJQiayKtudQbxM@hopper.proxy.rlwy.net:14374/railway";

async function runSQL() {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    console.log("Creating audit_logs table...");
    const auditLogsSQL = fs.readFileSync("create-audit-logs.sql", "utf8");

    // Split by semicolon and execute each statement
    const statements = auditLogsSQL
      .split(";")
      .filter((stmt) => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log("Executing:", statement.trim().substring(0, 50) + "...");
        await sql.unsafe(statement);
      }
    }

    console.log("Audit logs table created successfully!");
  } catch (error) {
    console.error("Error running SQL:", error);
  } finally {
    await sql.end();
  }
}

runSQL();
