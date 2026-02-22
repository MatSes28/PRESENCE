// Quick script to reset admin password in Railway PostgreSQL
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

// Pre-hashed password for "Admin@123" with bcrypt 12 rounds
const hashedPassword =
  "$2a$12$.yz/vi7H9pxrUVZS21gh.upAXBPXx1uamm0OjvXIAaLXMJwL0pL4q";

async function resetAdmin() {
  console.log("🔌 Connecting to Railway PostgreSQL...");

  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // Update admin user
    const result = await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE email = 'admin@clsu.edu.ph'
      RETURNING id, email, name, role
    `;

    if (result.length > 0) {
      console.log("✅ Admin password reset successfully!");
      console.log("User:", result[0]);
    } else {
      console.log("❌ Admin user not found");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

resetAdmin();
