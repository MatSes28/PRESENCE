const Database = require("better-sqlite3");

// Path to the SQLite database
const dbPath = "./server/presence.db";

// Connect to the database
const db = new Database(dbPath);

// SQL statements to create missing tables
const createAuditLogsTable = `
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id INTEGER,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

const createComputerAccessTable = `
CREATE TABLE IF NOT EXISTS computer_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  computer_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (computer_id) REFERENCES computers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

const createComputerMaintenanceTable = `
CREATE TABLE IF NOT EXISTS computer_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  computer_id INTEGER NOT NULL,
  maintenance_type TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  technician_id INTEGER,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (computer_id) REFERENCES computers(id),
  FOREIGN KEY (technician_id) REFERENCES users(id)
);
`;

const createPushNotificationsTable = `
CREATE TABLE IF NOT EXISTS push_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

const createUserSessionsTable = `
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

try {
  console.log("Creating missing tables...\n");

  // Execute each CREATE TABLE statement
  db.exec(createAuditLogsTable);
  console.log("✅ Created audit_logs table");

  db.exec(createComputerAccessTable);
  console.log("✅ Created computer_access table");

  db.exec(createComputerMaintenanceTable);
  console.log("✅ Created computer_maintenance table");

  db.exec(createPushNotificationsTable);
  console.log("✅ Created push_notifications table");

  db.exec(createUserSessionsTable);
  console.log("✅ Created user_sessions table");

  console.log("\n✅ All missing tables have been created successfully!");

  // Verify the tables were created
  const query =
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";
  const tables = db.prepare(query).all();

  console.log("\nUpdated list of tables:");
  tables.forEach((table) => {
    console.log(`- ${table.name}`);
  });
} catch (error) {
  console.error("Error creating tables:", error);
} finally {
  // Close the database connection
  db.close();
}
