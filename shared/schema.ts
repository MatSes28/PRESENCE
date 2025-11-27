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
  rfidUid: varchar("rfid_uid", { length: 50 }).unique(),
  parentEmail: varchar("parent_email", { length: 255 }).notNull(), // Made mandatory
  parentName: varchar("parent_name", { length: 255 }),
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
  isActive: boolean("is_active").default(true).notNull(),
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
  isActive: boolean("is_active").default(true).notNull(),
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
  status: varchar("status", { length: 20 }), // present, late, absent
  rfidDetected: boolean("rfid_detected").default(false).notNull(),
  sensorDetected: boolean("sensor_detected").default(false).notNull(),
  isValid: boolean("is_valid").default(false).notNull(),
  discrepancyFlag: boolean("discrepancy_flag").default(false).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
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
  classroomId: integer("classroom_id")
    .references(() => classrooms.id)
    .notNull(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // esp32_s3
  status: varchar("status", { length: 20 }).default("offline").notNull(), // online, offline, maintenance
  lastSeen: timestamp("last_seen"),
  config: jsonb("config"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  })
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
  })
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
  })
);

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
