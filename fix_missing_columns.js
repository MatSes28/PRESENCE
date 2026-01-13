const Database = require("better-sqlite3");

console.log("🔧 Fixing missing database columns...\n");

// Connect to the SQLite database
const dbPath = "./server/presence.db";
const db = new Database(dbPath);

try {
  // Check if columns exist and add them if missing

  // 1. Add timestamp column to audit_logs if it doesn't exist
  console.log("🔍 Checking audit_logs table...");
  const auditLogsColumns = db.prepare("PRAGMA table_info(audit_logs)").all();
  const hasTimestamp = auditLogsColumns.some((col) => col.name === "timestamp");

  if (!hasTimestamp) {
    console.log("➕ Adding timestamp column to audit_logs...");
    db.exec(
      "ALTER TABLE audit_logs ADD COLUMN timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    );
    console.log("✅ Added timestamp column to audit_logs");
  } else {
    console.log("✅ audit_logs already has timestamp column");
  }

  // 2. Add is_active column to users if it doesn't exist
  console.log("\n🔍 Checking users table...");
  const usersColumns = db.prepare("PRAGMA table_info(users)").all();
  const hasIsActive = usersColumns.some((col) => col.name === "is_active");

  if (!hasIsActive) {
    console.log("➕ Adding is_active column to users...");
    db.exec("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1");
    console.log("✅ Added is_active column to users");
  } else {
    console.log("✅ users already has is_active column");
  }

  // 3. Add is_active column to students if it doesn't exist
  console.log("\n🔍 Checking students table...");
  const studentsColumns = db.prepare("PRAGMA table_info(students)").all();
  const hasStudentIsActive = studentsColumns.some(
    (col) => col.name === "is_active"
  );

  if (!hasStudentIsActive) {
    console.log("➕ Adding is_active column to students...");
    db.exec("ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT 1");
    console.log("✅ Added is_active column to students");
  } else {
    console.log("✅ students already has is_active column");
  }

  // 4. Add is_active column to classrooms if it doesn't exist
  console.log("\n🔍 Checking classrooms table...");
  const classroomsColumns = db.prepare("PRAGMA table_info(classrooms)").all();
  const hasClassroomIsActive = classroomsColumns.some(
    (col) => col.name === "is_active"
  );

  if (!hasClassroomIsActive) {
    console.log("➕ Adding is_active column to classrooms...");
    db.exec("ALTER TABLE classrooms ADD COLUMN is_active BOOLEAN DEFAULT 1");
    console.log("✅ Added is_active column to classrooms");
  } else {
    console.log("✅ classrooms already has is_active column");
  }

  // 5. Add is_active column to subjects if it doesn't exist
  console.log("\n🔍 Checking subjects table...");
  const subjectsColumns = db.prepare("PRAGMA table_info(subjects)").all();
  const hasSubjectIsActive = subjectsColumns.some(
    (col) => col.name === "is_active"
  );

  if (!hasSubjectIsActive) {
    console.log("➕ Adding is_active column to subjects...");
    db.exec("ALTER TABLE subjects ADD COLUMN is_active BOOLEAN DEFAULT 1");
    console.log("✅ Added is_active column to subjects");
  } else {
    console.log("✅ subjects already has is_active column");
  }

  console.log("\n✅ All missing columns have been added successfully!");
  console.log("🔧 Database migration complete");
} catch (error) {
  console.error("❌ Error fixing database columns:", error);
} finally {
  db.close();
}
