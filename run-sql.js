const postgres = require("postgres");
const fs = require("fs");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:XcHxhpIlNzRbviwtaqaJQiayKtudQbxM@hopper.proxy.rlwy.net:14374/railway";

async function runSQL() {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    console.log("Running database setup...");
    const addColumns = fs.readFileSync("add-columns.sql", "utf8");
    const insertAdmin = fs.readFileSync("insert-admin.sql", "utf8");
    const fullContent = addColumns + "\n" + insertAdmin;

    // Split by semicolon and execute each statement
    const statements = fullContent
      .split(";")
      .filter((stmt) => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log("Executing:", statement.trim().substring(0, 50) + "...");
        await sql.unsafe(statement);
      }
    }

    console.log("Database setup completed successfully!");
  } catch (error) {
    console.error("Error running SQL:", error);
  } finally {
    await sql.end();
  }
}

runSQL();
