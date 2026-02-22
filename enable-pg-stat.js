const postgres = require("postgres");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

async function enablePgStat() {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    console.log("Enabling pg_stat_statements extension...");
    await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;");
    console.log("pg_stat_statements extension enabled successfully!");
  } catch (error) {
    console.error("Error enabling pg_stat_statements:", error);
  } finally {
    await sql.end();
  }
}

enablePgStat();
