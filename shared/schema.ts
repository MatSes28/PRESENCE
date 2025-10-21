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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table (Faculty/Admin)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("faculty"), // admin, faculty
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Students table
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  rfidUid: varchar("rfid_uid", { length: 50 }).unique(),
  parentEmail: varchar("parent_email", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Classrooms table
export const classrooms = pgTable("classrooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  capacity: integer("capacity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Class Sessions table (auto-generated from schedules)
export const classSessions = pgTable("class_sessions", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id")
    .references(() => schedules.id)
    .notNull(),
  date: timestamp("date").notNull(),
  status: varchar("status", { length: 20 }).default("scheduled").notNull(), // scheduled, active, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Attendance Records table
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .references(() => students.id)
    .notNull(),
  classSessionId: integer("class_session_id")
    .references(() => classSessions.id)
    .notNull(),
  entryTime: timestamp("entry_time"),
  exitTime: timestamp("exit_time"),
  rfidDetected: boolean("rfid_detected").default(false).notNull(),
  sensorDetected: boolean("sensor_detected").default(false).notNull(),
  isValid: boolean("is_valid").default(false).notNull(),
  discrepancyFlag: boolean("discrepancy_flag").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Computer Assignments table
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
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
});

// IoT Devices table
export const iotDevices = pgTable("iot_devices", {
  id: serial("id").primaryKey(),
  deviceId: varchar("device_id", { length: 100 }).notNull().unique(),
  classroomId: integer("classroom_id")
    .references(() => classrooms.id)
    .notNull(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // esp32_s3
  status: varchar("status", { length: 20 }).default("offline").notNull(), // online, offline, maintenance
  lastSeen: timestamp("last_seen"),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  schedules: many(schedules),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  attendanceRecords: many(attendanceRecords),
  computerAssignments: many(computerAssignments),
}));

export const classroomsRelations = relations(classrooms, ({ many }) => ({
  schedules: many(schedules),
  computers: many(computers),
  iotDevices: many(iotDevices),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  schedules: many(schedules),
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
  })
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
  })
);

export const computersRelations = relations(computers, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [computers.classroomId],
    references: [classrooms.id],
  }),
  assignments: many(computerAssignments),
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
  })
);

export const iotDevicesRelations = relations(iotDevices, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [iotDevices.classroomId],
    references: [classrooms.id],
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

// Password Reset Tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
