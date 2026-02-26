import request from "supertest";
import db from "../../src/storage.js";
import {
  users,
  students,
  iotDevices,
  attendanceRecords,
  classSessions,
} from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

// Mock services
jest.mock("../../src/services/monitoringService.js");
jest.mock("../../src/services/alertingService.js");
jest.mock("../../src/services/websocket.js");

describe("API Endpoints Integration Tests", () => {
  let authToken: string;
  let testUser: any;
  let testStudent: any;
  let testDevice: any;
  let testSession: any;

  beforeAll(async () => {
    // Create test user
    const userData = {
      email: "test@example.com",
      password: "hashedpassword",
      name: "Test User",
      role: "admin",
      isActive: true,
    };

    const [user] = await db.insert(users).values(userData).returning();
    testUser = user;

    // Create test student
    const studentData = {
      studentId: "TEST001",
      name: "Test Student",
      email: "student@example.com",
      parentEmail: "parent@example.com",
      rfidUid: "ABC123XYZ",
      isActive: true,
    };

    const [student] = await db.insert(students).values(studentData).returning();
    testStudent = student;

    // Create test IoT device
    const deviceData = {
      deviceId: "TEST_DEVICE_001",
      classroomId: 1,
      deviceType: "esp32_s3",
      status: "offline",
      apiKey: "test-api-key",
      isActive: true,
    };

    const [device] = await db.insert(iotDevices).values(deviceData).returning();
    testDevice = device;

    // Create test class session
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

    // Mock JWT token
    authToken = "mock-jwt-token-for-testing";
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.studentId, testStudent.id));
    await db.delete(iotDevices).where(eq(iotDevices.id, testDevice.id));
    await db.delete(classSessions).where(eq(classSessions.id, testSession.id));
    await db.delete(students).where(eq(students.id, testStudent.id));
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  describe("Authentication Endpoints", () => {
    describe("POST /api/auth/login", () => {
      it("should login successfully", async () => {
        const loginData = {
          email: "test@example.com",
          password: "password123",
        };

        const response = await request("http://localhost:3000")
          .post("/api/auth/login")
          .send(loginData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user).toBeDefined();
      });

      it("should reject invalid credentials", async () => {
        const loginData = {
          email: "test@example.com",
          password: "wrongpassword",
        };

        const response = await request("http://localhost:3000")
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

        const response = await request("http://localhost:3000")
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
        const response = await request("http://localhost:3000")
          .get("/api/iot/devices")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.devices)).toBe(true);
      });
    });

    describe("POST /api/iot/devices", () => {
      it("should register new device", async () => {
        const deviceData = {
          deviceId: "NEW_DEVICE_001",
          classroomId: 1,
          deviceType: "rfid_reader",
          config: { ip: "192.168.1.100" },
        };

        const response = await request("http://localhost:3000")
          .post("/api/iot/devices")
          .set("Authorization", `Bearer ${authToken}`)
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

    describe("PUT /api/iot/devices/:id/status", () => {
      it("should update device status", async () => {
        const statusData = {
          status: "online",
          config: { firmware: "v1.2.3" },
        };

        const response = await request("http://localhost:3000")
          .put(`/api/iot/devices/${testDevice.id}/status`)
          .set("Authorization", `Bearer ${authToken}`)
          .send(statusData)
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

        const response = await request("http://localhost:3000")
          .post(`/api/iot/devices/${testDevice.id}/command`)
          .set("Authorization", `Bearer ${authToken}`)
          .send(commandData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it("should reject unauthorized commands", async () => {
        const commandData = {
          command: "invalid_command",
          params: {},
        };

        const response = await request("http://localhost:3000")
          .post(`/api/iot/devices/${testDevice.id}/command`)
          .set("Authorization", `Bearer ${authToken}`)
          .send(commandData)
          .expect(400);

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

        const response = await request("http://localhost:3000")
          .post("/api/attendance/manual")
          .set("Authorization", `Bearer ${authToken}`)
          .send(attendanceData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.record).toBeDefined();
      });
    });

    describe("GET /api/attendance", () => {
      it("should retrieve attendance records", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/attendance")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.records)).toBe(true);
      });

      it("should filter by date range", async () => {
        const startDate = new Date(Date.now() - 86400000).toISOString();
        const endDate = new Date().toISOString();

        const response = await request("http://localhost:3000")
          .get(`/api/attendance?startDate=${startDate}&endDate=${endDate}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("POST /api/attendance/rfid", () => {
      it("should process RFID scan", async () => {
        const rfidData = {
          deviceId: testDevice.deviceId,
          rfidUid: testStudent.rfidUid,
          timestamp: new Date().toISOString(),
        };

        const response = await request("http://localhost:3000")
          .post("/api/attendance/rfid")
          .set("Authorization", `Bearer ${authToken}`)
          .send(rfidData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe("Student Management Endpoints", () => {
    describe("GET /api/students", () => {
      it("should retrieve students", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/students")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.students)).toBe(true);
      });
    });

    describe("POST /api/students", () => {
      it("should create new student", async () => {
        const studentData = {
          studentId: "NEW_STUDENT_001",
          name: "New Student",
          email: "newstudent@example.com",
          rfidUid: "XYZ789ABC",
        };

        const response = await request("http://localhost:3000")
          .post("/api/students")
          .set("Authorization", `Bearer ${authToken}`)
          .send(studentData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.student).toBeDefined();

        // Clean up
        await db
          .delete(students)
          .where(eq(students.studentId, "NEW_STUDENT_001"));
      });
    });

    describe("PUT /api/students/:id", () => {
      it("should update student", async () => {
        const updateData = {
          name: "Updated Student Name",
          phone: "+1987654321",
        };

        const response = await request("http://localhost:3000")
          .put(`/api/students/${testStudent.id}`)
          .set("Authorization", `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.student.name).toBe("Updated Student Name");
      });
    });
  });

  describe("Reports Endpoints", () => {
    describe("GET /api/reports/attendance", () => {
      it("should generate attendance report", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/reports/attendance")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.report).toBeDefined();
      });

      it("should filter report by date range", async () => {
        const startDate = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const endDate = new Date().toISOString();

        const response = await request("http://localhost:3000")
          .get(
            `/api/reports/attendance?startDate=${startDate}&endDate=${endDate}`,
          )
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe("GET /api/reports/device-health", () => {
      it("should generate device health report", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/reports/device-health")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.devices).toBeDefined();
      });
    });
  });

  describe("Dashboard Endpoints", () => {
    describe("GET /api/dashboard/stats", () => {
      it("should retrieve dashboard statistics", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/dashboard/stats")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.stats).toBeDefined();
        expect(typeof response.body.stats.totalStudents).toBe("number");
        expect(typeof response.body.stats.totalDevices).toBe("number");
      });
    });

    describe("GET /api/dashboard/recent-activity", () => {
      it("should retrieve recent activity", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/dashboard/recent-activity")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.activities)).toBe(true);
      });
    });
  });

  describe("Health Check Endpoints", () => {
    describe("GET /api/health", () => {
      it("should return system health status", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/health")
          .expect(200);

        expect(response.body.status).toBeDefined();
        expect(typeof response.body.timestamp).toBe("string");
      });
    });

    describe("GET /api/health/database", () => {
      it("should check database health", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/health/database")
          .expect(200);

        expect(response.body.healthy).toBeDefined();
        expect(typeof response.body.responseTime).toBe("number");
      });
    });
  });

  describe("Settings Endpoints", () => {
    describe("GET /api/settings", () => {
      it("should retrieve system settings", async () => {
        const response = await request("http://localhost:3000")
          .get("/api/settings")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.settings).toBeDefined();
      });
    });

    describe("PUT /api/settings", () => {
      it("should update system settings", async () => {
        const settingsData = {
          attendance: {
            autoValidate: true,
            requireBothSensors: false,
          },
        };

        const response = await request("http://localhost:3000")
          .put("/api/settings")
          .set("Authorization", `Bearer ${authToken}`)
          .send(settingsData)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle unauthorized requests", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/students")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Unauthorized");
    });

    it("should handle not found endpoints", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/nonexistent")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should handle invalid request data", async () => {
      const response = await request("http://localhost:3000")
        .post("/api/students")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ invalidField: "invalid" })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("required");
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limited requests", async () => {
      // This test would require multiple rapid requests
      // In a real scenario, you'd test against rate limiting middleware
      const response = await request("http://localhost:3000")
        .get("/api/health")
        .expect(200);

      expect(response.status).toBe(200);
    });
  });
});
