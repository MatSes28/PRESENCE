"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iotDevicesRelations = exports.computerAssignmentsRelations = exports.computersRelations = exports.attendanceRecordsRelations = exports.classSessionsRelations = exports.schedulesRelations = exports.subjectsRelations = exports.classroomsRelations = exports.studentsRelations = exports.usersRelations = exports.iotDevices = exports.computerAssignments = exports.computers = exports.attendanceRecords = exports.classSessions = exports.schedules = exports.subjects = exports.classrooms = exports.students = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    password: (0, pg_core_1.text)('password').notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 50 }).notNull().default('faculty'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.students = (0, pg_core_1.pgTable)('students', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    studentId: (0, pg_core_1.varchar)('student_id', { length: 50 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }),
    rfidUid: (0, pg_core_1.varchar)('rfid_uid', { length: 50 }).unique(),
    parentEmail: (0, pg_core_1.varchar)('parent_email', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.classrooms = (0, pg_core_1.pgTable)('classrooms', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    location: (0, pg_core_1.varchar)('location', { length: 255 }),
    capacity: (0, pg_core_1.integer)('capacity'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.subjects = (0, pg_core_1.pgTable)('subjects', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    code: (0, pg_core_1.varchar)('code', { length: 50 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.schedules = (0, pg_core_1.pgTable)('schedules', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    subjectId: (0, pg_core_1.integer)('subject_id').references(() => exports.subjects.id).notNull(),
    classroomId: (0, pg_core_1.integer)('classroom_id').references(() => exports.classrooms.id).notNull(),
    facultyId: (0, pg_core_1.integer)('faculty_id').references(() => exports.users.id).notNull(),
    dayOfWeek: (0, pg_core_1.integer)('day_of_week').notNull(),
    startTime: (0, pg_core_1.varchar)('start_time', { length: 10 }).notNull(),
    endTime: (0, pg_core_1.varchar)('end_time', { length: 10 }).notNull(),
    semester: (0, pg_core_1.varchar)('semester', { length: 50 }).notNull(),
    academicYear: (0, pg_core_1.varchar)('academic_year', { length: 20 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.classSessions = (0, pg_core_1.pgTable)('class_sessions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    scheduleId: (0, pg_core_1.integer)('schedule_id').references(() => exports.schedules.id).notNull(),
    date: (0, pg_core_1.timestamp)('date').notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('scheduled').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.attendanceRecords = (0, pg_core_1.pgTable)('attendance_records', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    studentId: (0, pg_core_1.integer)('student_id').references(() => exports.students.id).notNull(),
    classSessionId: (0, pg_core_1.integer)('class_session_id').references(() => exports.classSessions.id).notNull(),
    entryTime: (0, pg_core_1.timestamp)('entry_time'),
    exitTime: (0, pg_core_1.timestamp)('exit_time'),
    rfidDetected: (0, pg_core_1.boolean)('rfid_detected').default(false).notNull(),
    sensorDetected: (0, pg_core_1.boolean)('sensor_detected').default(false).notNull(),
    isValid: (0, pg_core_1.boolean)('is_valid').default(false).notNull(),
    discrepancyFlag: (0, pg_core_1.boolean)('discrepancy_flag').default(false).notNull(),
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.computers = (0, pg_core_1.pgTable)('computers', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    classroomId: (0, pg_core_1.integer)('classroom_id').references(() => exports.classrooms.id).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    macAddress: (0, pg_core_1.varchar)('mac_address', { length: 17 }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('available').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.computerAssignments = (0, pg_core_1.pgTable)('computer_assignments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    computerId: (0, pg_core_1.integer)('computer_id').references(() => exports.computers.id).notNull(),
    studentId: (0, pg_core_1.integer)('student_id').references(() => exports.students.id).notNull(),
    classSessionId: (0, pg_core_1.integer)('class_session_id').references(() => exports.classSessions.id).notNull(),
    assignedAt: (0, pg_core_1.timestamp)('assigned_at').defaultNow().notNull(),
    releasedAt: (0, pg_core_1.timestamp)('released_at'),
});
exports.iotDevices = (0, pg_core_1.pgTable)('iot_devices', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    deviceId: (0, pg_core_1.varchar)('device_id', { length: 100 }).notNull().unique(),
    classroomId: (0, pg_core_1.integer)('classroom_id').references(() => exports.classrooms.id).notNull(),
    deviceType: (0, pg_core_1.varchar)('device_type', { length: 50 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('offline').notNull(),
    lastSeen: (0, pg_core_1.timestamp)('last_seen'),
    config: (0, pg_core_1.jsonb)('config'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    schedules: many(exports.schedules),
}));
exports.studentsRelations = (0, drizzle_orm_1.relations)(exports.students, ({ many }) => ({
    attendanceRecords: many(exports.attendanceRecords),
    computerAssignments: many(exports.computerAssignments),
}));
exports.classroomsRelations = (0, drizzle_orm_1.relations)(exports.classrooms, ({ many }) => ({
    schedules: many(exports.schedules),
    computers: many(exports.computers),
    iotDevices: many(exports.iotDevices),
}));
exports.subjectsRelations = (0, drizzle_orm_1.relations)(exports.subjects, ({ many }) => ({
    schedules: many(exports.schedules),
}));
exports.schedulesRelations = (0, drizzle_orm_1.relations)(exports.schedules, ({ one, many }) => ({
    subject: one(exports.subjects, {
        fields: [exports.schedules.subjectId],
        references: [exports.subjects.id],
    }),
    classroom: one(exports.classrooms, {
        fields: [exports.schedules.classroomId],
        references: [exports.classrooms.id],
    }),
    faculty: one(exports.users, {
        fields: [exports.schedules.facultyId],
        references: [exports.users.id],
    }),
    classSessions: many(exports.classSessions),
}));
exports.classSessionsRelations = (0, drizzle_orm_1.relations)(exports.classSessions, ({ one, many }) => ({
    schedule: one(exports.schedules, {
        fields: [exports.classSessions.scheduleId],
        references: [exports.schedules.id],
    }),
    attendanceRecords: many(exports.attendanceRecords),
    computerAssignments: many(exports.computerAssignments),
}));
exports.attendanceRecordsRelations = (0, drizzle_orm_1.relations)(exports.attendanceRecords, ({ one }) => ({
    student: one(exports.students, {
        fields: [exports.attendanceRecords.studentId],
        references: [exports.students.id],
    }),
    classSession: one(exports.classSessions, {
        fields: [exports.attendanceRecords.classSessionId],
        references: [exports.classSessions.id],
    }),
}));
exports.computersRelations = (0, drizzle_orm_1.relations)(exports.computers, ({ one, many }) => ({
    classroom: one(exports.classrooms, {
        fields: [exports.computers.classroomId],
        references: [exports.classrooms.id],
    }),
    assignments: many(exports.computerAssignments),
}));
exports.computerAssignmentsRelations = (0, drizzle_orm_1.relations)(exports.computerAssignments, ({ one }) => ({
    computer: one(exports.computers, {
        fields: [exports.computerAssignments.computerId],
        references: [exports.computers.id],
    }),
    student: one(exports.students, {
        fields: [exports.computerAssignments.studentId],
        references: [exports.students.id],
    }),
    classSession: one(exports.classSessions, {
        fields: [exports.computerAssignments.classSessionId],
        references: [exports.classSessions.id],
    }),
}));
exports.iotDevicesRelations = (0, drizzle_orm_1.relations)(exports.iotDevices, ({ one }) => ({
    classroom: one(exports.classrooms, {
        fields: [exports.iotDevices.classroomId],
        references: [exports.classrooms.id],
    }),
}));
