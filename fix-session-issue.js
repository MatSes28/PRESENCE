// Fix for session creation issue: make user_id nullable in user_sessions table
// This is needed because connect-pg-simple uses sid/sess/expire columns
// but the original schema has user_id as NOT NULL

const { Pool } = require("pg");

async function fixSessionTable() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Fixing user_sessions table...");

    // Make user_id nullable to allow connect-pg-simple to create sessions
    await pool.query(
      "ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL",
    );

    console.log("✅ Made user_id nullable in user_sessions table");

    // Verify the change
    const result = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' AND column_name = 'user_id'
    `);

    console.log("Current column definition:", result.rows[0]);
  } catch (error) {
    console.error("Error fixing session table:", error.message);
  } finally {
    await pool.end();
  }
}

fixSessionTable();
