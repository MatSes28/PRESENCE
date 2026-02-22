// Fix session table with ALL required columns for connect-pg-simple
// Run with: node server/fix-all-columns.cjs

const { Client } = require("pg");

// Try both known database URLs
const DATABASES = [
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway",
  "postgresql://postgres:XcHxhpIlNzRbviwtaqaJQiayKtudQbxM@hopper.proxy.rlwy.net:14374/railway",
];

async function fixDatabase(dbUrl, name) {
  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`\n=== Testing ${name} ===`);
    await client.connect();
    console.log(`Connected to ${name}!`);

    // Check session table
    const tableCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'session'
      ORDER BY ordinal_position
    `);

    console.log("Current session table columns:");
    if (tableCheck.rows.length === 0) {
      console.log("  (table does not exist)");
    } else {
      tableCheck.rows.forEach((row) => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    }

    // Add missing columns
    const columnsNeeded = [
      { name: "sess", type: "json", notNull: true, default: "'{}'" },
      { name: "expire", type: "timestamp(6)", notNull: true, default: "NOW()" },
    ];

    for (const col of columnsNeeded) {
      const exists = tableCheck.rows.some((r) => r.column_name === col.name);
      if (!exists) {
        console.log(`Adding ${col.name} column...`);
        if (col.notNull) {
          await client.query(
            `ALTER TABLE "session" ADD COLUMN "${col.name}" ${col.type} NOT NULL DEFAULT ${col.default}`,
          );
        } else {
          await client.query(
            `ALTER TABLE "session" ADD COLUMN "${col.name}" ${col.type}`,
          );
        }
        console.log(`✓ Added ${col.name}`);
      } else {
        console.log(`✓ ${col.name} already exists`);
      }
    }

    // Create index if needed
    const indexCheck = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'session' AND indexname = 'IDX_session_expire'
    `);

    if (indexCheck.rows.length === 0) {
      console.log("Creating index on expire...");
      await client.query(
        `CREATE INDEX "IDX_session_expire" ON "session" ("expire")`,
      );
      console.log("✓ Created index");
    }

    console.log(`\n✅ ${name} fixed successfully!`);
    return true;
  } catch (error) {
    console.error(`Error with ${name}:`, error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("Checking Railway databases for session table issues...\n");

  // Try gondola first (the one we already know about)
  const result1 = await fixDatabase(DATABASES[0], "gondola.proxy.rlwy.net");

  // Try hopper (the one from server/.env)
  const result2 = await fixDatabase(DATABASES[1], "hopper.proxy.rlwy.net");

  if (result1 || result2) {
    console.log("\n=== Summary ===");
    if (result1) console.log("✓ gondola database fixed");
    if (result2) console.log("✓ hopper database fixed");
    console.log("\nNote: Restart the Railway app to pick up the changes!");
  } else {
    console.log(
      "\n❌ Could not connect to any database. Please check Railway environment variables.",
    );
  }
}

main();
