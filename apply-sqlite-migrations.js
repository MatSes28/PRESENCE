#!/usr/bin/env node

import Database from "better-sqlite3";

/**
 * SQLite bootstrap/migration helper.
 *
 * IMPORTANT:
 * - App runtime Drizzle schema uses snake_case columns (e.g. students.student_id).
 * - Earlier SQLite bootstrap created camelCase columns (e.g. students.studentId),
 *   which causes runtime failures like: "no such column: students.student_id".
 *
 * This script:
 * 1) Ensures tables are created with snake_case columns
 * 2) Migrates existing camelCase columns to snake_case via ALTER TABLE RENAME COLUMN
 * 3) Ensures audit_logs exists (required by log aggregation/audit services)
 */

// Initialize SQLite database (allow override)
const dbPath = process.env.SQLITE_PATH || "./server/presence.db";
const db = new Database(dbPath);

console.log("📦 Applying SQLite-specific database migrations...");

try {
  // Enable WAL mode for better performance
  db.pragma("journal_mode = WAL");
  console.log("✅ WAL mode enabled");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  console.log("✅ Foreign keys enabled");

  const getColumns = (tableName) => {
    try {
      return db
        .prepare(
          `PRAGMA table_info(${tableName.replace(/[^a-zA-Z0-9_]/g, "")})`,
        )
        .all()
        .map((c) => c.name);
    } catch {
      return [];
    }
  };

  const renameColumnIfNeeded = (tableName, from, to) => {
    const cols = getColumns(tableName);
    if (!cols.includes(from)) return;
    if (cols.includes(to)) return;
    try {
      db.exec(`ALTER TABLE ${tableName} RENAME COLUMN ${from} TO ${to}`);
      console.log(`✅ Renamed ${tableName}.${from} -> ${to}`);
    } catch (error) {
      console.warn(
        `⚠️  Warning renaming ${tableName}.${from} -> ${to}: ${error.message}`,
      );
    }
  };

  const addColumnIfMissing = (tableName, columnName, columnDefinition) => {
    const cols = getColumns(tableName);
    if (cols.includes(columnName)) return;
    try {
      db.exec(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
      );
      console.log(`✅ Added ${tableName}.${columnName}`);
    } catch (error) {
      console.warn(
        `⚠️  Warning adding ${tableName}.${columnName}: ${error.message}`,
      );
    }
  };

  const migrateCamelToSnake = () => {
    // NOTE: Add mappings only when they exist; the helper checks presence.

    // users
    renameColumnIfNeeded("users", "isActive", "is_active");
    renameColumnIfNeeded("users", "facultyId", "faculty_id");
    // created_at/updated_at already OK in legacy

    // students
    renameColumnIfNeeded("students", "studentId", "student_id");
    renameColumnIfNeeded("students", "rfidUidHash", "rfid_uid_hash");
    renameColumnIfNeeded("students", "rfidUid", "rfid_uid");
    renameColumnIfNeeded("students", "parentEmail", "parent_email");
    renameColumnIfNeeded("students", "parentName", "parent_name");
    renameColumnIfNeeded("students", "isActive", "is_active");
    addColumnIfMissing("students", "rfid_uid_hash", "TEXT");

    // schedules
    renameColumnIfNeeded("schedules", "dayOfWeek", "day_of_week");
    renameColumnIfNeeded("schedules", "startTime", "start_time");
    renameColumnIfNeeded("schedules", "endTime", "end_time");
    renameColumnIfNeeded("schedules", "academicYear", "academic_year");
    renameColumnIfNeeded("schedules", "isRecurring", "is_recurring");
    renameColumnIfNeeded(
      "schedules",
      "recurrencePattern",
      "recurrence_pattern",
    );
    renameColumnIfNeeded(
      "schedules",
      "recurrenceEndDate",
      "recurrence_end_date",
    );
    renameColumnIfNeeded(
      "schedules",
      "recurrenceExceptions",
      "recurrence_exceptions",
    );
    renameColumnIfNeeded(
      "schedules",
      "conflictResolutionPriority",
      "conflict_resolution_priority",
    );
    renameColumnIfNeeded("schedules", "allowRoomChange", "allow_room_change");
    renameColumnIfNeeded(
      "schedules",
      "allowTimeAdjustment",
      "allow_time_adjustment",
    );
    renameColumnIfNeeded("schedules", "isActive", "is_active");

    // class_sessions
    renameColumnIfNeeded("class_sessions", "scheduleId", "schedule_id");
    renameColumnIfNeeded("class_sessions", "isActive", "is_active");

    // attendance_records
    renameColumnIfNeeded("attendance_records", "studentId", "student_id");
    renameColumnIfNeeded(
      "attendance_records",
      "classSessionId",
      "class_session_id",
    );
    renameColumnIfNeeded("attendance_records", "entryTime", "entry_time");
    renameColumnIfNeeded("attendance_records", "exitTime", "exit_time");
    renameColumnIfNeeded("attendance_records", "rfidDetected", "rfid_detected");
    renameColumnIfNeeded(
      "attendance_records",
      "sensorDetected",
      "sensor_detected",
    );
    renameColumnIfNeeded("attendance_records", "isValid", "is_valid");
    renameColumnIfNeeded(
      "attendance_records",
      "discrepancyFlag",
      "discrepancy_flag",
    );
    renameColumnIfNeeded("attendance_records", "isActive", "is_active");

    // computers
    renameColumnIfNeeded("computers", "classroomId", "classroom_id");
    renameColumnIfNeeded("computers", "ipAddress", "ip_address");
    renameColumnIfNeeded("computers", "macAddress", "mac_address");
    renameColumnIfNeeded("computers", "lastMaintenance", "last_maintenance");
    renameColumnIfNeeded("computers", "nextMaintenance", "next_maintenance");
    renameColumnIfNeeded("computers", "maintenanceNotes", "maintenance_notes");
    renameColumnIfNeeded("computers", "isActive", "is_active");

    // computer_assignments
    renameColumnIfNeeded("computer_assignments", "computerId", "computer_id");
    renameColumnIfNeeded("computer_assignments", "studentId", "student_id");
    renameColumnIfNeeded(
      "computer_assignments",
      "classSessionId",
      "class_session_id",
    );
    renameColumnIfNeeded("computer_assignments", "loginTime", "login_time");
    renameColumnIfNeeded("computer_assignments", "logoutTime", "logout_time");
    renameColumnIfNeeded(
      "computer_assignments",
      "sessionDuration",
      "session_duration",
    );
    renameColumnIfNeeded("computer_assignments", "assignedAt", "assigned_at");
    renameColumnIfNeeded("computer_assignments", "releasedAt", "released_at");
    renameColumnIfNeeded("computer_assignments", "isActive", "is_active");

    // enrollments
    renameColumnIfNeeded("enrollments", "studentId", "student_id");
    renameColumnIfNeeded("enrollments", "subjectId", "subject_id");
    renameColumnIfNeeded("enrollments", "academicYear", "academic_year");
    renameColumnIfNeeded("enrollments", "enrolledAt", "enrolled_at");
    renameColumnIfNeeded("enrollments", "isActive", "is_active");

    // email_notifications
    renameColumnIfNeeded("email_notifications", "studentId", "student_id");
    renameColumnIfNeeded(
      "email_notifications",
      "classSessionId",
      "class_session_id",
    );
    renameColumnIfNeeded("email_notifications", "sentAt", "sent_at");
    renameColumnIfNeeded(
      "email_notifications",
      "recipientEmail",
      "recipient_email",
    );
    renameColumnIfNeeded("email_notifications", "isActive", "is_active");

    // classrooms / subjects
    renameColumnIfNeeded("classrooms", "isActive", "is_active");
    renameColumnIfNeeded("subjects", "isActive", "is_active");

    // iot_devices
    renameColumnIfNeeded("iot_devices", "deviceId", "device_id");
    renameColumnIfNeeded("iot_devices", "classroomId", "classroom_id");
    renameColumnIfNeeded("iot_devices", "deviceType", "device_type");
    renameColumnIfNeeded("iot_devices", "sensorType", "sensor_type");
    renameColumnIfNeeded("iot_devices", "mqttTopic", "mqtt_topic");
    renameColumnIfNeeded("iot_devices", "macAddress", "mac_address");
    renameColumnIfNeeded("iot_devices", "firmwareVersion", "firmware_version");
    renameColumnIfNeeded("iot_devices", "lastSeen", "last_seen");
    renameColumnIfNeeded("iot_devices", "batteryLevel", "battery_level");
    renameColumnIfNeeded("iot_devices", "signalStrength", "signal_strength");
    renameColumnIfNeeded(
      "iot_devices",
      "certificateFingerprint",
      "certificate_fingerprint",
    );
    renameColumnIfNeeded("iot_devices", "certificateData", "certificate_data");
    renameColumnIfNeeded("iot_devices", "apiKey", "api_key");
    renameColumnIfNeeded("iot_devices", "isActive", "is_active");

    addColumnIfMissing("iot_devices", "config", "TEXT");
    addColumnIfMissing("iot_devices", "api_key_hash", "TEXT");
    addColumnIfMissing("iot_devices", "certificate", "TEXT");
    addColumnIfMissing("iot_devices", "certificate_expires_at", "TIMESTAMP");
  };

  // 1) Migrate any existing legacy camelCase columns.
  migrateCamelToSnake();

  // 2) Create tables using snake_case column names to match Drizzle schema.
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
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Students table
    `CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      year INTEGER,
      section TEXT,
      program TEXT DEFAULT 'BSIT' NOT NULL,
      department TEXT DEFAULT 'DIT' NOT NULL,
      college TEXT DEFAULT 'College of Engineering' NOT NULL,
      rfid_uid_hash TEXT UNIQUE,
      rfid_uid TEXT UNIQUE,
      parent_email TEXT NOT NULL,
      parent_name TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
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
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Subjects table
    `CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    // Schedules table
    `CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      classroom_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      is_recurring INTEGER DEFAULT 0 NOT NULL,
      recurrence_pattern TEXT,
      recurrence_end_date TIMESTAMP,
      recurrence_exceptions TEXT,
      conflict_resolution_priority INTEGER DEFAULT 1 NOT NULL,
      allow_room_change INTEGER DEFAULT 0 NOT NULL,
      allow_time_adjustment INTEGER DEFAULT 0 NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
      FOREIGN KEY (faculty_id) REFERENCES users(id)
    )`,

    // Class Sessions table
    `CREATE TABLE IF NOT EXISTS class_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      date TIMESTAMP NOT NULL,
      status TEXT DEFAULT 'scheduled' NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    )`,

    // Attendance Records table
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_session_id INTEGER NOT NULL,
      entry_time TIMESTAMP,
      exit_time TIMESTAMP,
      status TEXT,
      rfid_detected INTEGER DEFAULT 0 NOT NULL,
      sensor_detected INTEGER DEFAULT 0 NOT NULL,
      is_valid INTEGER DEFAULT 0 NOT NULL,
      discrepancy_flag INTEGER DEFAULT 0 NOT NULL,
      notes TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_session_id) REFERENCES class_sessions(id)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_session_unique ON attendance_records(student_id, class_session_id)`,

    // Computers table
    `CREATE TABLE IF NOT EXISTS computers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroom_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      ip_address TEXT,
      mac_address TEXT,
      status TEXT DEFAULT 'available' NOT NULL,
      last_maintenance TIMESTAMP,
      next_maintenance TIMESTAMP,
      maintenance_notes TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    )`,

    // Computer Assignments table
    `CREATE TABLE IF NOT EXISTS computer_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computer_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      class_session_id INTEGER NOT NULL,
      login_time TIMESTAMP,
      logout_time TIMESTAMP,
      session_duration INTEGER,
      status TEXT DEFAULT 'assigned' NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      released_at TIMESTAMP,
      is_active INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (computer_id) REFERENCES computers(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_session_id) REFERENCES class_sessions(id)
    )`,

    // IoT Devices table
    `CREATE TABLE IF NOT EXISTS iot_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL UNIQUE,
      name TEXT,
      location TEXT,
      classroom_id INTEGER NOT NULL,
      device_type TEXT NOT NULL,
      sensor_type TEXT,
      mqtt_topic TEXT,
      mac_address TEXT,
      firmware_version TEXT,
      status TEXT DEFAULT 'offline' NOT NULL,
      last_seen TIMESTAMP,
      battery_level INTEGER,
      signal_strength INTEGER,
      config TEXT,
      api_key TEXT NOT NULL UNIQUE,
      api_key_hash TEXT,
      certificate TEXT,
      certificate_expires_at TIMESTAMP,
      certificate_fingerprint TEXT,
      certificate_data TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
    )`,

    // Enrollments table
    `CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      semester TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    )`,

    // Email Notifications table
    `CREATE TABLE IF NOT EXISTS email_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_session_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      recipient_email TEXT NOT NULL,
      message TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_session_id) REFERENCES class_sessions(id)
    )`,

    // Audit Logs table (SQLite)
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      session_id TEXT,
      success INTEGER DEFAULT 1 NOT NULL,
      error_message TEXT,
      metadata TEXT,
      hash TEXT,
      previous_hash TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success)`,

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

    // ==================== GDPR / Privacy / DSAR tables ====================

    `CREATE TABLE IF NOT EXISTS gdpr_consents (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      consent_type TEXT NOT NULL,
      consented INTEGER NOT NULL,
      consent_version TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      justification TEXT,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user_id ON gdpr_consents(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_gdpr_consents_type ON gdpr_consents(consent_type)`,
    `CREATE INDEX IF NOT EXISTS idx_gdpr_consents_created_at ON gdpr_consents(created_at)`,

    `CREATE TABLE IF NOT EXISTS data_subject_requests (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      request_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      requested_by INTEGER NOT NULL,
      reason TEXT,
      corrections TEXT,
      reviewed_by INTEGER,
      review_notes TEXT,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dsr_user_id ON data_subject_requests(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_dsr_status ON data_subject_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_dsr_type ON data_subject_requests(request_type)`,
    `CREATE INDEX IF NOT EXISTS idx_dsr_created_at ON data_subject_requests(created_at)`,

    `CREATE TABLE IF NOT EXISTS parent_consent_requests (
      id TEXT PRIMARY KEY,
      student_id INTEGER NOT NULL,
      parent_email TEXT NOT NULL,
      consent_type TEXT NOT NULL,
      request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      status TEXT DEFAULT 'pending' NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      requested_by INTEGER,
      processed_at TIMESTAMP,
      processed_ip_address TEXT,
      processed_user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_parent_consent_requests_student_id ON parent_consent_requests(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_parent_consent_requests_status ON parent_consent_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_parent_consent_requests_token ON parent_consent_requests(token)`,

    `CREATE TABLE IF NOT EXISTS parent_consents (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      student_id INTEGER NOT NULL,
      parent_email TEXT NOT NULL,
      consent_type TEXT NOT NULL,
      consented INTEGER NOT NULL,
      consent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      consent_version TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      expires_at TIMESTAMP,
      revoked_at TIMESTAMP,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (request_id) REFERENCES parent_consent_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_parent_consents_student_id ON parent_consents(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_parent_consents_type ON parent_consents(consent_type)`,
    `CREATE INDEX IF NOT EXISTS idx_parent_consents_consent_date ON parent_consents(consent_date)`,

    `CREATE TABLE IF NOT EXISTS privacy_audit_logs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      data_accessed TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      justification TEXT NOT NULL,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_privacy_audit_user_id ON privacy_audit_logs(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_privacy_audit_action ON privacy_audit_logs(action)`,
    `CREATE INDEX IF NOT EXISTS idx_privacy_audit_created_at ON privacy_audit_logs(created_at)`,

    `CREATE TABLE IF NOT EXISTS legal_holds (
      id TEXT PRIMARY KEY,
      subject_user_id INTEGER NOT NULL,
      scope TEXT DEFAULT 'erasure' NOT NULL,
      reason TEXT NOT NULL,
      active INTEGER DEFAULT 1 NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      expires_at TIMESTAMP,
      FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_legal_holds_subject ON legal_holds(subject_user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_legal_holds_active ON legal_holds(active)`,

    `CREATE TABLE IF NOT EXISTS attendance_records_archive (
      id INTEGER PRIMARY KEY,
      student_id INTEGER NOT NULL,
      class_session_id INTEGER NOT NULL,
      entry_time TIMESTAMP,
      exit_time TIMESTAMP,
      status TEXT,
      rfid_detected INTEGER DEFAULT 0 NOT NULL,
      sensor_detected INTEGER DEFAULT 0 NOT NULL,
      is_valid INTEGER DEFAULT 0 NOT NULL,
      discrepancy_flag INTEGER DEFAULT 0 NOT NULL,
      notes TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP,
      updated_at TIMESTAMP,
      archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_records_archive_student_id ON attendance_records_archive(student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_attendance_records_archive_session_id ON attendance_records_archive(class_session_id)`,

    `CREATE TABLE IF NOT EXISTS audit_logs_archive (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      session_id TEXT,
      success INTEGER DEFAULT 1 NOT NULL,
      error_message TEXT,
      metadata TEXT,
      hash TEXT,
      previous_hash TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_timestamp ON audit_logs_archive(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user_id ON audit_logs_archive(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_action ON audit_logs_archive(action)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_resource ON audit_logs_archive(resource)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_resource_id ON audit_logs_archive(resource_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_success ON audit_logs_archive(success)`,

    // ==================== Enterprise integrations ====================

    `CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT DEFAULT 'custom' NOT NULL,
      provider TEXT DEFAULT 'custom' NOT NULL,
      config TEXT DEFAULT '{}' NOT NULL,
      enabled INTEGER DEFAULT 0 NOT NULL,
      last_sync_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_integrations_kind ON integrations(kind)`,
    `CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider)`,

    `CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS integration_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      integration_id INTEGER NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT DEFAULT 'running' NOT NULL,
      idempotency_key TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      finished_at TIMESTAMP,
      stats TEXT DEFAULT '{}' NOT NULL,
      error TEXT,
      FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_integration_id ON integration_sync_runs(integration_id)`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_status ON integration_sync_runs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_started_at ON integration_sync_runs(started_at)`,

    `CREATE TABLE IF NOT EXISTS integration_sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      action TEXT NOT NULL,
      external_id TEXT,
      local_id TEXT,
      status TEXT DEFAULT 'ok' NOT NULL,
      message TEXT,
      diff TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (run_id) REFERENCES integration_sync_runs(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_events_run_id ON integration_sync_events(run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_events_entity_type ON integration_sync_events(entity_type)`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_events_status ON integration_sync_events(status)`,
    `CREATE INDEX IF NOT EXISTS idx_integration_sync_events_created_at ON integration_sync_events(created_at)`,
  ];

  // Apply each table creation
  for (const tableSql of tables) {
    try {
      db.exec(tableSql);
      const tableMatch = tableSql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      const indexMatch = tableSql.match(/CREATE INDEX IF NOT EXISTS (\w+)/);
      if (tableMatch?.[1]) {
        console.log(`✅ Created table: ${tableMatch[1]}`);
      } else if (indexMatch?.[1]) {
        console.log(`✅ Created index: ${indexMatch[1]}`);
      } else {
        console.log("✅ Applied statement");
      }
    } catch (error) {
      console.warn(`⚠️  Warning creating table: ${error.message}`);
    }
  }

  addColumnIfMissing("students", "rfid_uid_hash", "TEXT");
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS students_rfid_uid_hash_unique ON students(rfid_uid_hash)",
  );

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
