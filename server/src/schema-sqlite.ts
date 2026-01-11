import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ==================== Core Schema ====================

// Users table
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: text("role").notNull().default("user"), // admin, faculty, staff, user
    department: text("department"),
    employeeId: text("employee_id"),
    phone: text("phone"),
    avatar: text("avatar"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLogin: text("last_login"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ]
);

// Students table
export const students = sqliteTable(
  "students",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: text("student_id").notNull().unique(),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    department: text("department").notNull(),
    year: integer("year"),
    section: text("section"),
    phone: text("phone"),
    rfidCardId: text("rfid_card_id").unique(),
    faceId: text("face_id"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("students_student_id_idx").on(table.studentId),
    index("students_email_idx").on(table.email),
    index("students_rfid_idx").on(table.rfidCardId),
  ]
);

// Subjects table
export const subjects = sqliteTable(
  "subjects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    units: integer("units").default(3),
    hoursPerWeek: real("hours_per_week"),
    department: text("department").notNull(),
    instructorId: integer("instructor_id").references(() => users.id),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("subjects_code_idx").on(table.code),
    index("subjects_department_idx").on(table.department),
  ]
);

// Schedules table
export const schedules = sqliteTable(
  "schedules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id),
    instructorId: integer("instructor_id").references(() => users.id),
    dayOfWeek: text("day_of_week").notNull(), // 'Monday', 'Tuesday', etc.
    startTime: text("start_time").notNull(), // HH:MM format
    endTime: text("end_time").notNull(),
    room: text("room").notNull(),
    building: text("building"),
    semester: text("semester").notNull(),
    academicYear: text("academic_year").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("schedules_subject_idx").on(table.subjectId),
    index("schedules_instructor_idx").on(table.instructorId),
    index("schedules_day_time_idx").on(
      table.dayOfWeek,
      table.startTime,
      table.endTime
    ),
  ]
);

// Enrollments table
export const enrollments = sqliteTable(
  "enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id),
    scheduleId: integer("schedule_id").references(() => schedules.id),
    enrolledAt: text("enrolled_at").notNull().default("CURRENT_TIMESTAMP"),
    status: text("status").notNull().default("active"), // active, completed, dropped
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("enrollments_student_idx").on(table.studentId),
    index("enrollments_subject_idx").on(table.subjectId),
    index("enrollments_schedule_idx").on(table.scheduleId),
  ]
);

// Attendance Records table
export const attendanceRecords = sqliteTable(
  "attendance_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id),
    scheduleId: integer("schedule_id").references(() => schedules.id),
    date: text("date").notNull(), // YYYY-MM-DD format
    checkInTime: text("check_in_time"),
    checkOutTime: text("check_out_time"),
    status: text("status").notNull(), // present, absent, late, excused, early
    method: text("method").default("rfid"), // rfid, manual, face, mobile, wifi
    deviceId: text("device_id"),
    location: text("location"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("attendance_student_date_idx").on(table.studentId, table.date),
    index("attendance_subject_date_idx").on(table.subjectId, table.date),
    index("attendance_schedule_date_idx").on(table.scheduleId, table.date),
    index("attendance_date_idx").on(table.date),
  ]
);

// ==================== Device & IoT Tables ====================

// IoT Devices table
export const iotDevices = sqliteTable(
  "iot_devices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: text("device_id").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull(), // rfid_reader, biometric, gateway, sensor
    model: text("model"),
    location: text("location").notNull(),
    room: text("room"),
    building: text("building"),
    status: text("status").notNull().default("offline"), // online, offline, maintenance
    lastHeartbeat: text("last_heartbeat"),
    lastSyncTime: text("last_sync_time"),
    firmwareVersion: text("firmware_version"),
    ipAddress: text("ip_address"),
    macAddress: text("mac_address"),
    config: text("config"), // JSON config
    metadata: text("metadata"), // JSON metadata
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("iot_devices_device_id_idx").on(table.deviceId),
    index("iot_devices_type_idx").on(table.type),
    index("iot_devices_location_idx").on(table.location),
    index("iot_devices_status_idx").on(table.status),
  ]
);

// Device Logs table
export const deviceLogs = sqliteTable(
  "device_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: text("device_id").notNull(),
    level: text("level").notNull(), // info, warn, error
    message: text("message").notNull(),
    data: text("data"), // JSON data
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("device_logs_device_idx").on(table.deviceId),
    index("device_logs_created_idx").on(table.createdAt),
  ]
);

// ==================== Integration Tables ====================

// API Keys table
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    secret: text("secret").notNull(),
    permissions: text("permissions").notNull(), // JSON array
    rateLimit: integer("rate_limit").default(1000), // requests per hour
    expiresAt: text("expires_at"),
    lastUsedAt: text("last_used_at"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("api_keys_key_idx").on(table.key),
    index("api_keys_created_by_idx").on(table.createdBy),
  ]
);

