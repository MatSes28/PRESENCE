const postgres = require("postgres");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

async function fixSessions() {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    console.log("Fixing session table constraints...");

    // Make user_id nullable
    console.log("1. Making user_id nullable...");
    await sql.unsafe(
      "ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL",
    );
    console.log("✅ user_id is now nullable");

    // Make ip_address nullable
    console.log("2. Making ip_address nullable...");
    await sql.unsafe(
      "ALTER TABLE user_sessions ALTER COLUMN ip_address DROP NOT NULL",
    );
    console.log("✅ ip_address is now nullable");

    // Make session_id nullable if it exists
    console.log("3. Making session_id nullable...");
    try {
      await sql.unsafe(
        "ALTER TABLE user_sessions ALTER COLUMN session_id DROP NOT NULL",
      );
      console.log("✅ session_id is now nullable");
    } catch (e) {
      console.log("ℹ️ session_id column may not exist or already nullable");
    }

    // Verify the changes
    console.log("\nVerifying changes...");
    const result = await sql.unsafe(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions'
    `);

    console.log("\nCurrent table schema:");
    console.table(result);

    console.log("\n✅ Session fix complete!");
  } catch (error) {
    console.error("Error fixing sessions:", error.message);
  } finally {
    await sql.end();
  }
}

fixSessions();
