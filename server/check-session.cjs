/**
 * Deep check of the gondola session table
 */

const postgres = require("postgres");

const GONDOLA_DATABASE_URL =
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

async function deepCheck() {
  console.log("🔌 Connecting to Gondola...");
  const sql = postgres(GONDOLA_DATABASE_URL);

  try {
    // Check session table details
    console.log("\n📋 Session table details:");
    const sessionInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'session' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    for (const col of sessionInfo) {
      console.log(
        `   ${col.column_name}: ${col.data_type} ${col.is_nullable === "NO" ? "NOT NULL" : ""}`,
      );
    }

    // Try to manually query the session table
    console.log("\n🔍 Testing session table query...");
    try {
      const testQuery =
        await sql`SELECT sid, sess, expire FROM "session" LIMIT 1`;
      console.log("   ✅ Query successful!");
      console.log(`   Rows: ${testQuery.length}`);
    } catch (qerr) {
      console.log(`   ❌ Query failed: ${qerr.message}`);
    }

    // Check indexes
    console.log("\n📊 Indexes on session table:");
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'session'
    `;
    for (const idx of indexes) {
      console.log(`   ${idx.indexname}`);
    }
  } finally {
    await sql.end();
  }
}

deepCheck().catch(console.error);
