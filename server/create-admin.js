// Create/update an admin account in the configured database.
//
// Production readiness:
// - No embedded credentials.
// - Requires explicit env vars.
//
// Usage:
//   DATABASE_URL=postgresql://... ADMIN_EMAIL=... ADMIN_PASSWORD=... node server/create-admin.js
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME || "System Administrator";

if (!adminEmail || !adminEmail.trim()) {
  console.error("Missing ADMIN_EMAIL");
  process.exit(1);
}

if (!adminPassword || adminPassword.length < 12) {
  console.error("Missing/weak ADMIN_PASSWORD (min 12 chars)");
  process.exit(1);
}

async function createAdmin() {
  console.log("Connecting to PostgreSQL...");

  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // Hash password (do not log it)
    const bcrypt = await import("bcryptjs");
    const newHashedPassword = await bcrypt.default.hash(adminPassword, 12);

    // Check if user already exists
    const existing = await sql`
      SELECT id, email FROM users WHERE email = ${adminEmail}
    `;

    if (existing.length > 0) {
      console.log("User already exists, updating...");
      await sql`
        UPDATE users 
        SET password = ${newHashedPassword}, name = ${adminName}, role = 'admin'
        WHERE email = ${adminEmail}
      `;
      console.log("✅ Admin account updated!");
    } else {
      // Create new admin user
      const result = await sql`
        INSERT INTO users (email, password, name, role, is_active, created_at)
        VALUES (${adminEmail}, ${newHashedPassword}, ${adminName}, 'admin', true, NOW())
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
