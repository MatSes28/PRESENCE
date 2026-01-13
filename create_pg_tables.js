const Database = require("better-sqlite3");

// Path to the SQLite database
const dbPath = "./server/presence.db";

// Connect to the database
const db = new Database(dbPath);

// SQL statements to create PostgreSQL compatibility tables
const createPgStatStatementsTable = `
CREATE TABLE IF NOT EXISTS pg_stat_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  query TEXT,
  calls INTEGER DEFAULT 0,
  total_time DOUBLE DEFAULT 0,
  mean_time DOUBLE DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

const createPgStatStatementsInfoTable = `
CREATE TABLE IF NOT EXISTS pg_stat_statements_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id INTEGER,
  query_plan TEXT,
  execution_time DOUBLE,
  cpu_time DOUBLE,
  rows_processed INTEGER DEFAULT 0,
  memory_used INTEGER DEFAULT 0,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (statement_id) REFERENCES pg_stat_statements(id)
);
`;

try {
  console.log("Creating PostgreSQL compatibility tables...\n");

  // Execute each CREATE TABLE statement
  db.exec(createPgStatStatementsTable);
  console.log("✅ Created pg_stat_statements table");

  db.exec(createPgStatStatementsInfoTable);
  console.log("✅ Created pg_stat_statements_info table");

  console.log(
    "\n✅ PostgreSQL compatibility tables have been created successfully!"
  );

  // Verify the tables were created
  const query =
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";
  const tables = db.prepare(query).all();

  console.log("\nFinal list of tables:");
  tables.forEach((table) => {
    console.log(`- ${table.name}`);
  });
} catch (error) {
  console.error("Error creating tables:", error);
} finally {
  // Close the database connection
  db.close();
}
