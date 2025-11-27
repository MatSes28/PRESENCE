const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres:XcHxhpIlNzRbviwtaqaJQiayKtudQbxM@hopper.proxy.rlwy.net:14374/railway",
});

async function testSession() {
  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected successfully!");

    // Check user_sessions table
    console.log("\n=== Checking User Sessions ===");
    const sessions = await client.query(
      "SELECT sid, sess FROM user_sessions LIMIT 5;"
    );
    console.log(`Found ${sessions.rows.length} sessions:`);

    sessions.rows.forEach((row, index) => {
      console.log(`\nSession ${index + 1}:`);
      console.log(`SID: ${row.sid}`);
      try {
        const sessionData = JSON.parse(row.sess);
        console.log(`User ID: ${sessionData.userId || "null"}`);
        console.log(`User Role: ${sessionData.userRole || "null"}`);
        console.log(`Cookie: ${JSON.stringify(sessionData.cookie)}`);
      } catch (e) {
        console.log(`Session data: ${row.sess}`);
      }
    });

    // Check users table
    console.log("\n=== Checking Users ===");
    const users = await client.query(
      "SELECT id, email, name, role FROM users;"
    );
    console.log(`Found ${users.rows.length} users:`);
    users.rows.forEach((row) => {
      console.log(`- ID ${row.id}: ${row.email} (${row.role}) - ${row.name}`);
    });
  } catch (error) {
    console.error("Session test failed:", error);
  } finally {
    await client.end();
    console.log("\nDatabase connection closed.");
  }
}

testSession();
