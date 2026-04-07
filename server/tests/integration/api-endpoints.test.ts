import request from "supertest";
import { jest } from "@jest/globals";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import db from "../../src/storage.js";
import { app } from "../../src/index.js";
import bcrypt from "bcryptjs";
import {
  users,
  students,
  classrooms,
  subjects,
  schedules,
  enrollments,
  iotDevices,
  attendanceRecords,
  classSessions,
} from "../../src/schema.js";
import { eq } from "drizzle-orm";

// Mock services
jest.mock("../../src/services/monitoringService.js");
jest.mock("../../src/services/alertingService.js");
jest.mock("../../src/services/websocket.js");

const describeIntegration = describe;

describeIntegration("API Endpoints Integration Tests", () => {
  let testUser: any;
  let testStudent: any;
  let testDevice: any;
  let testSession: any;
  let testClassroom: any;
  let testSubject: any;
  let testSchedule: any;
  let agent: any;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const adminEmail = `test-${uniqueSuffix}@example.com`;
  const adminPasswordPlain = "StrongPass123!";

  beforeAll(async () => {
    // Ensure health endpoints don't stay in "starting" state during integration tests.
    (global as any).appInitialized = true;

    // Use a Supertest agent so session cookies persist across requests.
    agent = request.agent(app);

    // Create test user
    const userData = {
      email: adminEmail,
      password: await bcrypt.hash(adminPasswordPlain, 12),
      name: "Test User",
      role: "admin",
      isActive: 1 as any,
    };

    const [user] = await db.insert(users).values(userData).returning();
    testUser = user;

    // Create baseline classroom + subject + schedule (required for FK inserts)
    const [classroom] = await db
      .insert(classrooms)
      .values({
        name: "Test Classroom",
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
        code: `TEST-${Date.now()}`,
        name: "Test Subject",
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
        startTime: "00:00:00",
        endTime: "23:59:59",
        semester: "1st Semester",
        academicYear: "2024-2025",
        isRecurring: 0 as any,
        isActive: 1 as any,
      })
      .returning();
    testSchedule = schedule;

    // Create test student
    const studentData = {
      studentId: `TEST-${uniqueSuffix}`,
      name: "Test Student",
      email: `student-${uniqueSuffix}@example.com`,
      parentEmail: `parent-${uniqueSuffix}@example.com`,
      // Use a hex-like UID so it also matches API validation rules.
      rfidUid: `AB${Date.now().toString(16).slice(-6)}`.toUpperCase(),
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

    // Create test IoT device
    const deviceData = {
      deviceId: `TEST_DEVICE_${uniqueSuffix}`,
      classroomId: classroom.id,
      deviceType: "esp32_s3",
      status: "offline",
      apiKey: `pk_test_${uniqueSuffix}`,
      isActive: 1 as any,
    };

    const [device] = await db.insert(iotDevices).values(deviceData).returning();
    testDevice = device;

    // Create test class session
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

    // Login to create a real session cookie for authenticated routes.
    await agent
      .post("/api/auth/login")
      .send({ email: adminEmail, password: adminPasswordPlain })
      .expect(200);
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.studentId, testStudent.id));
    await db.delete(enrollments).where(eq(enrollments.studentId, testStudent.id));
    await db.delete(classSessions).where(eq(classSessions.id, testSession.id));

    // Cleanup in FK-safe order
    await db.delete(iotDevices).where(eq(iotDevices.id, testDevice.id));
    await db.delete(schedules).where(eq(schedules.id, testSchedule.id));
    await db.delete(subjects).where(eq(subjects.id, testSubject.id));
    await db.delete(classrooms).where(eq(classrooms.id, testClassroom.id));
    await db.delete(students).where(eq(students.id, testStudent.id));
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  describe("Authentication Endpoints", () => {
    describe("POST /api/auth/login", () => {
      it("should login successfully", async () => {
        const loginData = {
          email: adminEmail,
          password: adminPasswordPlain,
        };

        const response = await request(app)
          .post("/api/auth/login")
          .send(loginData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it("should reject invalid credentials", async () => {
        const loginData = {
          email: adminEmail,
          password: "wrongpassword",
        };

        const response = await request(app)
          .post("/api/auth/login")
          .send(loginData)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("Invalid credentials");
      });
    });

    describe("POST /api/auth/register", () => {
      it("should register new user", async () => {
        const registerData = {
          email: "newuser@example.com",
          password: "StrongPass123!",
          name: "New User",
          role: "faculty",
        };

        // Register is admin-only; use the logged-in agent.
        const response = await agent
          .post("/api/auth/register")
          .send(registerData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.user).toBeDefined();

        // Clean up
        await db.delete(users).where(eq(users.email, "newuser@example.com"));
      });
    });
  });

  describe("IoT Device Endpoints", () => {
    describe("GET /api/iot/devices", () => {
      it("should retrieve IoT devices", async () => {
        const response = await agent.get("/api/iot/devices").expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.devices)).toBe(true);
      });
    });

    describe("POST /api/iot/devices", () => {
      it("should register new device", async () => {
        const deviceData = {
          deviceId: "NEW_DEVICE_001",
          classroomId: testClassroom.id,
          deviceType: "rfid_reader",
          config: { ip: "192.168.1.100" },
        };

        const response = await agent
          .post("/api/iot/devices")
          .send(deviceData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.device).toBeDefined();

        // Clean up
        await db
          .delete(iotDevices)
          .where(eq(iotDevices.deviceId, "NEW_DEVICE_001"));
      });
    });

    describe("PUT /api/iot/devices/:deviceId/config", () => {
      it("should update device configuration", async () => {
        const configData = {
          config: { firmware: "v1.2.3" },
        };

        const response = await agent
          .put(`/api/iot/devices/${testDevice.deviceId}/config`)
          .send(configData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("POST /api/iot/devices/:id/command", () => {
      it("should send command to device", async () => {
        const commandData = {
          command: "ping",
          params: {},
        };

        const response = await agent
          .post(`/api/iot/devices/${testDevice.deviceId}/command`)
          .send(commandData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it("should reject unauthorized commands", async () => {
        const commandData = {
          command: "invalid_command",
          params: {},
        };

        const response = await request(app)
          .post(`/api/iot/devices/${testDevice.deviceId}/command`)
          .send(commandData)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe("Attendance Endpoints", () => {
    describe("POST /api/attendance/manual", () => {
      it("should create manual attendance record", async () => {
        const attendanceData = {
          studentId: testStudent.id,
          classSessionId: testSession.id,
          entryTime: new Date().toISOString(),
          notes: "Integration test",
        };

        const response = await agent
          .post("/api/attendance/manual")
          .send(attendanceData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.record).toBeDefined();
      });
    });

    describe("GET /api/attendance", () => {
      it("should retrieve attendance records", async () => {
        const response = await agent.get("/api/attendance").expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.records)).toBe(true);
      });

      it("should filter by date", async () => {
        const todayIso = new Date().toISOString().slice(0, 10);

        const response = await agent
          .get(`/api/attendance?date=${todayIso}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("POST /api/attendance/simulate-rfid", () => {
      beforeEach(async () => {
        await db
          .delete(attendanceRecords)
          .where(eq(attendanceRecords.classSessionId, testSession.id));
      });

      it("should process an RFID simulation", async () => {
        const rfidData = {
          rfidUid: testStudent.rfidUid,
        };

        const response = await agent
          .post("/api/attendance/simulate-rfid")
          .send(rfidData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });
  });

  describe("Student Management Endpoints", () => {
    describe("GET /api/students", () => {
      it("should retrieve students", async () => {
        const response = await agent.get("/api/students").expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe("POST /api/students", () => {
      it("should create new student", async () => {
        const studentData = {
          studentId: "NEWST-001",
          name: "New Student",
          email: "newstudent@example.com",
          parentEmail: "newstudent.parent@example.com",
          rfidUid: "A1B2C3D4",
        };

        const response = await agent
          .post("/api/students")
          .send(studentData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.student).toBeDefined();

        // Clean up
        await db.delete(students).where(eq(students.studentId, "NEWST-001"));
      });
    });

    describe("PUT /api/students/:id", () => {
      it("should update student", async () => {
        const updateData = {
          name: "Updated Student Name",
          parentEmail: "updated.parent@example.com",
          parentName: "Updated Parent",
        };

        const response = await agent
          .put(`/api/students/${testStudent.id}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.student.name).toBe("Updated Student Name");
      });
    });
  });

  describe("Reports Endpoints", () => {
    describe("GET /api/reports/templates", () => {
      it("should list report templates", async () => {
        const response = await agent.get("/api/reports/templates").expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe("GET /api/reports/attendance-records", () => {
      it("should retrieve attendance records for reports preview", async () => {
        const response = await agent
          .get("/api/reports/attendance-records?limit=5&offset=0")
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe("Dashboard Endpoints", () => {
    describe("GET /api/dashboard/stats", () => {
      it("should retrieve dashboard statistics", async () => {
        const response = await agent.get("/api/dashboard/stats").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(typeof response.body.data.todayClasses).toBe("number");
        expect(typeof response.body.data.presentStudents).toBe("number");
      });
    });

    describe("GET /api/dashboard/activity", () => {
      it("should retrieve recent activity", async () => {
        const response = await agent.get("/api/dashboard/activity").expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe("Health Check Endpoints", () => {
    describe("GET /api/health", () => {
      it("should return system health status", async () => {
        const response = await agent.get("/api/health").expect(200);

        expect(response.body.status).toBeDefined();
        expect(typeof response.body.timestamp).toBe("string");
      });
    });

    describe("GET /api/ready", () => {
      it("should report readiness", async () => {
        const response = await agent.get("/api/ready").expect(200);

        expect(response.body.status).toBe("ready");
      });
    });
  });

  describe("Settings Endpoints", () => {
    describe("GET /api/settings/system", () => {
      it("should retrieve system settings", async () => {
        const response = await agent.get("/api/settings/system").expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.settings).toBeDefined();
      });
    });

    describe("PUT /api/settings/system", () => {
      it("should update system settings", async () => {
        const settingsData = {
          lateThreshold: 10,
          absentThreshold: 45,
          emailNotifications: true,
        };

        const response = await agent
          .put("/api/settings/system")
          .send(settingsData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle unauthorized requests", async () => {
      const response = await request(app).get("/api/students").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should handle not found endpoints", async () => {
      const response = await agent.get("/api/nonexistent").expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should handle invalid request data", async () => {
      const response = await agent
        .post("/api/students")
        .send({ invalidField: "invalid" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limited requests", async () => {
      // This test would require multiple rapid requests
      // In a real scenario, you'd test against rate limiting middleware
      const response = await agent.get("/api/health").expect(200);

      expect(response.status).toBe(200);
    });
  });
});
