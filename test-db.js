const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres:XcHxhpIlNzRbviwtaqaJQiayKtudQbxM@hopper.proxy.rlwy.net:14374/railway",
});

async function testDB() {
  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected successfully!");

    // Test basic queries
    console.log("\n=== Testing Tables ===");

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("Available tables:");
    tables.rows.forEach((row) => console.log(`- ${row.table_name}`));

    // Test computers query
    console.log("\n=== Testing Computers Query ===");
    const computers = await client.query(
      "SELECT id, name, status FROM computers LIMIT 5;"
    );
    console.log(`Found ${computers.rows.length} computers:`);
    computers.rows.forEach((row) =>
      console.log(`- ${row.id}: ${row.name} (${row.status})`)
    );

    // Test schedules query
    console.log("\n=== Testing Schedules Query ===");
    const schedules = await client.query(
      "SELECT id, faculty_id FROM schedules LIMIT 5;"
    );
    console.log(`Found ${schedules.rows.length} schedules:`);
    schedules.rows.forEach((row) =>
      console.log(`- Schedule ${row.id}: Faculty ${row.faculty_id}`)
    );

    // Test faculty user (assuming user ID 1 is faculty)
    console.log("\n=== Testing Faculty Access Query ===");
    const facultyComputers = await client.query(`
      SELECT DISTINCT c.id, c.name
      FROM computers c
      INNER JOIN schedules s ON c.classroom_id = s.classroom_id
      WHERE s.faculty_id = 1;
    `);
    console.log(
      `Faculty user 1 has access to ${facultyComputers.rows.length} computers:`
    );
    facultyComputers.rows.forEach((row) =>
      console.log(`- ${row.id}: ${row.name}`)
    );
  } catch (error) {
    console.error("Database test failed:", error);
  } finally {
    await client.end();
    console.log("\nDatabase connection closed.");
  }
}

testDB();
