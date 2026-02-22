// Create new admin account in Railway PostgreSQL
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

// Pre-hashed password for "Admin123" with bcrypt 12 rounds
const hashedPassword =
  "$2a$12$QIcfNITxQZGQJWZxO.yJluvEHY7kF.LP1pEFrWKWKWK8rK8rK8rK";

async function createAdmin() {
  console.log("🔌 Connecting to Railway PostgreSQL...");

  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // First, let's get the hash for Admin123
    const bcrypt = await import("bcryptjs");
    const newHashedPassword = await bcrypt.default.hash("Admin123", 12);
    console.log("Hash:", newHashedPassword);

    // Check if user already exists
    const existing = await sql`
      SELECT id, email FROM users WHERE email = 'mattferia777@gmail.com'
    `;

    if (existing.length > 0) {
      console.log("User already exists, updating...");
      await sql`
        UPDATE users 
        SET password = ${newHashedPassword}, name = 'Matt Feria', role = 'admin'
        WHERE email = 'mattferia777@gmail.com'
      `;
      console.log("✅ Admin account updated!");
    } else {
      // Create new admin user
      const result = await sql`
        INSERT INTO users (email, password, name, role, is_active, created_at)
        VALUES ('mattferia777@gmail.com', ${newHashedPassword}, 'Matt Feria', 'admin', true, NOW())
        RETURNING id, email, name, role
      `;
      console.log("✅ New admin account created!");
      console.log("User:", result[0]);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

createAdmin();
