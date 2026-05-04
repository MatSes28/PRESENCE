/**
 * Deep check of the gondola session table
 */

const postgres = require("postgres");
const {
  getRequiredDatabaseUrl,
  getDatabaseLabel,
} = require("./scripts/database-url-utils.cjs");

async function deepCheck() {
  const databaseUrl = getRequiredDatabaseUrl();
  console.log(`🔌 Connecting to ${getDatabaseLabel(databaseUrl)}...`);
  const sql = postgres(databaseUrl);

  try {
    // Check user_sessions table details
    console.log("\n📋 user_sessions table details:");
    const sessionInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    for (const col of sessionInfo) {
      console.log(
        `   ${col.column_name}: ${col.data_type} ${col.is_nullable === "NO" ? "NOT NULL" : ""}`,
      );
    }

    // Try to manually query the session table
    console.log("\n🔍 Testing user_sessions table query...");
    try {
      const testQuery =
        await sql`SELECT sid, sess, expire FROM "user_sessions" LIMIT 1`;
      console.log("   ✅ Query successful!");
      console.log(`   Rows: ${testQuery.length}`);
    } catch (qerr) {
      console.log(`   ❌ Query failed: ${qerr.message}`);
    }

    // Check indexes
    console.log("\n📊 Indexes on user_sessions table:");
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'user_sessions'
    `;
    for (const idx of indexes) {
      console.log(`   ${idx.indexname}`);
    }
  } finally {
    await sql.end();
  }
}

deepCheck().catch(console.error);