// Integration Logs table
export const integrationLogs = sqliteTable(
  "integration_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    apiKeyId: integer("api_key_id").references(() => apiKeys.id),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    requestBody: text("request_body"),
    responseStatus: integer("response_status"),
    responseTime: integer("response_time"), // ms
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("integration_logs_endpoint_idx").on(table.endpoint),
    index("integration_logs_created_idx").on(table.createdAt),
    index("integration_logs_api_key_idx").on(table.apiKeyId),
  ]
);

// ==================== System Tables ====================

// Audit Logs table
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    oldValues: text("old_values"), // JSON
    newValues: text("new_values"), // JSON
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("audit_logs_user_idx").on(table.userId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_idx").on(table.createdAt),
  ]
);

// Notifications table
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull(), // info, warning, error, success
    category: text("category"), // attendance, schedule, system
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    actionUrl: text("action_url"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_read_idx").on(table.isRead),
    index("notifications_created_idx").on(table.createdAt),
  ]
);

// System Settings table
export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  type: text("type").default("string"), // string, number, boolean, json
  description: text("description"),
  isSecret: integer("is_secret", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Sessions table
export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_token_idx").on(table.token),
  ]
);

// ==================== Analytics Tables ====================

// Daily Attendance Summary table
export const dailyAttendanceSummary = sqliteTable(
  "daily_attendance_summary",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    subjectId: integer("subject_id").references(() => subjects.id),
    totalStudents: integer("total_students").notNull(),
    presentCount: integer("present_count").notNull(),
    absentCount: integer("absent_count").notNull(),
    lateCount: integer("late_count").notNull(),
    excusedCount: integer("excused_count").notNull(),
    attendanceRate: real("attendance_rate").notNull(),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("daily_summary_date_idx").on(table.date),
    index("daily_summary_subject_idx").on(table.subjectId),
  ]
);

// ==================== Faculty & Staff Tables ====================

// Faculty table (extended user info for instructors)
export const faculty = sqliteTable(
  "faculty",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    employeeId: text("employee_id").notNull().unique(),
    department: text("department").notNull(),
    position: text("position"),
    specializations: text("specializations"), // JSON array
    officeLocation: text("office_location"),
    consultationHours: text("consultation_hours"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("faculty_user_idx").on(table.userId),
    index("faculty_department_idx").on(table.department),
  ]
);

// ==================== Computer Lab Tables ====================

// Lab Computers table
export const labComputers = sqliteTable(
  "lab_computers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    computerName: text("computer_name").notNull(),
    labName: text("lab_name").notNull(),
    location: text("location").notNull(),
    macAddress: text("mac_address").unique(),
    ipAddress: text("ip_address"),
    operatingSystem: text("operating_system"),
    status: text("status").notNull().default("offline"), // online, offline, in_use, maintenance
    currentUser: text("current_user"),
    lastActivity: text("last_activity"),
    specifications: text("specifications"), // JSON
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("lab_computers_lab_idx").on(table.labName),
    index("lab_computers_status_idx").on(table.status),
  ]
);

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many }) => ({
  subjects: many(subjects, { relationName: "instructorSubjects" }),
  schedules: many(schedules, { relationName: "instructorSchedules" }),
  sessions: many(sessions),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  enrollments: many(enrollments),
  attendanceRecords: many(attendanceRecords),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  instructor: one(users, {
    fields: [subjects.instructorId],
    references: [users.id],
    relationName: "instructorSubjects",
  }),
  schedules: many(schedules),
  enrollments: many(enrollments),
  attendanceRecords: many(attendanceRecords),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [schedules.subjectId],
    references: [subjects.id],
  }),
  instructor: one(users, {
    fields: [schedules.instructorId],
    references: [users.id],
    relationName: "instructorSchedules",
  }),
  enrollments: many(enrollments),
  attendanceRecords: many(attendanceRecords),
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
  schedule: one(schedules, {
    fields: [enrollments.scheduleId],
    references: [schedules.id],
  }),
}));

export const attendanceRecordsRelations = relations(
  attendanceRecords,
  ({ one }) => ({
    student: one(students, {
      fields: [attendanceRecords.studentId],
      references: [students.id],
    }),
    subject: one(subjects, {
      fields: [attendanceRecords.subjectId],
      references: [subjects.id],
    }),
    schedule: one(schedules, {
      fields: [attendanceRecords.scheduleId],
      references: [schedules.id],
    }),
  })
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const facultyRelations = relations(faculty, ({ one }) => ({
  user: one(users, {
    fields: [faculty.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
  integrationLogs: many(integrationLogs),
}));

export const integrationLogsRelations = relations(
  integrationLogs,
  ({ one }) => ({
    apiKey: one(apiKeys, {
      fields: [integrationLogs.apiKeyId],
      references: [apiKeys.id],
    }),
  })
);

export const iotDevicesRelations = relations(iotDevices, ({ many }) => ({
  logs: many(deviceLogs),
}));

export const deviceLogsRelations = relations(deviceLogs, ({ one }) => ({
  device: one(iotDevices, {
    fields: [deviceLogs.deviceId],
    references: [iotDevices.deviceId],
  }),
}));

export const labComputersRelations = relations(labComputers, ({ many }) => ({
  // Add relations if needed
}));
