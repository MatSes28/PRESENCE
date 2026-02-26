#!/usr/bin/env node

import Database from "better-sqlite3";

// Initialize SQLite database
const dbPath = "./server/presence.db";
const db = new Database(dbPath);

console.log("📦 Applying SQLite-specific database migrations...");

try {
  // Enable WAL mode for better performance
  db.pragma("journal_mode = WAL");
  console.log("✅ WAL mode enabled");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  console.log("✅ Foreign keys enabled");

  // SQLite-compatible schema (converting PostgreSQL types to SQLite)
  const tables = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'faculty' NOT NULL,
      faculty_id TEXT,
      department TEXT,
      gender TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Students table
    `CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      year INTEGER,
      section TEXT,
      program TEXT DEFAULT 'BSIT' NOT NULL,
      department TEXT DEFAULT 'DIT' NOT NULL,
      college TEXT DEFAULT 'College of Engineering' NOT NULL,
      rfidUid TEXT UNIQUE,
      parentEmail TEXT NOT NULL,
      parentName TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Classrooms table
    `CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT DEFAULT 'CLIRDEC Building' NOT NULL,
      type TEXT DEFAULT 'lecture' NOT NULL,
      capacity INTEGER,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Subjects table
    `CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Schedules table
    `CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      classroom_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      dayOfWeek INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      semester TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      isRecurring INTEGER DEFAULT 0 NOT NULL,
      recurrencePattern TEXT,
      recurrenceEndDate TIMESTAMP,
      recurrenceExceptions TEXT,
      conflictResolutionPriority INTEGER DEFAULT 1 NOT NULL,
      allowRoomChange INTEGER DEFAULT 0 NOT NULL,
      allowTimeAdjustment INTEGER DEFAULT 0 NOT NULL,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
      FOREIGN KEY (faculty_id) REFERENCES users(id)
    )`,

    // Class Sessions table
    `CREATE TABLE IF NOT EXISTS class_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduleId INTEGER NOT NULL,
      date TIMESTAMP NOT NULL,
      status TEXT DEFAULT 'scheduled' NOT NULL,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (scheduleId) REFERENCES schedules(id)
    )`,

    // Attendance Records table
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      classSessionId INTEGER NOT NULL,
      entryTime TIMESTAMP,
      exitTime TIMESTAMP,
      status TEXT,
      rfidDetected INTEGER DEFAULT 0 NOT NULL,
      sensorDetected INTEGER DEFAULT 0 NOT NULL,
      isValid INTEGER DEFAULT 0 NOT NULL,
      discrepancyFlag INTEGER DEFAULT 0 NOT NULL,
      notes TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (classSessionId) REFERENCES class_sessions(id)
    )`,

    // Computers table
    `CREATE TABLE IF NOT EXISTS computers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroomId INTEGER NOT NULL,
      name TEXT NOT NULL,
      ipAddress TEXT,
      macAddress TEXT,
      status TEXT DEFAULT 'available' NOT NULL,
      lastMaintenance TIMESTAMP,
      nextMaintenance TIMESTAMP,
      maintenanceNotes TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (classroomId) REFERENCES classrooms(id)
    )`,

    // Computer Assignments table
    `CREATE TABLE IF NOT EXISTS computer_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computerId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      classSessionId INTEGER NOT NULL,
      loginTime TIMESTAMP,
      logoutTime TIMESTAMP,
      sessionDuration INTEGER,
      status TEXT DEFAULT 'assigned' NOT NULL,
      assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      releasedAt TIMESTAMP,
      isActive INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (computerId) REFERENCES computers(id),
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (classSessionId) REFERENCES class_sessions(id)
    )`,

    // IoT Devices table
    `CREATE TABLE IF NOT EXISTS iot_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId TEXT NOT NULL UNIQUE,
      name TEXT,
      location TEXT,
      classroomId INTEGER NOT NULL,
      deviceType TEXT NOT NULL,
      sensorType TEXT,
      mqttTopic TEXT,
      macAddress TEXT,
      firmwareVersion TEXT,
      status TEXT DEFAULT 'offline' NOT NULL,
      lastSeen TIMESTAMP,
      batteryLevel INTEGER,
      signalStrength INTEGER,
      config TEXT,
      apiKey TEXT NOT NULL UNIQUE,
      certificateFingerprint TEXT,
      certificateData TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (classroomId) REFERENCES classrooms(id)
    )`,

    // Enrollments table
    `CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      subjectId INTEGER NOT NULL,
      semester TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      enrolledAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      isActive INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (subjectId) REFERENCES subjects(id)
    )`,

    // Email Notifications table
    `CREATE TABLE IF NOT EXISTS email_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      classSessionId INTEGER NOT NULL,
      type TEXT NOT NULL,
      sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      recipientEmail TEXT NOT NULL,
      message TEXT,
      isActive INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (studentId) REFERENCES students(id),
      FOREIGN KEY (classSessionId) REFERENCES class_sessions(id)
    )`,

    // Password reset tokens (hashed + expiry + single-use)
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      requested_ip TEXT,
      requested_user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  ];

  // Apply each table creation
  for (const tableSql of tables) {
    try {
      db.exec(tableSql);
      const tableName = tableSql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      console.log(`✅ Created table: ${tableName}`);
    } catch (error) {
      console.warn(`⚠️  Warning creating table: ${error.message}`);
    }
  }

  console.log("✅ Database migrations applied successfully!");

  // Verify tables were created
  const tablesResult = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  console.log("📊 Created tables:", tablesResult.map((t) => t.name).join(", "));
} catch (error) {
  console.error("❌ Failed to apply migrations:", error);
  process.exit(1);
} finally {
  db.close();
}
