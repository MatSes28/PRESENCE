import request from "supertest";
import db from "../../src/storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
} from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

// Mock the monitoring service
jest.mock("../../src/services/monitoringService.js");

describe("Attendance API Integration Tests", () => {
  let testStudent: any;
  let testSession: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test data
    const studentData = {
      studentId: "TEST001",
      name: "Test Student",
      email: "test@example.com",
      phone: "+1234567890",
      parentEmail: "parent@example.com",
      isActive: true,
    };

    const [student] = await db.insert(students).values(studentData).returning();
    testStudent = student;

    const sessionData = {
      scheduleId: 1,
      date: new Date(),
      status: "active",
    };

    const [session] = await db
      .insert(classSessions)
      .values(sessionData)
      .returning();
    testSession = session;

    // Mock authentication - in real tests, you'd get a real token
    authToken = "mock-jwt-token";
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.studentId, testStudent.id));
    await db.delete(classSessions).where(eq(classSessions.id, testSession.id));
    await db.delete(students).where(eq(students.id, testStudent.id));
  });

  describe("POST /api/attendance/manual", () => {
    it("should create manual attendance record", async () => {
      const attendanceData = {
        studentId: testStudent.id,
        classSessionId: testSession.id,
        entryTime: new Date().toISOString(),
        notes: "Manual entry for testing",
      };

      const response = await request("http://localhost:3000")
        .post("/api/attendance/manual")
        .set("Authorization", `Bearer ${authToken}`)
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
      await request("http://localhost:3000")
        .post("/api/attendance/manual")
        .set("Authorization", `Bearer ${authToken}`)
        .send(attendanceData)
        .expect(201);

      // Second request should fail
      const response = await request("http://localhost:3000")
        .post("/api/attendance/manual")
        .set("Authorization", `Bearer ${authToken}`)
        .send(attendanceData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already exists");
    });

    it("should validate required fields", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/attendance/manual")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("required");
    });
  });

  describe("GET /api/attendance", () => {
    beforeAll(async () => {
      // Create some test attendance records
      await db.insert(attendanceRecords).values([
        {
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date(),
          rfidDetected: true,
          sensorDetected: true,
          isValid: true,
          discrepancyFlag: false,
          notes: "Test record 1",
        },
        {
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date(Date.now() - 3600000), // 1 hour ago
          rfidDetected: false,
          sensorDetected: true,
          isValid: true,
          discrepancyFlag: false,
          notes: "Test record 2",
        },
      ]);
    });

    it("should retrieve attendance records", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/attendance")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

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
      const response = await request("http://localhost:3000")
        .get(`/api/attendance?studentId=${testStudent.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(
        response.body.records.every(
          (r: any) => r.record.studentId === testStudent.id,
        ),
      ).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/attendance?limit=1&offset=0")
        .set("Authorization", `Bearer ${authToken}`)
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
      const [record] = await db
        .insert(attendanceRecords)
        .values({
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date(),
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

      const response = await request("http://localhost:3000")
        .put(`/api/attendance/${testRecord.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.record.isValid).toBe(false);
      expect(response.body.record.notes).toBe("Updated notes");
    });

    it("should return 404 for non-existent record", async () => {
      const response = await request("http://localhost:3000")
        .put("/api/attendance/99999")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ notes: "Test" })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });

  describe("DELETE /api/attendance/:id", () => {
    let testRecord: any;

    beforeEach(async () => {
      const [record] = await db
        .insert(attendanceRecords)
        .values({
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date(),
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
      const response = await request("http://localhost:3000")
        .delete(`/api/attendance/${testRecord.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("deleted");
    });

    it("should return 404 for non-existent record", async () => {
      const response = await request("http://localhost:3000")
        .delete("/api/attendance/99999")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found");
    });
  });

  describe("POST /api/attendance/simulate-rfid", () => {
    it("should simulate RFID scan", async () => {
      const rfidData = {
        rfidUid: "ABC123XYZ",
      };

      const response = await request("http://localhost:3000")
        .post("/api/attendance/simulate-rfid")
        .set("Authorization", `Bearer ${authToken}`)
        .send(rfidData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("successful");
    });

    it("should validate RFID UID", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/attendance/simulate-rfid")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("required");
    });
  });

  describe("POST /api/attendance/simulate-sensor", () => {
    it("should simulate sensor trigger", async () => {
      const sensorData = {
        sensorType: "entry",
        distance: 30,
      };

      const response = await request("http://localhost:3000")
        .post("/api/attendance/simulate-sensor")
        .set("Authorization", `Bearer ${authToken}`)
        .send(sensorData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("successful");
    });

    it("should validate sensor type", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/attendance/simulate-sensor")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ sensorType: "invalid", distance: 50 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("sensor type");
    });
  });
});
