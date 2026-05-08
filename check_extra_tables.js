const Database = require("better-sqlite3");
const { Client } = require("pg");
const { requirePostgresUrl } = require("./scripts/require-database-url.cjs");

async function checkAllTables() {
  console.log("🔍 Checking all tables in both databases...\n");

  // Check SQLite database
  console.log("=== SQLite Database ===");
  const sqlite = new Database("./server/presence.db");

  const sqliteTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    .all();
  console.log("All tables in SQLite:");
  sqliteTables.forEach((table) => {
    console.log(`- ${table.name}`);
  });

  // Check specific tables
  const extraTables = [
    "attendance_records",
    "computer_assignments",
    "sqlite_sequence",
  ];
  console.log("\nExtra tables found in SQLite:");
  extraTables.forEach((table) => {
    const exists = sqliteTables.some((t) => t.name === table);
    console.log(`${exists ? "✅" : "❌"} ${table}`);
  });

  // Check PostgreSQL database
  console.log("\n=== PostgreSQL Database ===");
  const client = new Client({
    connectionString: requirePostgresUrl(),
  });

  try {
    await client.connect();

    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    );
    const pgTables = result.rows.map((row) => row.table_name);

    console.log("All tables in PostgreSQL:");
    pgTables.forEach((table) => {
      console.log(`- ${table}`);
    });

    console.log("\nExtra tables found in PostgreSQL:");
    extraTables.forEach((table) => {
      const exists = pgTables.includes(table);
      console.log(`${exists ? "✅" : "❌"} ${table}`);
    });
  } catch (error) {
    console.error("Error checking PostgreSQL:", error);
  } finally {
    await client.end();
    sqlite.close();
    console.log("\n🔍 Database check complete");
  }
}

checkAllTables();
