#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
let masterKey;

loadDotEnv(path.join(repoRoot, ".env"));

const isProductionLike =
  process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

if (isProductionLike) {
  console.error("Refusing to seed dev data in a production-like environment.");
  process.exit(1);
}

const dbPath = process.env.SQLITE_PATH
  ? path.resolve(repoRoot, process.env.SQLITE_PATH)
  : path.join(repoRoot, "server", "presence.db");

if (!fs.existsSync(dbPath)) {
  console.error(`SQLite database not found at ${dbPath}`);
  console.error("Run `npm run seed:dev` from the repo root to migrate and seed it.");
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 30000");

const now = new Date();
const nowIso = now.toISOString();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const dayOfWeek = now.getDay();
const academicStartYear =
  now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
const academicYear = `${academicStartYear}-${academicStartYear + 1}`;
const semester = now.getMonth() >= 7 || now.getMonth() <= 0
  ? "1st Semester"
  : "2nd Semester";

const seedStudents = [
  {
    studentId: "2026-0001",
    name: "Ana Reyes",
    email: "ana.reyes@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260001",
    parentEmail: "parent.ana@example.test",
    parentName: "Lina Reyes",
  },
  {
    studentId: "2026-0002",
    name: "Miguel Santos",
    email: "miguel.santos@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260002",
    parentEmail: "parent.miguel@example.test",
    parentName: "Ramon Santos",
  },
  {
    studentId: "2026-0003",
    name: "Katrina Dela Cruz",
    email: "katrina.delacruz@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260003",
    parentEmail: "parent.katrina@example.test",
    parentName: "Marites Dela Cruz",
  },
  {
    studentId: "2026-0004",
    name: "Jomar Garcia",
    email: "jomar.garcia@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260004",
    parentEmail: "parent.jomar@example.test",
    parentName: "Ernesto Garcia",
  },
  {
    studentId: "2026-0005",
    name: "Bianca Flores",
    email: "bianca.flores@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260005",
    parentEmail: "parent.bianca@example.test",
    parentName: "Cecilia Flores",
  },
  {
    studentId: "2026-0006",
    name: "Nathan Mercado",
    email: "nathan.mercado@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260006",
    parentEmail: "parent.nathan@example.test",
    parentName: "Grace Mercado",
  },
  {
    studentId: "2026-0007",
    name: "Sophia Villanueva",
    email: "sophia.villanueva@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260007",
    parentEmail: "parent.sophia@example.test",
    parentName: "Rosa Villanueva",
  },
  {
    studentId: "2026-0008",
    name: "Ryan Aquino",
    email: "ryan.aquino@student.clsu.edu.ph",
    year: 2,
    section: "BSIT-2A",
    rfidUid: "RFID20260008",
    parentEmail: "parent.ryan@example.test",
    parentName: "Nestor Aquino",
  },
];

const seed = db.transaction(() => {
  assertRequiredTables();

  const adminId = upsertUser({
    email: "admin@clsu.edu.ph",
    password: "admin123",
    name: "CLIRDEC Admin",
    role: "admin",
    facultyId: "ADM-001",
    department: "DIT",
    gender: "prefer_not_to_say",
  });

  const facultyId = upsertUser({
    email: "faculty@clsu.edu.ph",
    password: "faculty123",
    name: "Prof. Maria Santos",
    role: "faculty",
    facultyId: "FAC-2026-001",
    department: "DIT",
    gender: "female",
  });

  const labId = upsertClassroom({
    name: "CLIRDEC Laboratory 1",
    location: "CLIRDEC Building",
    type: "laboratory",
    capacity: 40,
  });
  const lectureId = upsertClassroom({
    name: "CLIRDEC Lecture Room 1",
    location: "CLIRDEC Building",
    type: "lecture",
    capacity: 45,
  });

  const webSystemsId = upsertSubject({
    code: "IT 213",
    name: "Web Systems and Technologies",
    description: "Development of responsive web applications and APIs.",
  });
  const dataStructuresId = upsertSubject({
    code: "IT 124",
    name: "Data Structures and Algorithms",
    description: "Core data structures, algorithms, and analysis.",
  });
  const computingId = upsertSubject({
    code: "IT 111",
    name: "Introduction to Computing",
    description: "Foundations of computing, systems, and digital tools.",
  });

  const activeScheduleId = upsertSchedule({
    subjectId: webSystemsId,
    classroomId: labId,
    facultyId,
    dayOfWeek,
    startTime: "00:00:00",
    endTime: "23:59:59",
    semester,
    academicYear,
    isRecurring: 1,
    recurrencePattern: "weekly",
  });

  const tomorrowScheduleId = upsertSchedule({
    subjectId: dataStructuresId,
    classroomId: labId,
    facultyId,
    dayOfWeek: (dayOfWeek + 1) % 7,
    startTime: "09:00:00",
    endTime: "12:00:00",
    semester,
    academicYear,
    isRecurring: 1,
    recurrencePattern: "weekly",
  });

  const lectureScheduleId = upsertSchedule({
    subjectId: computingId,
    classroomId: lectureId,
    facultyId,
    dayOfWeek: (dayOfWeek + 2) % 7,
    startTime: "13:00:00",
    endTime: "15:00:00",
    semester,
    academicYear,
    isRecurring: 1,
    recurrencePattern: "weekly",
  });

  const activeSessionId = upsertClassSession({
    scheduleId: activeScheduleId,
    date: todayStart,
    status: "active",
  });

  upsertClassSession({
    scheduleId: tomorrowScheduleId,
    date: addDays(todayStart, 1),
    status: "scheduled",
  });
  upsertClassSession({
    scheduleId: lectureScheduleId,
    date: addDays(todayStart, 2),
    status: "scheduled",
  });

  const studentIds = seedStudents.map((student) => upsertStudent(student));
  for (const studentId of studentIds) {
    upsertEnrollment(studentId, webSystemsId);
    upsertEnrollment(studentId, dataStructuresId);
    upsertEnrollment(studentId, computingId);
  }

  upsertIotDevice({
    deviceId: "ESP32-S3-CLIRDEC-01",
    name: "CLIRDEC Lab 1 Dual Sensor",
    classroomId: labId,
    location: "CLIRDEC Laboratory 1 entrance",
    deviceType: "esp32_s3",
    sensorType: "dual_sensor",
    mqttTopic: "presence/clirdec/lab-1",
    macAddress: "02:1A:7D:00:00:01",
    firmwareVersion: "dev-1.0.0",
    status: "online",
    batteryLevel: 96,
    signalStrength: -43,
    apiKey: "pk_dev_clirdec_lab1_dual_sensor",
    config: {
      mode: "dual_validation",
      rfidReader: "enabled",
      ultrasonicSensor: "enabled",
      validationWindowMs: 5000,
    },
  });

  const computerIds = [];
  for (let i = 1; i <= 8; i += 1) {
    computerIds.push(
      upsertComputer({
        classroomId: labId,
        name: `LAB1-PC-${String(i).padStart(2, "0")}`,
        ipAddress: `192.168.18.${100 + i}`,
        macAddress: `02:1A:7D:10:00:${String(i).padStart(2, "0")}`,
        status: i === 1 ? "in_use" : "available",
      }),
    );
  }

  upsertComputerAssignment({
    computerId: computerIds[0],
    studentId: studentIds[0],
    classSessionId: activeSessionId,
    status: "active",
    loginTime: minutesAgo(42),
  });

  const attendanceRows = [
    {
      studentId: studentIds[0],
      status: "present",
      entryTime: minutesAgo(50),
      rfidDetected: 1,
      sensorDetected: 1,
      isValid: 1,
      discrepancyFlag: 0,
      notes: "Seeded present record.",
    },
    {
      studentId: studentIds[1],
      status: "present",
      entryTime: minutesAgo(38),
      rfidDetected: 1,
      sensorDetected: 1,
      isValid: 1,
      discrepancyFlag: 0,
      notes: "Seeded present record.",
    },
    {
      studentId: studentIds[2],
      status: "late",
      entryTime: minutesAgo(18),
      rfidDetected: 1,
      sensorDetected: 1,
      isValid: 1,
      discrepancyFlag: 0,
      notes: "Seeded late arrival.",
    },
    {
      studentId: studentIds[3],
      status: "absent",
      entryTime: null,
      rfidDetected: 0,
      sensorDetected: 0,
      isValid: 0,
      discrepancyFlag: 0,
      notes: "Seeded absent record.",
    },
    {
      studentId: studentIds[4],
      status: "absent",
      entryTime: minutesAgo(8),
      rfidDetected: 1,
      sensorDetected: 0,
      isValid: 0,
      discrepancyFlag: 1,
      notes: "Seeded RFID-only discrepancy.",
    },
  ];

  for (const record of attendanceRows) {
    upsertAttendanceRecord({
      ...record,
      classSessionId: activeSessionId,
    });
  }

  return {
    adminId,
    facultyId,
    activeSessionId,
    activeScheduleId,
    students: studentIds.length,
    computers: computerIds.length,
  };
});

try {
  const result = seed();
  const counts = {
    users: countRows("users"),
    students: countRows("students"),
    subjects: countRows("subjects"),
    schedules: countRows("schedules"),
    class_sessions: countRows("class_sessions"),
    attendance_records: countRows("attendance_records"),
    iot_devices: countRows("iot_devices"),
    computers: countRows("computers"),
  };

  console.log("Dev SQLite seed completed.");
  console.log(`Database: ${dbPath}`);
  console.log(
    `Active session ${result.activeSessionId} is available all day for today's schedule.`,
  );
  console.log("Login accounts:");
  console.log("  admin@clsu.edu.ph / admin123");
  console.log("  faculty@clsu.edu.ph / faculty123");
  console.log("RFID cards for new scan tests:");
  console.log("  RFID20260006, RFID20260007, RFID20260008");
  console.log("Row counts:", JSON.stringify(counts, null, 2));
} finally {
  db.close();
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseDotEnvValue(rawValue);
  }
}

function parseDotEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function assertRequiredTables() {
  const requiredTables = [
    "users",
    "students",
    "classrooms",
    "subjects",
    "schedules",
    "class_sessions",
    "attendance_records",
    "computers",
    "computer_assignments",
    "iot_devices",
    "enrollments",
  ];

  for (const table of requiredTables) {
    const exists = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
      )
      .get(table);
    if (!exists) {
      throw new Error(`Missing required table: ${table}`);
    }
  }
}

function upsertUser(user) {
  const passwordHash = bcrypt.hashSync(user.password, 10);
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .get(user.email);

  if (existing) {
    db.prepare(
      `UPDATE users
       SET password = ?, name = ?, role = ?, faculty_id = ?, department = ?,
           gender = ?, is_active = 1, updated_at = ?
       WHERE id = ?`,
    ).run(
      passwordHash,
      user.name,
      user.role,
      user.facultyId,
      user.department,
      user.gender,
      nowIso,
      existing.id,
    );
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO users
       (email, password, name, role, faculty_id, department, gender,
        is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      user.email,
      passwordHash,
      user.name,
      user.role,
      user.facultyId,
      user.department,
      user.gender,
      nowIso,
      nowIso,
    );

  return Number(result.lastInsertRowid);
}

function upsertStudent(student) {
  const normalizedRfid = student.rfidUid.trim();
  const encryptedParent = encryptParentData(
    student.parentEmail,
    student.parentName,
  );
  const existing = db
    .prepare("SELECT id FROM students WHERE student_id = ? LIMIT 1")
    .get(student.studentId);
  const values = [
    student.name,
    student.email,
    student.year,
    student.section,
    "BSIT",
    "DIT",
    "College of Engineering",
    hashRfidUidForLookup(normalizedRfid),
    encryptRfid(normalizedRfid),
    encryptedParent.email,
    encryptedParent.phone,
    nowIso,
  ];

  if (existing) {
    db.prepare(
      `UPDATE students
       SET name = ?, email = ?, year = ?, section = ?, program = ?,
           department = ?, college = ?, rfid_uid_hash = ?, rfid_uid = ?,
           parent_email = ?, parent_name = ?, is_active = 1, updated_at = ?
       WHERE id = ?`,
    ).run(...values, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO students
       (student_id, name, email, year, section, program, department, college,
        rfid_uid_hash, rfid_uid, parent_email, parent_name, is_active,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(student.studentId, ...values, nowIso);

  return Number(result.lastInsertRowid);
}

function upsertClassroom(classroom) {
  const existing = db
    .prepare("SELECT id FROM classrooms WHERE name = ? LIMIT 1")
    .get(classroom.name);

  if (existing) {
    db.prepare(
      `UPDATE classrooms
       SET location = ?, type = ?, capacity = ?, is_active = 1
       WHERE id = ?`,
    ).run(classroom.location, classroom.type, classroom.capacity, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO classrooms
       (name, location, type, capacity, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    )
    .run(
      classroom.name,
      classroom.location,
      classroom.type,
      classroom.capacity,
      nowIso,
    );
  return Number(result.lastInsertRowid);
}

function upsertSubject(subject) {
  const existing = db
    .prepare("SELECT id FROM subjects WHERE code = ? LIMIT 1")
    .get(subject.code);

  if (existing) {
    db.prepare(
      `UPDATE subjects
       SET name = ?, description = ?, is_active = 1
       WHERE id = ?`,
    ).run(subject.name, subject.description, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO subjects
       (code, name, description, is_active, created_at)
       VALUES (?, ?, ?, 1, ?)`,
    )
    .run(subject.code, subject.name, subject.description, nowIso);
  return Number(result.lastInsertRowid);
}

function upsertSchedule(schedule) {
  const existing = db
    .prepare(
      `SELECT id FROM schedules
       WHERE subject_id = ? AND classroom_id = ? AND faculty_id = ?
         AND day_of_week = ? AND semester = ? AND academic_year = ?
       ORDER BY id
       LIMIT 1`,
    )
    .get(
      schedule.subjectId,
      schedule.classroomId,
      schedule.facultyId,
      schedule.dayOfWeek,
      schedule.semester,
      schedule.academicYear,
    );

  const recurrenceEndDate = addDays(todayStart, 120).toISOString();
  const recurrenceExceptions = JSON.stringify([]);

  if (existing) {
    db.prepare(
      `UPDATE schedules
       SET start_time = ?, end_time = ?, is_recurring = ?,
           recurrence_pattern = ?, recurrence_end_date = ?,
           recurrence_exceptions = ?, conflict_resolution_priority = 5,
           allow_room_change = 1, allow_time_adjustment = 1, is_active = 1
       WHERE id = ?`,
    ).run(
      schedule.startTime,
      schedule.endTime,
      schedule.isRecurring,
      schedule.recurrencePattern,
      recurrenceEndDate,
      recurrenceExceptions,
      existing.id,
    );
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO schedules
       (subject_id, classroom_id, faculty_id, day_of_week, start_time, end_time,
        semester, academic_year, is_recurring, recurrence_pattern,
        recurrence_end_date, recurrence_exceptions, conflict_resolution_priority,
        allow_room_change, allow_time_adjustment, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 1, 1, 1, ?)`,
    )
    .run(
      schedule.subjectId,
      schedule.classroomId,
      schedule.facultyId,
      schedule.dayOfWeek,
      schedule.startTime,
      schedule.endTime,
      schedule.semester,
      schedule.academicYear,
      schedule.isRecurring,
      schedule.recurrencePattern,
      recurrenceEndDate,
      recurrenceExceptions,
      nowIso,
    );
  return Number(result.lastInsertRowid);
}

function upsertClassSession(session) {
  const date = session.date.toISOString();
  const sessionDayStart = new Date(
    session.date.getFullYear(),
    session.date.getMonth(),
    session.date.getDate(),
  );
  const sessionDayEnd = new Date(
    session.date.getFullYear(),
    session.date.getMonth(),
    session.date.getDate() + 1,
  );
  const existing = db
    .prepare(
      `SELECT id FROM class_sessions
       WHERE schedule_id = ? AND date >= ? AND date < ?
       ORDER BY id
       LIMIT 1`,
    )
    .get(
      session.scheduleId,
      sessionDayStart.toISOString(),
      sessionDayEnd.toISOString(),
    );

  if (existing) {
    db.prepare(
      `UPDATE class_sessions
       SET date = ?, status = ?, is_active = 1
       WHERE id = ?`,
    ).run(date, session.status, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO class_sessions
       (schedule_id, date, status, is_active, created_at)
       VALUES (?, ?, ?, 1, ?)`,
    )
    .run(session.scheduleId, date, session.status, nowIso);
  return Number(result.lastInsertRowid);
}

function upsertEnrollment(studentId, subjectId) {
  const existing = db
    .prepare(
      `SELECT id FROM enrollments
       WHERE student_id = ? AND subject_id = ? AND semester = ? AND academic_year = ?
       LIMIT 1`,
    )
    .get(studentId, subjectId, semester, academicYear);

  if (existing) {
    db.prepare("UPDATE enrollments SET is_active = 1 WHERE id = ?").run(
      existing.id,
    );
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO enrollments
       (student_id, subject_id, semester, academic_year, enrolled_at, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
    )
    .run(studentId, subjectId, semester, academicYear, nowIso);
  return Number(result.lastInsertRowid);
}

function upsertIotDevice(device) {
  const existing = db
    .prepare("SELECT id FROM iot_devices WHERE device_id = ? LIMIT 1")
    .get(device.deviceId);

  const config = JSON.stringify(device.config);
  const values = [
    device.name,
    device.location,
    device.classroomId,
    device.deviceType,
    device.sensorType,
    device.mqttTopic,
    device.macAddress,
    device.firmwareVersion,
    device.status,
    nowIso,
    device.batteryLevel,
    device.signalStrength,
    config,
    device.apiKey,
    crypto.createHash("sha256").update(device.apiKey).digest("hex"),
    nowIso,
  ];

  if (existing) {
    db.prepare(
      `UPDATE iot_devices
       SET name = ?, location = ?, classroom_id = ?, device_type = ?,
           sensor_type = ?, mqtt_topic = ?, mac_address = ?,
           firmware_version = ?, status = ?, last_seen = ?, battery_level = ?,
           signal_strength = ?, config = ?, api_key = ?, api_key_hash = ?,
           is_active = 1, updated_at = ?
       WHERE id = ?`,
    ).run(...values, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO iot_devices
       (device_id, name, location, classroom_id, device_type, sensor_type,
        mqtt_topic, mac_address, firmware_version, status, last_seen,
        battery_level, signal_strength, config, api_key, api_key_hash,
        is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(device.deviceId, ...values, nowIso);
  return Number(result.lastInsertRowid);
}

function upsertComputer(computer) {
  const existing = db
    .prepare("SELECT id FROM computers WHERE name = ? LIMIT 1")
    .get(computer.name);
  const lastMaintenance = addDays(todayStart, -15).toISOString();
  const nextMaintenance = addDays(todayStart, 30).toISOString();

  if (existing) {
    db.prepare(
      `UPDATE computers
       SET classroom_id = ?, ip_address = ?, mac_address = ?, status = ?,
           last_maintenance = ?, next_maintenance = ?,
           maintenance_notes = ?, is_active = 1, updated_at = ?
       WHERE id = ?`,
    ).run(
      computer.classroomId,
      computer.ipAddress,
      computer.macAddress,
      computer.status,
      lastMaintenance,
      nextMaintenance,
      "Seeded workstation.",
      nowIso,
      existing.id,
    );
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO computers
       (classroom_id, name, ip_address, mac_address, status, last_maintenance,
        next_maintenance, maintenance_notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      computer.classroomId,
      computer.name,
      computer.ipAddress,
      computer.macAddress,
      computer.status,
      lastMaintenance,
      nextMaintenance,
      "Seeded workstation.",
      nowIso,
      nowIso,
    );
  return Number(result.lastInsertRowid);
}

function upsertComputerAssignment(assignment) {
  const existing = db
    .prepare(
      `SELECT id FROM computer_assignments
       WHERE computer_id = ? AND student_id = ? AND class_session_id = ?
       LIMIT 1`,
    )
    .get(assignment.computerId, assignment.studentId, assignment.classSessionId);

  if (existing) {
    db.prepare(
      `UPDATE computer_assignments
       SET login_time = ?, logout_time = NULL, session_duration = NULL,
           status = ?, assigned_at = ?, released_at = NULL, is_active = 1
       WHERE id = ?`,
    ).run(assignment.loginTime, assignment.status, assignment.loginTime, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO computer_assignments
       (computer_id, student_id, class_session_id, login_time, logout_time,
        session_duration, status, assigned_at, released_at, is_active)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL, 1)`,
    )
    .run(
      assignment.computerId,
      assignment.studentId,
      assignment.classSessionId,
      assignment.loginTime,
      assignment.status,
      assignment.loginTime,
    );
  return Number(result.lastInsertRowid);
}

function upsertAttendanceRecord(record) {
  const existing = db
    .prepare(
      `SELECT id FROM attendance_records
       WHERE student_id = ? AND class_session_id = ?
       LIMIT 1`,
    )
    .get(record.studentId, record.classSessionId);

  const values = [
    record.entryTime,
    null,
    record.status,
    record.rfidDetected,
    record.sensorDetected,
    record.isValid,
    record.discrepancyFlag,
    record.notes,
    nowIso,
  ];

  if (existing) {
    db.prepare(
      `UPDATE attendance_records
       SET entry_time = ?, exit_time = ?, status = ?, rfid_detected = ?,
           sensor_detected = ?, is_valid = ?, discrepancy_flag = ?, notes = ?,
           is_active = 1, updated_at = ?
       WHERE id = ?`,
    ).run(...values, existing.id);
    return Number(existing.id);
  }

  const result = db
    .prepare(
      `INSERT INTO attendance_records
       (student_id, class_session_id, entry_time, exit_time, status,
        rfid_detected, sensor_detected, is_valid, discrepancy_flag, notes,
        is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(record.studentId, record.classSessionId, ...values, nowIso);
  return Number(result.lastInsertRowid);
}

function countRows(tableName) {
  return db.prepare(`SELECT count(*) AS count FROM ${tableName}`).get().count;
}

function addDays(date, days) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function minutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

function encryptParentData(email, parentName) {
  const key = hkdfKey("parent:at-rest");
  return {
    email: JSON.stringify(encryptGcm(email, key, "parent", "custom")),
    phone: parentName
      ? JSON.stringify(encryptGcm(parentName, key, "parent", "custom"))
      : null,
  };
}

function encryptRfid(rfidUid) {
  const key = hkdfKey("rfid:at-rest");
  return JSON.stringify(encryptGcm(rfidUid, key, "rfid", "custom"));
}

function hashRfidUidForLookup(rfidUid) {
  const key = hkdfKey("rfid:lookup-hmac");
  return crypto.createHmac("sha256", key).update(rfidUid.trim()).digest("hex");
}

function encryptGcm(value, key, aadContext, keyLabel) {
  const iv = crypto.randomBytes(12);
  const aad = Buffer.from(`v1:${aadContext}`, "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(value, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    alg: "aes-256-gcm",
    k: keyLabel,
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: tag.toString("base64"),
    aad: aad.toString("base64"),
  };
}

function hkdfKey(info) {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      getMasterKey(),
      Buffer.from("presence:hkdf:v1", "utf8"),
      Buffer.from(info, "utf8"),
      32,
    ),
  );
}

function getMasterKey() {
  if (masterKey) return masterKey;

  const raw = process.env.ENCRYPTION_MASTER_KEY ?? process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY is required to seed decryptable student data.",
    );
  }

  const trimmed = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    masterKey = Buffer.from(trimmed, "hex");
    return masterKey;
  }

  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length !== 32) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY must be 64-char hex or 32-byte base64.",
    );
  }

  masterKey = decoded;
  return masterKey;
}
