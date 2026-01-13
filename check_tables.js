const Database = require("better-sqlite3");

// Path to the SQLite database
const dbPath = "./server/presence.db";

// Connect to the database
const db = new Database(dbPath);

// Query to list all tables
const query =
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";

try {
  const tables = db.prepare(query).all();

  console.log("List of tables in the database:");
  tables.forEach((table) => {
    console.log(`- ${table.name}`);
  });

  // Expected tables from the user
  const expectedTables = [
    "audit_logs",
    "class_sessions",
    "classrooms",
    "computer_access",
    "computer_maintenance",
    "computers",
    "email_notifications",
    "enrollments",
    "iot_devices",
    "pg_stat_statements",
    "pg_stat_statements_info",
    "push_notifications",
    "schedules",
    "students",
    "subjects",
    "user_sessions",
    "users",
  ];

  console.log("\nExpected tables:");
  expectedTables.forEach((table) => {
    console.log(`- ${table}`);
  });

  // Check for missing tables
  const missingTables = expectedTables.filter(
    (table) => !tables.some((t) => t.name === table)
  );

  if (missingTables.length > 0) {
    console.log("\n❌ Missing tables:");
    missingTables.forEach((table) => {
      console.log(`- ${table}`);
    });
  } else {
    console.log("\n✅ All expected tables are present!");
  }
} catch (error) {
  console.error("Error querying the database:", error);
} finally {
  // Close the database connection
  db.close();
}
