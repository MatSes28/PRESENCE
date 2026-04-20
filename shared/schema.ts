import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  uuid,
  serial,
  varchar,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table (Faculty/Admin)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("faculty"), // admin, faculty
  facultyId: varchar("faculty_id", { length: 50 }),
  department: varchar("department", { length: 255 }),
  gender: varchar("gender", { length: 20 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Students table - Limited to BSIT students from DIT under College of Engineering
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  year: integer("year"),
  section: varchar("section", { length: 50 }),
  program: varchar("program", { length: 100 }).default("BSIT").notNull(), // Always BSIT
  department: varchar("department", { length: 100 }).default("DIT").notNull(), // Always DIT
  college: varchar("college", { length: 100 })
    .default("College of Engineering")
    .notNull(), // Always College of Engineering
  /**
   * Deterministic lookup token for RFID UID (HMAC-SHA256).
   * Used for uniqueness + lookups without storing plaintext UIDs.
   */
  rfidUidHash: varchar("rfid_uid_hash", { length: 64 }).unique(),
  rfidUid: text("rfid_uid"),
  parentEmail: text("parent_email").notNull(), // Encrypted at rest; ciphertext can exceed email length.
  parentName: text("parent_name"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Classrooms table - Limited to 4 CLIRDEC classrooms
export const classrooms = pgTable("classrooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 })
    .default("CLIRDEC Building")
    .notNull(), // Always CLIRDEC Building
  type: varchar("type", { length: 50 }).default("lecture").notNull(), // lecture, laboratory
  capacity: integer("capacity"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schedules table
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id")
    .references(() => subjects.id)
    .notNull(),
  classroomId: integer("classroom_id")
    .references(() => classrooms.id)
    .notNull(),
  facultyId: integer("faculty_id")
    .references(() => users.id)
    .notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  startTime: varchar("start_time", { length: 10 }).notNull(), // HH:MM format
  endTime: varchar("end_time", { length: 10 }).notNull(),
  semester: varchar("semester", { length: 50 }).notNull(),
  academicYear: varchar("academic_year", { length: 20 }).notNull(),
  // Recurring schedule fields
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrencePattern: varchar("recurrence_pattern", { length: 20 }), // weekly, biweekly, monthly
  recurrenceEndDate: timestamp("recurrence_end_date"),
  recurrenceExceptions: jsonb("recurrence_exceptions"), // Dates to skip
  // Conflict resolution
  conflictResolutionPriority: integer("conflict_resolution_priority")
    .default(1)
    .notNull(), // 1-10, higher = more important
  allowRoomChange: boolean("allow_room_change").default(false).notNull(),
  allowTimeAdjustment: boolean("allow_time_adjustment")
    .default(false)
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const academicHolidays = pgTable("academic_holidays", {
  id: serial("id").primaryKey(),
  holidayDate: varchar("holiday_date", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  recursAnnually: boolean("recurs_annually").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Class Sessions table (auto-generated from schedules)
export const classSessions = pgTable("class_sessions", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id")
    .references(() => schedules.id)
    .notNull(),
  date: timestamp("date").notNull(),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(), // scheduled, active, completed
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Attendance Records table (one record per student per class session)
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .references(() => students.id)
      .notNull(),
    classSessionId: integer("class_session_id")
      .references(() => classSessions.id)
      .notNull(),
    entryTime: timestamp("entry_time"),
    exitTime: timestamp("exit_time"),
    status: varchar("status", { length: 20 }), // present, late, absent
    rfidDetected: boolean("rfid_detected").default(false).notNull(),
    sensorDetected: boolean("sensor_detected").default(false).notNull(),
    isValid: boolean("is_valid").default(false).notNull(),
    discrepancyFlag: boolean("discrepancy_flag").default(false).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    studentSessionUnique: unique().on(t.studentId, t.classSessionId),
  })
);

// Computers table (for lab management)
export const computers = pgTable("computers", {
  id: serial("id").primaryKey(),
  classroomId: integer("classroom_id")
    .references(() => classrooms.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  macAddress: varchar("mac_address", { length: 17 }),
  status: varchar("status", { length: 20 }).default("available").notNull(), // available, in_use, maintenance
  lastMaintenance: timestamp("last_maintenance"),
  nextMaintenance: timestamp("next_maintenance"),
  maintenanceNotes: text("maintenance_notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Computer Maintenance Records table
export const computerMaintenance = pgTable("computer_maintenance", {
  id: serial("id").primaryKey(),
  computerId: integer("computer_id")
    .references(() => computers.id)
    .notNull(),
  maintenanceType: varchar("maintenance_type", { length: 50 }).notNull(), // preventive, corrective, upgrade
  description: text("description").notNull(),
  performedBy: integer("performed_by")
    .references(() => users.id)
    .notNull(),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(), // scheduled, in_progress, completed, cancelled
  cost: integer("cost"), // Cost in cents
  parts: jsonb("parts"), // Parts used/replaced
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Computer Assignments table - Enhanced for usage monitoring
export const computerAssignments = pgTable("computer_assignments", {
  id: serial("id").primaryKey(),
  computerId: integer("computer_id")
    .references(() => computers.id)
    .notNull(),
  studentId: integer("student_id")
    .references(() => students.id)
    .notNull(),
  classSessionId: integer("class_session_id")
    .references(() => classSessions.id)
    .notNull(),
  loginTime: timestamp("login_time"), // When student starts using computer
  logoutTime: timestamp("logout_time"), // When student stops using computer
  sessionDuration: integer("session_duration"), // Duration in minutes
  status: varchar("status", { length: 20 }).default("assigned").notNull(), // assigned, active, completed
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
  isActive: boolean("is_active").default(true).notNull(),
});

// IoT Devices table
export const iotDevices = pgTable("iot_devices", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  location: varchar("location", { length: 255 }),
  classroomId: integer("classroom_id")
    .references(() => classrooms.id)
    .notNull(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // esp32_s3
  sensorType: varchar("sensor_type", { length: 50 }), // fingerprint, rfid, face_recognition, dual_sensor
  mqttTopic: varchar("mqtt_topic", { length: 255 }),
  macAddress: varchar("mac_address", { length: 17 }),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  status: varchar("status", { length: 20 }).default("offline").notNull(), // online, offline, maintenance
  lastSeen: timestamp("last_seen"),
  batteryLevel: integer("battery_level"),
  signalStrength: integer("signal_strength"),
  config: jsonb("config"),
  // Security fields
  apiKey: varchar("api_key", { length: 128 }).notNull().unique(),
  certificateFingerprint: varchar("certificate_fingerprint", { length: 128 }),
  certificateData: text("certificate_data"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const iotDeviceHeartbeats = pgTable("iot_device_heartbeats", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 100 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  batteryLevel: integer("battery_level"),
  signalStrength: integer("signal_strength"),
  temperature: integer("temperature"),
  uptime: integer("uptime"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").default(true).notNull(),
});

// Enrollments table
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => students.id)
    .notNull(),
  subjectId: integer("subject_id")
    .references(() => subjects.id)
    .notNull(),
  semester: varchar("semester", { length: 50 }).notNull(),
  academicYear: varchar("academic_year", { length: 20 }).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Email Notifications table
export const emailNotifications = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => students.id)
    .notNull(),
  classSessionId: integer("class_session_id")
    .references(() => classSessions.id)
    .notNull(),
  type: varchar("type", { length: 20 }).notNull(), // absent, late
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  message: text("message"),
  isActive: boolean("is_active").default(true).notNull(),
});

// Push Notifications table
export const pushNotifications = pgTable("push_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // attendance, assignment, alert, reminder, achievement
  data: jsonb("data"), // Additional data for the notification
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// User Sessions table (for advanced session management)
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// =============================================================================
// GDPR / Privacy / DSAR (Data Subject Access Requests)
// =============================================================================

export const gdprConsents = pgTable("gdpr_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  consentType: varchar("consent_type", { length: 64 }).notNull(),
  consented: boolean("consented").notNull(),
  consentVersion: varchar("consent_version", { length: 32 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  justification: text("justification"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
});

export const dataSubjectRequests = pgTable("data_subject_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  requestType: varchar("request_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  requestedBy: integer("requested_by")
    .references(() => users.id)
    .notNull(),
  reason: text("reason"),
  corrections: jsonb("corrections"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const privacyAuditLogs = pgTable("privacy_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  dataAccessed: text("data_accessed").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  justification: text("justification").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Legal hold prevents or delays erasure/export actions.
export const legalHolds = pgTable("legal_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectUserId: integer("subject_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  scope: varchar("scope", { length: 32 }).notNull().default("erasure"),
  reason: text("reason").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// =============================================================================
// Audit log archive (retention tier)
// =============================================================================

export const auditLogsArchive = pgTable("audit_logs_archive", {
  id: uuid("id").primaryKey().defaultRandom(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 255 }),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  hash: varchar("hash", { length: 128 }),
  previousHash: varchar("previous_hash", { length: 128 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// =============================================================================
// Enterprise integrations (SIS/LMS/HR/SSO tooling)
// =============================================================================

// Integration configurations are stored in the database (not environment variables)
// to support multi-tenant-like setups, safe change management, and auditable operations.
export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  // Example values: sis, lms, hr, oidc, saml, scim, custom
  kind: varchar("kind", { length: 50 }).notNull().default("custom"),
  // Provider identifier, e.g., banner, peopleSoft, moodle, canvas, azure_ad, okta
  provider: varchar("provider", { length: 100 }).notNull().default("custom"),
  // DB-backed configuration (endpoints, field mapping, options). Do not store raw secrets in plaintext.
  config: jsonb("config").notNull().default({}),
  enabled: boolean("enabled").default(false).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A run is one execution of a sync/export/provision job.
export const integrationSyncRuns = pgTable("integration_sync_runs", {
  id: serial("id").primaryKey(),
  integrationId: integer("integration_id")
    .references(() => integrations.id, { onDelete: "cascade" })
    .notNull(),
  jobType: varchar("job_type", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("running"), // running, success, failed
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  stats: jsonb("stats").notNull().default({}),
  error: text("error"),
});

// Optional per-item audit trail for reconciliation/debugging (can be sampled at scale).
export const integrationSyncEvents = pgTable("integration_sync_events", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .references(() => integrationSyncRuns.id, { onDelete: "cascade" })
    .notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // user, student, schedule, enrollment, attendance
  action: varchar("action", { length: 50 }).notNull(), // upsert, deactivate, export, reconcile
  externalId: varchar("external_id", { length: 255 }),
  localId: varchar("local_id", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("ok"), // ok, skipped, error
  message: text("message"),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Push Subscriptions table (for web push API)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Subject Sessions table - For lab session management
export const subjectSessions = pgTable("subject_sessions", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id")
    .references(() => subjects.id)
    .notNull(),
  classroomId: integer("classroom_id")
    .references(() => classrooms.id)
    .notNull(),
  facultyId: integer("faculty_id")
    .references(() => users.id)
    .notNull(),
  sessionDate: timestamp("session_date").notNull(),
  layoutConfig: jsonb("layout_config"), // Store computer arrangement preferences
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, completed, archived
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Session Assignments table - Computer assignments per subject session
export const sessionAssignments = pgTable("session_assignments", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .references(() => subjectSessions.id)
    .notNull(),
  computerId: integer("computer_id")
    .references(() => computers.id)
    .notNull(),
  studentId: integer("student_id").references(() => students.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
  status: varchar("status", { length: 20 }).default("assigned").notNull(), // assigned, occupied, released
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  schedules: many(schedules),
  sessions: many(userSessions),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  attendanceRecords: many(attendanceRecords),
  computerAssignments: many(computerAssignments),
  enrollments: many(enrollments),
  emailNotifications: many(emailNotifications),
}));

export const classroomsRelations = relations(classrooms, ({ many }) => ({
  schedules: many(schedules),
  computers: many(computers),
  iotDevices: many(iotDevices),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  schedules: many(schedules),
  enrollments: many(enrollments),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [schedules.subjectId],
    references: [subjects.id],
  }),
  classroom: one(classrooms, {
    fields: [schedules.classroomId],
    references: [classrooms.id],
  }),
  faculty: one(users, {
    fields: [schedules.facultyId],
    references: [users.id],
  }),
  classSessions: many(classSessions),
}));

export const classSessionsRelations = relations(
  classSessions,
  ({ one, many }) => ({
    schedule: one(schedules, {
      fields: [classSessions.scheduleId],
      references: [schedules.id],
    }),
    attendanceRecords: many(attendanceRecords),
    computerAssignments: many(computerAssignments),
    emailNotifications: many(emailNotifications),
  }),
);

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    student: one(students, {
      fields: [attendanceRecords.studentId],
      references: [students.id],
    }),
    classSession: one(classSessions, {
      fields: [attendanceRecords.classSessionId],
      references: [classSessions.id],
    }),
  }),
);

export const computersRelations = relations(computers, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [computers.classroomId],
    references: [classrooms.id],
  }),
  assignments: many(computerAssignments),
  maintenanceRecords: many(computerMaintenance),
}));

export const computerAssignmentsRelations = relations(
  computerAssignments,
  ({ one }) => ({
    computer: one(computers, {
      fields: [computerAssignments.computerId],
      references: [computers.id],
    }),
    student: one(students, {
      fields: [computerAssignments.studentId],
      references: [students.id],
    }),
    classSession: one(classSessions, {
      fields: [computerAssignments.classSessionId],
      references: [classSessions.id],
    }),
  }),
);

export const iotDevicesRelations = relations(iotDevices, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [iotDevices.classroomId],
    references: [classrooms.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, {
    fields: [enrollments.studentId],
    references: [students.id],
  }),
  subject: one(subjects, {
    fields: [enrollments.subjectId],
    references: [subjects.id],
  }),
}));

export const emailNotificationsRelations = relations(
  emailNotifications,
  ({ one }) => ({
    student: one(students, {
      fields: [emailNotifications.studentId],
      references: [students.id],
    }),
    classSession: one(classSessions, {
      fields: [emailNotifications.classSessionId],
      references: [classSessions.id],
    }),
  }),
);

export const subjectSessionsRelations = relations(
  subjectSessions,
  ({ one, many }) => ({
    subject: one(subjects, {
      fields: [subjectSessions.subjectId],
      references: [subjects.id],
    }),
    classroom: one(classrooms, {
      fields: [subjectSessions.classroomId],
      references: [classrooms.id],
    }),
    faculty: one(users, {
      fields: [subjectSessions.facultyId],
      references: [users.id],
    }),
    assignments: many(sessionAssignments),
  }),
);

export const sessionAssignmentsRelations = relations(
  sessionAssignments,
  ({ one }) => ({
    session: one(subjectSessions, {
      fields: [sessionAssignments.sessionId],
      references: [subjectSessions.id],
    }),
    computer: one(computers, {
      fields: [sessionAssignments.computerId],
      references: [computers.id],
    }),
    student: one(students, {
      fields: [sessionAssignments.studentId],
      references: [students.id],
    }),
  }),
);

export const computerMaintenanceRelations = relations(
  computerMaintenance,
  ({ one }) => ({
    computer: one(computers, {
      fields: [computerMaintenance.computerId],
      references: [computers.id],
    }),
    performedBy: one(users, {
      fields: [computerMaintenance.performedBy],
      references: [users.id],
    }),
  }),
);

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type Classroom = typeof classrooms.$inferSelect;
export type NewClassroom = typeof classrooms.$inferInsert;

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;

export type ClassSession = typeof classSessions.$inferSelect;
export type NewClassSession = typeof classSessions.$inferInsert;

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;

export type Computer = typeof computers.$inferSelect;
export type NewComputer = typeof computers.$inferInsert;

export type ComputerAssignment = typeof computerAssignments.$inferSelect;
export type NewComputerAssignment = typeof computerAssignments.$inferInsert;

export type IotDevice = typeof iotDevices.$inferSelect;
export type NewIotDevice = typeof iotDevices.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type NewEmailNotification = typeof emailNotifications.$inferInsert;

export type SubjectSession = typeof subjectSessions.$inferSelect;
export type NewSubjectSession = typeof subjectSessions.$inferInsert;

export type SessionAssignment = typeof sessionAssignments.$inferSelect;
export type NewSessionAssignment = typeof sessionAssignments.$inferInsert;

export type ComputerMaintenance = typeof computerMaintenance.$inferSelect;
export type NewComputerMaintenance = typeof computerMaintenance.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
