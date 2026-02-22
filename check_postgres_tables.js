const { Client } = require("pg");

// PostgreSQL connection URL
const connectionString =
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

// Create a new PostgreSQL client
const client = new Client({
  connectionString: connectionString,
});

async function checkPostgresTables() {
  try {
    // Connect to the PostgreSQL database
    await client.connect();
    console.log("✅ Connected to PostgreSQL database\n");

    // Query to list all tables in the public schema
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const result = await client.query(query);
    const tables = result.rows.map((row) => row.table_name);

    console.log("List of tables in PostgreSQL database:");
    tables.forEach((table) => {
      console.log(`- ${table}`);
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
      (table) => !tables.includes(table)
    );

    if (missingTables.length > 0) {
      console.log("\n❌ Missing tables in PostgreSQL:");
      missingTables.forEach((table) => {
        console.log(`- ${table}`);
      });
    } else {
      console.log("\n✅ All expected tables are present in PostgreSQL!");
    }
  } catch (error) {
    console.error("Error connecting to or querying PostgreSQL:", error);
  } finally {
    // Close the connection
    await client.end();
    console.log("\n🔌 PostgreSQL connection closed");
  }
}

// Execute the function
checkPostgresTables();
