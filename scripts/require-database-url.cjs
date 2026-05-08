function requirePostgresUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(
      "DATABASE_URL is required. Set it to the target PostgreSQL connection string before running this script.",
    );
    process.exit(1);
  }

  if (!/^postgres(ql)?:\/\//i.test(connectionString)) {
    console.error("DATABASE_URL must be a PostgreSQL connection string.");
    process.exit(1);
  }

  return connectionString;
}

module.exports = { requirePostgresUrl };
