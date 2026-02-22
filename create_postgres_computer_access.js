const { Client } = require("pg");

// PostgreSQL connection URL
const connectionString =
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

// Create a new PostgreSQL client
const client = new Client({
  connectionString: connectionString,
});

async function createComputerAccessTable() {
  try {
    // Connect to the PostgreSQL database
    await client.connect();
    console.log("✅ Connected to PostgreSQL database\n");

    // SQL statement to create computer_access table
    const createComputerAccessTable = `
    CREATE TABLE IF NOT EXISTS computer_access (
      id SERIAL PRIMARY KEY,
      computer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      logout_time TIMESTAMP,
      status VARCHAR(50) DEFAULT 'active',
      FOREIGN KEY (computer_id) REFERENCES computers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    `;

    // Execute the CREATE TABLE statement
    await client.query(createComputerAccessTable);
    console.log("✅ Created computer_access table in PostgreSQL");

    // Verify the table was created
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'computer_access';
    `;

    const result = await client.query(query);
    if (result.rows.length > 0) {
      console.log("✅ computer_access table verified in PostgreSQL");
    }

    // List all tables for final verification
    const allTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const allTablesResult = await client.query(allTablesQuery);
    const tables = allTablesResult.rows.map((row) => row.table_name);

    console.log("\nFinal list of tables in PostgreSQL:");
    tables.forEach((table) => {
      console.log(`- ${table}`);
    });
  } catch (error) {
    console.error("Error creating table in PostgreSQL:", error);
  } finally {
    // Close the connection
    await client.end();
    console.log("\n🔌 PostgreSQL connection closed");
  }
}

// Execute the function
createComputerAccessTable();
