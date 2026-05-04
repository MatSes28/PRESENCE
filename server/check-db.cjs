/**
 * Check both Railway databases to find which one has 3 users
 */

const postgres = require("postgres");
const {
  getRequiredDatabaseUrls,
  getDatabaseLabel,
} = require("./scripts/database-url-utils.cjs");

async function checkDatabase(name, url) {
  console.log(`\n🔌 Checking ${name}...`);
  const sql = postgres(url, { timeout: 5000 });

  try {
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`   Users: ${userCount[0].count}`);

    // Check session table
    const sessionCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' AND table_schema = 'public'
      ORDER BY column_name
    `;
    console.log(
      `   user_sessions columns: ${sessionCols.map((c) => c.column_name).join(", ")}`,
    );

    return {
      name,
      users: userCount[0].count,
      columns: sessionCols.map((c) => c.column_name),
    };
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { name, error: err.message };
  } finally {
    await sql.end();
  }
}

async function main() {
  const urls = getRequiredDatabaseUrls();
  console.log("=== Checking configured databases ===");

  const results = [];
  for (const url of urls) {
    const label = getDatabaseLabel(url);
    results.push(await checkDatabase(label, url));
  }

  console.log("\n=== Summary ===");
  for (const result of results) {
    console.log(
      `${result.name}: ${result.error ? result.error : result.users + " users"}`,
    );
  }
}

main().catch(console.error);
