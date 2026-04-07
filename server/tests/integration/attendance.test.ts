import request from "supertest";
import { jest } from "@jest/globals";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";
import db from "../../src/storage.js";
import { app } from "../../src/index.js";
import { attendanceMonitor } from "../../src/services/attendanceMonitor.js";
import {
  attendanceRecords,
  students,
  classSessions,
  users,
  classrooms,
  subjects,
  schedules,
  enrollments,
} from "../../src/schema.js";
import { eq } from "drizzle-orm";

// Mock the monitoring service
jest.mock("../../src/services/monitoringService.js");

const describeIntegration = describe;

describeIntegration("Attendance API Integration Tests", () => {
  let testStudent: any;
  let testSession: any;
  let testUser: any;
  let testClassroom: any;
  let testSubject: any;
  let testSchedule: any;
  let agent: any;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const adminEmail = `attendance-admin-${uniqueSuffix}@example.com`;
  const adminPasswordPlain = "StrongPass123!";

  beforeAll(async () => {
    (global as any).appInitialized = true;

    agent = request.agent(app);

    // Create + login an admin to establish a session cookie
    const [user] = await db
      .insert(users)
      .values({
        email: adminEmail,
        password: await bcrypt.hash(adminPasswordPlain, 12),
        name: "Attendance Admin",
        role: "admin",
        isActive: 1 as any,
      })
      .returning();
    testUser = user;

    await agent
      .post("/api/auth/login")
      .send({ email: adminEmail, password: adminPasswordPlain })
      .expect(200);

    // Create FK fixtures for schedule + session
    const [classroom] = await db
      .insert(classrooms)
      .values({
        name: "Attendance Test Classroom",
        location: "CLIRDEC Building",
        type: "lecture",
        capacity: 10,
        isActive: 1 as any,
      })
      .returning();
    testClassroom = classroom;

    const [subject] = await db
      .insert(subjects)
      .values({
        code: `ATT-${Date.now()}`,
        name: "Attendance Test Subject",
        description: "Integration test subject",
        isActive: 1 as any,
      })
      .returning();
    testSubject = subject;

    const now = new Date();
    const [schedule] = await db
      .insert(schedules)
      .values({
        subjectId: subject.id,
        classroomId: classroom.id,
        facultyId: user.id,
        dayOfWeek: now.getDay(),
        // Use HH:MM:SS strings so attendance monitor comparisons work reliably.
        startTime: "00:00:00",
        endTime: "23:59:59",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: 0 as any,
        isActive: 1 as any,
      })
      .returning();
    testSchedule = schedule;

    // Create test data
    const studentData = {
      studentId: `ATT-${uniqueSuffix}`,
      name: "Test Student",
      email: `attendance-${uniqueSuffix}@example.com`,
      parentEmail: `parent-${uniqueSuffix}@example.com`,
      rfidUid: `CD${Date.now().toString(16).slice(-6)}`.toUpperCase(),
      isActive: 1 as any,
    };

    const [student] = await db.insert(students).values(studentData).returning();
    testStudent = student;

    await db.insert(enrollments).values({
      studentId: student.id,
      subjectId: subject.id,
      semester: "1st Semester",
      academicYear: "2024-2025",
      isActive: 1 as any,
    });

    const sessionData = {
      scheduleId: schedule.id,
      date: new Date(),
      status: "active",
    };

    const [session] = await db
      .insert(classSessions)
      .values(sessionData)
      .returning();
    testSession = session;
  });

  const clearSessionAttendance = async () => {
    attendanceMonitor.resetStateForTests();
    if (!testSession?.id) return;
    await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.classSessionId, testSession.id));
  };

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.studentId, testStudent.id));
    await db.delete(enrollments).where(eq(enrollments.studentId, testStudent.id));
    await db.delete(classSessions).where(eq(classSessions.id, testSession.id));
    await db.delete(schedules).where(eq(schedules.id, testSchedule.id));
    await db.delete(subjects).where(eq(subjects.id, testSubject.id));
    await db.delete(classrooms).where(eq(classrooms.id, testClassroom.id));
    await db.delete(students).where(eq(students.id, testStudent.id));
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  describe("POST /api/attendance/manual", () => {
    beforeEach(async () => {
      await clearSessionAttendance();
    });

    it("should create manual attendance record", async () => {
      const attendanceData = {
        studentId: testStudent.id,
        classSessionId: testSession.id,
        entryTime: new Date().toISOString(),
        notes: "Manual entry for testing",
      };

      const response = await agent
        .post("/api/attendance/manual")
        .send(attendanceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.record).toBeDefined();
      expect(response.body.record.studentId).toBe(testStudent.id);
      expect(response.body.record.classSessionId).toBe(testSession.id);
    });

    it("should reject duplicate attendance records", async () => {
      const attendanceData = {
        studentId: testStudent.id,
        classSessionId: testSession.id,
        entryTime: new Date().toISOString(),
      };

      // First request should succeed
      await agent
        .post("/api/attendance/manual")
        .send(attendanceData)
        .expect(201);

      // Second request should fail
      const response = await agent
        .post("/api/attendance/manual")
        .send(attendanceData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already exists");
    });

    it("should validate required fields", async () => {
      const response = await agent
        .post("/api/attendance/manual")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("required");
    });
  });

  describe("GET /api/attendance", () => {
    beforeAll(async () => {
      await clearSessionAttendance();
      await db.insert(attendanceRecords).values({
        studentId: testStudent.id,
        classSessionId: testSession.id,
        entryTime: new Date(),
        status: "present",
        rfidDetected: true,
        sensorDetected: true,
        isValid: true,
        discrepancyFlag: false,
        notes: "Test record 1",
      });
    });

    it("should retrieve attendance records", async () => {
      const response = await agent.get("/api/attendance").expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.records)).toBe(true);
      expect(response.body.records.length).toBeGreaterThan(0);

      // Check record structure
      const record = response.body.records[0];
      expect(record).toHaveProperty("record");
      expect(record).toHaveProperty("student");
      expect(record.student.id).toBe(testStudent.id);
    });

    it("should filter by student ID", async () => {
      const response = await agent
        .get(`/api/attendance?studentId=${testStudent.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(
        response.body.records.every(
          (r: any) => r.record.studentId === testStudent.id,
        ),
      ).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await agent
        .get("/api/attendance?limit=1&offset=0")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.records.length).toBeLessThanOrEqual(1);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  describe("PUT /api/attendance/:id", () => {
    let testRecord: any;

    beforeAll(async () => {
      await clearSessionAttendance();
      const [record] = await db
        .insert(attendanceRecords)
        .values({
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date(),
          status: "present",
          rfidDetected: true,
          sensorDetected: true,
          isValid: true,
          discrepancyFlag: false,
          notes: "Test record for update",
        })
        .returning();
      testRecord = record;
    });

    it("should update attendance record", async () => {
      const updateData = {
        isValid: false,
        notes: "Updated notes",
      };

      const response = await agent
        .put(`/api/attendance/${testRecord.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Boolean(response.body.record.isValid)).toBe(false);
      expect(response.body.record.notes).toBe("Updated notes");
    });

    it("should return 404 for non-existent record", async () => {
      const response = await agent
        .put("/api/attendance/99999")
        .send({ notes: "Test" })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });

  describe("DELETE /api/attendance/:id", () => {
    let testRecord: any;

    beforeEach(async () => {
      await clearSessionAttendance();
      const [record] = await db
        .insert(attendanceRecords)
        .values({
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date(),
          status: "present",
          rfidDetected: true,
          sensorDetected: true,
          isValid: true,
          discrepancyFlag: false,
          notes: "Test record for deletion",
        })
        .returning();
      testRecord = record;
    });

    it("should delete attendance record", async () => {
      const response = await agent
        .delete(`/api/attendance/${testRecord.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("deleted");
    });

    it("should return 404 for non-existent record", async () => {
      const response = await agent.delete("/api/attendance/99999").expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });

  describe("POST /api/attendance/simulate-rfid", () => {
    beforeEach(async () => {
      await clearSessionAttendance();
    });

    it("should simulate RFID scan", async () => {
      const rfidData = {
        rfidUid: testStudent.rfidUid,
      };

      const response = await agent
        .post("/api/attendance/simulate-rfid")
        .send(rfidData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("successful");
    });

    it("should validate RFID UID", async () => {
      const response = await agent
        .post("/api/attendance/simulate-rfid")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("required");
    });
  });

  describe("POST /api/attendance/simulate-sensor", () => {
    beforeEach(async () => {
      await clearSessionAttendance();
    });

    it("should simulate sensor trigger", async () => {
      // Prime the attendance monitor with a recent RFID scan for validation.
      await agent
        .post("/api/attendance/simulate-rfid")
        .send({ rfidUid: testStudent.rfidUid })
        .expect(200);

      const sensorData = {
        sensorType: "entry",
        distance: 30,
      };

      const response = await agent
        .post("/api/attendance/simulate-sensor")
        .send(sensorData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("successful");
    });

    it("should validate sensor type", async () => {
      const response = await agent
        .post("/api/attendance/simulate-sensor")
        .send({ sensorType: "invalid", distance: 50 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("sensor type");
    });
  });
});
