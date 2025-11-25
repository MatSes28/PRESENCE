import { pgTable, text, integer, timestamp, boolean, serial, varchar, jsonb, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: text("password").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull().default("faculty"),
    facultyId: varchar("faculty_id", { length: 50 }),
    department: varchar("department", { length: 255 }),
    gender: varchar("gender", { length: 20 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const students = pgTable("students", {
    id: serial("id").primaryKey(),
    studentId: varchar("student_id", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    year: integer("year"),
    section: varchar("section", { length: 50 }),
    program: varchar("program", { length: 100 }).default("BSIT").notNull(),
    department: varchar("department", { length: 100 }).default("DIT").notNull(),
    college: varchar("college", { length: 100 })
        .default("College of Engineering")
        .notNull(),
    rfidUid: varchar("rfid_uid", { length: 50 }).unique(),
    parentEmail: varchar("parent_email", { length: 255 }).notNull(),
    parentName: varchar("parent_name", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const classrooms = pgTable("classrooms", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 })
        .default("CLIRDEC Building")
        .notNull(),
    type: varchar("type", { length: 50 }).default("lecture").notNull(),
    capacity: integer("capacity"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const subjects = pgTable("subjects", {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
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
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: varchar("start_time", { length: 10 }).notNull(),
    endTime: varchar("end_time", { length: 10 }).notNull(),
    semester: varchar("semester", { length: 50 }).notNull(),
    academicYear: varchar("academic_year", { length: 20 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const classSessions = pgTable("class_sessions", {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id")
        .references(() => schedules.id)
        .notNull(),
    date: timestamp("date").notNull(),
    status: varchar("status", { length: 20 }).default("scheduled").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
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
    status: varchar("status", { length: 20 }),
    rfidDetected: boolean("rfid_detected").default(false).notNull(),
    sensorDetected: boolean("sensor_detected").default(false).notNull(),
    isValid: boolean("is_valid").default(false).notNull(),
    discrepancyFlag: boolean("discrepancy_flag").default(false).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const computers = pgTable("computers", {
    id: serial("id").primaryKey(),
    classroomId: integer("classroom_id")
        .references(() => classrooms.id)
        .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    macAddress: varchar("mac_address", { length: 17 }),
    status: varchar("status", { length: 20 }).default("available").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
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
    loginTime: timestamp("login_time"),
    logoutTime: timestamp("logout_time"),
    sessionDuration: integer("session_duration"),
    status: varchar("status", { length: 20 }).default("assigned").notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    releasedAt: timestamp("released_at"),
    isActive: boolean("is_active").default(true).notNull(),
});
export const iotDevices = pgTable("iot_devices", {
    id: serial("id").primaryKey(),
    deviceId: varchar("device_id", { length: 100 }).notNull().unique(),
    classroomId: integer("classroom_id")
        .references(() => classrooms.id)
        .notNull(),
    deviceType: varchar("device_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).default("offline").notNull(),
    lastSeen: timestamp("last_seen"),
    config: jsonb("config"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
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
export const emailNotifications = pgTable("email_notifications", {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
        .references(() => students.id)
        .notNull(),
    classSessionId: integer("class_session_id")
        .references(() => classSessions.id)
        .notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    message: text("message"),
    isActive: boolean("is_active").default(true).notNull(),
});
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
export const classSessionsRelations = relations(classSessions, ({ one, many }) => ({
    schedule: one(schedules, {
        fields: [classSessions.scheduleId],
        references: [schedules.id],
    }),
    attendanceRecords: many(attendanceRecords),
    computerAssignments: many(computerAssignments),
    emailNotifications: many(emailNotifications),
}));
export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
    student: one(students, {
        fields: [attendanceRecords.studentId],
        references: [students.id],
    }),
    classSession: one(classSessions, {
        fields: [attendanceRecords.classSessionId],
        references: [classSessions.id],
    }),
}));
export const computersRelations = relations(computers, ({ one, many }) => ({
    classroom: one(classrooms, {
        fields: [computers.classroomId],
        references: [classrooms.id],
    }),
    assignments: many(computerAssignments),
}));
export const computerAssignmentsRelations = relations(computerAssignments, ({ one }) => ({
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
}));
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
export const emailNotificationsRelations = relations(emailNotifications, ({ one }) => ({
    student: one(students, {
        fields: [emailNotifications.studentId],
        references: [students.id],
    }),
    classSession: one(classSessions, {
        fields: [emailNotifications.classSessionId],
        references: [classSessions.id],
    }),
}));
