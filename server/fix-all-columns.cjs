// Fix session table with ALL required columns for connect-pg-simple
// Run with: node server/fix-all-columns.cjs

const { Client } = require("pg");
const {
  getRequiredDatabaseUrls,
  getDatabaseLabel,
} = require("./scripts/database-url-utils.cjs");

const DATABASES = getRequiredDatabaseUrls();

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

    // Check user_sessions table
    const tableCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_sessions'
      ORDER BY ordinal_position
    `);

    console.log("Current user_sessions table columns:");
    if (tableCheck.rows.length === 0) {
      console.log("  (table does not exist)");
    } else {
      tableCheck.rows.forEach((row) => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    }

    // Add missing columns
    const columnsNeeded = [
      { name: "sid", type: "varchar", notNull: false, default: null },
      { name: "sess", type: "json", notNull: false, default: null },
      { name: "expire", type: "timestamp(6)", notNull: false, default: null },
    ];

    for (const col of columnsNeeded) {
      const exists = tableCheck.rows.some((r) => r.column_name === col.name);
      if (!exists) {
        console.log(`Adding ${col.name} column...`);
        if (col.notNull) {
          await client.query(
            `ALTER TABLE "user_sessions" ADD COLUMN "${col.name}" ${col.type} NOT NULL DEFAULT ${col.default}`,
          );
        } else {
          await client.query(
            `ALTER TABLE "user_sessions" ADD COLUMN "${col.name}" ${col.type}`,
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
      WHERE tablename = 'user_sessions' AND indexname = 'user_sessions_expire_idx'
    `);

    if (indexCheck.rows.length === 0) {
      console.log("Creating index on expire...");
      await client.query(
        `CREATE INDEX "user_sessions_expire_idx" ON "user_sessions" ("expire")`,
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

  const results = [];
  for (const databaseUrl of DATABASES) {
    results.push(
      await fixDatabase(databaseUrl, getDatabaseLabel(databaseUrl, "database")),
    );
  }

  if (results.some(Boolean)) {
    console.log("\n=== Summary ===");
    DATABASES.forEach((databaseUrl, index) => {
      if (results[index]) {
        console.log(`✓ ${getDatabaseLabel(databaseUrl, "database")} fixed`);
      }
    });
    console.log("\nNote: Restart the Railway app to pick up the changes!");
  } else {
    console.log(
      "\n❌ Could not connect to any database. Please check Railway environment variables.",
    );
  }
}

main();
