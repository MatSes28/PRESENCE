// Script to fix the expires_at column in user_sessions table
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixSessionTable() {
  const client = await pool.connect();

  try {
    // Make expires_at nullable
    console.log("Making expires_at column nullable...");
    await client.query(`
      ALTER TABLE "user_sessions" 
      ALTER COLUMN "expires_at" DROP NOT NULL;
    `);
    console.log("✅ expires_at column is now nullable");

    // Also make sure other columns are nullable for session handling
    console.log("Making sure other session columns are nullable...");
    await client.query(`
      ALTER TABLE "user_sessions" 
      ALTER COLUMN "user_id" DROP NOT NULL,
      ALTER COLUMN "ip_address" DROP NOT NULL,
      ALTER COLUMN "session_id" DROP NOT NULL;
    `);
    console.log("✅ All session columns are now nullable");

    // Verify the changes
    const result = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' 
      ORDER BY ordinal_position;
    `);

    console.log("\nCurrent column status:");
    console.table(result.rows);
  } catch (error) {
    console.error("Error fixing session table:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSessionTable();
