/**
 * Check both Railway databases to find which one has 3 users
 */

const postgres = require("postgres");

const GONDOLA_DATABASE_URL =
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";
const HOPPER_DATABASE_URL =
  "postgresql://postgres:XcHxhpIlNzRbviwtaqaJQiayKtudQbxM@hopper.proxy.rlwy.net:14374/railway";

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
      WHERE table_name = 'session' AND table_schema = 'public'
      ORDER BY column_name
    `;
    console.log(
      `   Session columns: ${sessionCols.map((c) => c.column_name).join(", ")}`,
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
  console.log("=== Checking Railway Databases ===");

  const gondola = await checkDatabase("Gondola", GONDOLA_DATABASE_URL);
  const hopper = await checkDatabase("Hopper", HOPPER_DATABASE_URL);

  console.log("\n=== Summary ===");
  console.log(
    `Gondola: ${gondola.error ? gondola.error : gondola.users + " users"}`,
  );
  console.log(
    `Hopper: ${hopper.error ? hopper.error : hopper.users + " users"}`,
  );

  // Figure out which one Railway is using
  if (!gondola.error && !hopper.error) {
    if (gondola.users === 3) {
      console.log("\n🎯 Railway is using GONDOLA database (3 users)");
    } else if (hopper.users === 3) {
      console.log("\n🎯 Railway is using HOPPER database (3 users)");
    }
  }
}

main().catch(console.error);
