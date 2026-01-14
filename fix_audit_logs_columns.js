const Database = require("better-sqlite3");

console.log("🔧 Fixing audit_logs table columns...\n");

// Connect to the SQLite database
const dbPath = "./server/presence.db";
const db = new Database(dbPath);

try {
  // Check current columns in audit_logs table
  const columns = db.prepare("PRAGMA table_info(audit_logs)").all();
  console.log("Current audit_logs columns:");
  columns.forEach((col) => {
    console.log(`- ${col.name} (${col.type})`);
  });

  // Check for missing columns based on the schema
  const expectedColumns = [
    "id",
    "timestamp",
    "userId",
    "action",
    "resource",
    "resourceId",
    "oldValues",
    "newValues",
    "ipAddress",
    "userAgent",
    "sessionId",
    "success",
    "errorMessage",
    "metadata",
    "hash",
    "previousHash",
    "isActive",
    "createdAt",
  ];

  const missingColumns = expectedColumns.filter(
    (expectedCol) => !columns.some((col) => col.name === expectedCol)
  );

  if (missingColumns.length > 0) {
    console.log("\n❌ Missing columns found:");
    missingColumns.forEach((col) => {
      console.log(`- ${col}`);
    });

    // Add missing columns
    missingColumns.forEach((col) => {
      let sql = "";
      switch (col) {
        case "timestamp":
          sql =
            "ALTER TABLE audit_logs ADD COLUMN timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP";
          break;
        case "userId":
          sql = "ALTER TABLE audit_logs ADD COLUMN userId INTEGER";
          break;
        case "action":
          sql = "ALTER TABLE audit_logs ADD COLUMN action TEXT";
          break;
        case "resource":
          sql = "ALTER TABLE audit_logs ADD COLUMN resource TEXT";
          break;
        case "resourceId":
          sql = "ALTER TABLE audit_logs ADD COLUMN resourceId TEXT";
          break;
        case "oldValues":
          sql = "ALTER TABLE audit_logs ADD COLUMN oldValues TEXT";
          break;
        case "newValues":
          sql = "ALTER TABLE audit_logs ADD COLUMN newValues TEXT";
          break;
        case "ipAddress":
          sql = "ALTER TABLE audit_logs ADD COLUMN ipAddress TEXT";
          break;
        case "userAgent":
          sql = "ALTER TABLE audit_logs ADD COLUMN userAgent TEXT";
          break;
        case "sessionId":
          sql = "ALTER TABLE audit_logs ADD COLUMN sessionId TEXT";
          break;
        case "success":
          sql = "ALTER TABLE audit_logs ADD COLUMN success BOOLEAN DEFAULT 1";
          break;
        case "errorMessage":
          sql = "ALTER TABLE audit_logs ADD COLUMN errorMessage TEXT";
          break;
        case "metadata":
          sql = "ALTER TABLE audit_logs ADD COLUMN metadata TEXT";
          break;
        case "hash":
          sql = "ALTER TABLE audit_logs ADD COLUMN hash TEXT";
          break;
        case "previousHash":
          sql = "ALTER TABLE audit_logs ADD COLUMN previousHash TEXT";
          break;
        case "isActive":
          sql = "ALTER TABLE audit_logs ADD COLUMN isActive BOOLEAN DEFAULT 1";
          break;
        case "createdAt":
          sql =
            "ALTER TABLE audit_logs ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP";
          break;
      }

      if (sql) {
        console.log(`➕ Adding column ${col}...`);
        db.exec(sql);
        console.log(`✅ Added column ${col}`);
      }
    });
  } else {
    console.log("\n✅ All expected columns are present in audit_logs table");
  }

  console.log("\n✅ Audit logs table fix complete");
} catch (error) {
  console.error("❌ Error fixing audit_logs table:", error);
} finally {
  db.close();
}
