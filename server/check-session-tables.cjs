/**
 * Check for any session-related tables or conflicts
 */

const postgres = require("postgres");

const GONDOLA_DATABASE_URL =
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

async function checkSessionTables() {
  console.log("🔌 Connecting to Gondola...");
  const sql = postgres(GONDOLA_DATABASE_URL);

  try {
    // Check ALL tables with "session" in the name
    console.log('\n📋 Tables with "session" in name:');
    const sessionTables = await sql`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_name LIKE '%session%' AND table_schema = 'public'
    `;

    for (const t of sessionTables) {
      console.log(`   - ${t.table_schema}.${t.table_name}`);

      // Get columns for each
      const cols = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${t.table_name} AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      console.log(`     Columns: ${cols.map((c) => c.column_name).join(", ")}`);
    }

    // Check if maybe there's a "connect_pg_store" or similar
    console.log("\n📋 All tables in public schema:");
    const allTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    for (const t of allTables) {
      console.log(`   - ${t.table_name}`);
    }
  } finally {
    await sql.end();
  }
}

checkSessionTables().catch(console.error);
