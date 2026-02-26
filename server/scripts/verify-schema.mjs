// Verify that required schema objects exist after migrations.
//
// Intended for production deploy pipelines as a fail-fast guard.
//
// Usage:
//   DATABASE_URL=postgresql://... node server/scripts/verify-schema.mjs

import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = postgres(connectionString, {
  prepare: false,
  max: 5,
  idle_timeout: 10,
  connect_timeout: 30,
});

async function requireTable(tableName) {
  const result = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  if (!result?.[0]?.exists) {
    throw new Error(`Missing required table: ${tableName}`);
  }
}

async function main() {
  // Critical security flows.
  await requireTable("password_reset_tokens");

  // Sessions for connect-pg-simple (required for multi-instance deployments).
  await requireTable("session");

  console.log("✅ Schema verification passed (required tables present)");
}

main()
  .catch((err) => {
    console.error("❌ Schema verification failed:", err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
