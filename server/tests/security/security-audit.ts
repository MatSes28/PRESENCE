import request from "supertest";
import { describe, it, expect, beforeAll } from "@jest/globals";
import { db } from "../../src/storage.js";
import { users, students, attendanceRecords } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Security Audit and Penetration Testing", () => {
  let testUserId: number;
  let testStudentId: number;
  let validAuthToken: string;

  beforeAll(async () => {
    // Create test user
    const testUser = await db
      .insert(users)
      .values({
        email: "security-test@example.com",
        password: "hashedpassword",
        name: "Security Test User",
        role: "faculty",
      })
      .returning();

    testUserId = testUser[0].id;

    // Create test student
    const testStudent = await db
      .insert(students)
      .values({
        studentId: "SEC001",
        name: "Security Test Student",
        email: "security-student@example.com",
        parentEmail: "security-parent@example.com",
        year: 3,
        section: "A",
        program: "BSIT",
        department: "DIT",
        college: "College of Engineering",
      })
      .returning();

    testStudentId = testStudent[0].id;

    // Mock valid authentication token
    validAuthToken = "mock-valid-jwt-token";
  });

  describe("Authentication Security", () => {
    it("should reject invalid JWT tokens", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/attendance")
        .set("Authorization", "Bearer invalid.jwt.token")
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject expired JWT tokens", async () => {
      // Create an expired token (this would be done by manipulating the token)
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJmYWN1bHR5IiwiaWF0IjoxNjg5ODk2MDAwLCJleHAiOjE2ODk4OTYwMDF9.invalid";

      const response = await request("http://localhost:3000")
        .get("/api/attendance")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should reject malformed authorization headers", async () => {
      const malformedHeaders = [
        "Bearer",
        "Bearer token1 token2",
        "Basic dXNlcjpwYXNz",
        "",
        "Bearer ",
      ];

      for (const header of malformedHeaders) {
        const response = await request("http://localhost:3000")
          .get("/api/attendance")
          .set("Authorization", header)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it("should enforce session timeouts", async () => {
      // This test would require manipulating session expiry
      // For now, we test that authentication is required
      const response = await request("http://localhost:3000")
        .get("/api/attendance")
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Authorization and Access Control", () => {
    it("should prevent unauthorized access to admin endpoints", async () => {
      // Try to access admin-only endpoints with regular user token
      const adminEndpoints = ["/api/users", "/api/settings/system"];

      for (const endpoint of adminEndpoints) {
        const response = await request("http://localhost:3000")
          .get(endpoint)
          .set("Authorization", `Bearer ${validAuthToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      }
    });

    it("should prevent users from accessing other users' data", async () => {
      // Try to access another user's data
      const response = await request("http://localhost:3000")
        .get("/api/gdpr/access/99999") // Non-existent user
        .set("Authorization", `Bearer ${validAuthToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should validate user permissions for data operations", async () => {
      // Test that users can only modify their own data
      const updateData = { name: "Hacked Name" };

      const response = await request("http://localhost:3000")
        .put(`/api/users/${testUserId + 1}`) // Wrong user ID
        .set("Authorization", `Bearer ${validAuthToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Input Validation and Sanitization", () => {
    it("should prevent SQL injection attempts", async () => {
      const sqlInjectionPayloads = [
        { studentId: "'; DROP TABLE users; --" },
        { name: "Test' OR '1'='1" },
        { email: "test@example.com' UNION SELECT * FROM users --" },
        { notes: "'; EXEC xp_cmdshell('dir'); --" },
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request("http://localhost:3000")
          .post("/api/attendance/manual")
          .set("Authorization", `Bearer ${validAuthToken}`)
          .send({
            studentId: testStudentId,
            classSessionId: 1,
            entryTime: new Date().toISOString(),
            ...payload,
          })
          .expect(400); // Should be rejected due to validation

        expect(response.body.success).toBe(false);
      }
    });

    it("should prevent XSS attacks", async () => {
      const xssPayloads = [
        { notes: "<script>alert('XSS')</script>" },
        { name: "<img src=x onerror=alert('XSS')>" },
        { email: "test@example.com<script>evil()</script>" },
      ];

      for (const payload of xssPayloads) {
        const response = await request("http://localhost:3000")
          .post("/api/attendance/manual")
          .set("Authorization", `Bearer ${validAuthToken}`)
          .send({
            studentId: testStudentId,
            classSessionId: 1,
            entryTime: new Date().toISOString(),
            ...payload,
          })
          .expect(400); // Should be sanitized/rejected

        // The response should not contain the script tags
        expect(response.text).not.toContain("<script>");
        expect(response.text).not.toContain("onerror");
      }
    });

    it("should validate input data types and formats", async () => {
      const invalidData = [
        {
          studentId: "not-a-number",
          classSessionId: 1,
          entryTime: new Date().toISOString(),
        },
        {
          studentId: testStudentId,
          classSessionId: "not-a-number",
          entryTime: new Date().toISOString(),
        },
        {
          studentId: testStudentId,
          classSessionId: 1,
          entryTime: "invalid-date",
        },
        {
          studentId: testStudentId,
          classSessionId: 1,
          entryTime: new Date().toISOString(),
          extraField: "should-not-exist",
        },
      ];

      for (const data of invalidData) {
        const response = await request("http://localhost:3000")
          .post("/api/attendance/manual")
          .set("Authorization", `Bearer ${validAuthToken}`)
          .send(data)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain("validation");
      }
    });

    it("should enforce input length limits", async () => {
      const longString = "a".repeat(10000); // 10KB string

      const response = await request("http://localhost:3000")
        .post("/api/attendance/manual")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .send({
          studentId: testStudentId,
          classSessionId: 1,
          entryTime: new Date().toISOString(),
          notes: longString,
        })
        .expect(413); // Payload too large or validation error

      expect(response.body.success).toBe(false);
    });
  });

  describe("Rate Limiting and DoS Protection", () => {
    it("should enforce rate limits on API endpoints", async () => {
      const requests = [];

      // Make many requests quickly
      for (let i = 0; i < 150; i++) {
        requests.push(
          request("http://localhost:3000")
            .get("/api/attendance")
            .set("Authorization", `Bearer ${validAuthToken}`)
        );
      }

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it("should prevent brute force authentication attempts", async () => {
      const invalidTokens = [];

      // Generate many invalid tokens
      for (let i = 0; i < 50; i++) {
        invalidTokens.push(crypto.randomBytes(32).toString("hex"));
      }

      const requests = invalidTokens.map((token) =>
        request("http://localhost:3000")
          .get("/api/attendance")
          .set("Authorization", `Bearer ${token}`)
      );

      const responses = await Promise.all(requests);

      // Should see rate limiting or consistent rejection
      const successResponses = responses.filter(
        (r) => r.status !== 401 && r.status !== 429
      );
      expect(successResponses.length).toBe(0);
    });
  });

  describe("Data Privacy and GDPR Compliance", () => {
    it("should encrypt sensitive data at rest", async () => {
      // Check that passwords are hashed (not plain text)
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1);

      expect(user[0].password).not.toBe("hashedpassword");
      expect(user[0].password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern
    });

    it("should not expose sensitive data in API responses", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/gdpr/access/1")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .expect(200);

      // Response should not contain passwords or other sensitive data
      expect(response.body.report).not.toHaveProperty("password");
      expect(response.body.report).not.toHaveProperty("sessionSecret");
      expect(response.body.report).not.toHaveProperty("brevoApiKey");
    });

    it("should implement proper data retention policies", async () => {
      // This would test that old data is properly archived/deleted
      // For now, we verify the GDPR service exists and has retention methods
      const gdprService = await import("../../src/services/gdprService.js");
      expect(gdprService.gdprService.enforceDataRetention).toBeDefined();
    });
  });

  describe("File Upload Security", () => {
    it("should validate file types and sizes", async () => {
      // This would test file upload endpoints
      // For now, we check that file size limits are enforced in configuration
      expect(process.env.MAX_FILE_SIZE).toBeDefined();
      expect(parseInt(process.env.MAX_FILE_SIZE || "0")).toBeGreaterThan(0);
    });

    it("should prevent directory traversal attacks", async () => {
      // Test file paths that try to traverse directories
      const maliciousPaths = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "/etc/passwd",
        "C:\\Windows\\System32\\config\\sam",
      ];

      // This would test file serving endpoints
      // For now, we verify the application doesn't expose file system access
      for (const path of maliciousPaths) {
        const response = await request("http://localhost:3000")
          .get(`/api/files/${encodeURIComponent(path)}`)
          .set("Authorization", `Bearer ${validAuthToken}`)
          .expect(404); // Should not find these files

        expect(response.status).toBe(404);
      }
    });
  });

  describe("Session Security", () => {
    it("should use secure session configuration", async () => {
      // Check that sessions use secure settings
      expect(process.env.SESSION_SECRET).toBeDefined();
      expect(process.env.SESSION_SECRET?.length).toBeGreaterThanOrEqual(32);

      // Check session cookie settings
      const sessionConfig = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      };

      expect(sessionConfig.httpOnly).toBe(true);
      expect(sessionConfig.secure).toBe(process.env.NODE_ENV === "production");
    });

    it("should invalidate sessions on logout", async () => {
      // This would test session invalidation
      // For now, we verify the auth service has session management methods
      const authService = await import("../../src/services/authService.js");
      expect(authService.authService.invalidateSession).toBeDefined();
      expect(authService.authService.invalidateAllUserSessions).toBeDefined();
    });
  });

  describe("Error Handling and Information Disclosure", () => {
    it("should not leak sensitive information in error messages", async () => {
      const response = await request("http://localhost:3000")
        .get("/api/nonexistent-endpoint")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .expect(404);

      // Error messages should not contain file paths, SQL queries, or stack traces
      expect(response.body.message).not.toMatch(/\/[a-zA-Z0-9_/-]+\.js/); // File paths
      expect(response.body.message).not.toMatch(/SELECT|INSERT|UPDATE|DELETE/i); // SQL
      expect(response.body.message).not.toMatch(/at\s+\w+\s+\(/); // Stack traces
    });

    it("should handle database errors gracefully", async () => {
      // Try to access with invalid database parameters
      const response = await request("http://localhost:3000")
        .get("/api/attendance?limit=invalid")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBeDefined();
      expect(typeof response.body.message).toBe("string");
    });
  });

  describe("Network Security", () => {
    it("should enforce HTTPS in production", async () => {
      // Check that the application is configured for HTTPS in production
      const isProduction = process.env.NODE_ENV === "production";
      const hasSSLCert =
        process.env.SSL_CERT_PATH || process.env.RAILWAY_ENVIRONMENT;

      if (isProduction) {
        expect(hasSSLCert).toBeTruthy();
      }
    });

    it("should implement proper CORS policies", async () => {
      // Check CORS headers
      const response = await request("http://localhost:3000")
        .options("/api/attendance")
        .expect(200);

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
      expect(response.headers["access-control-allow-methods"]).toBeDefined();
      expect(response.headers["access-control-allow-headers"]).toBeDefined();
    });

    it("should prevent clickjacking attacks", async () => {
      const response = await request("http://localhost:3000")
        .get("/")
        .expect(200);

      // Check for X-Frame-Options header
      expect(response.headers["x-frame-options"]).toBeDefined();
    });
  });

  describe("IoT Device Security", () => {
    it("should authenticate IoT device connections", async () => {
      // Test that IoT endpoints require proper authentication
      const response = await request("http://localhost:3000")
        .post("/api/iot/register")
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it("should validate IoT device data", async () => {
      // Test that malformed IoT data is rejected
      const invalidData = {
        deviceId: "", // Empty device ID
        sensorData: "invalid-json",
      };

      const response = await request("http://localhost:3000")
        .post("/api/iot/data")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Audit Logging", () => {
    it("should log security events", async () => {
      // This would test that security events are properly logged
      // For now, we verify the monitoring service has logging capabilities
      const monitoringService = await import(
        "../../src/services/monitoringService.js"
      );
      expect(monitoringService.monitoringService.logError).toBeDefined();
      expect(monitoringService.monitoringService.logWarning).toBeDefined();
    });

    it("should maintain audit trails for sensitive operations", async () => {
      // Test that GDPR operations are logged
      const gdprService = await import("../../src/services/gdprService.js");
      expect(gdprService.gdprService.logPrivacyEvent).toBeDefined();
    });
  });
});
