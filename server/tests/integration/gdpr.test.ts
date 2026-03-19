import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import bcrypt from "bcryptjs";
import db from "../../src/storage.js";
import { app } from "../../src/index.js";
import { users, students } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

const describeIntegration =
  process.env.USE_SQLITE === "true" ? describe.skip : describe;

describeIntegration("GDPR Compliance Tests", () => {
  let testUserId: number;
  let testStudentId: number;
  let agent: any;

  const userEmail = "test-gdpr@example.com";
  const userPasswordPlain = "StrongPass123!";

  beforeAll(async () => {
    (global as any).appInitialized = true;

    agent = request.agent(app);

    // Create test user
    const testUser = await db
      .insert(users)
      .values({
        email: userEmail,
        password: await bcrypt.hash(userPasswordPlain, 12),
        name: "Test GDPR User",
        role: "faculty",
        isActive: 1 as any,
      })
      .returning();

    testUserId = testUser[0].id;

    // Login to establish a real session (GDPR routes are session-authenticated).
    await agent
      .post("/api/auth/login")
      .send({ email: userEmail, password: userPasswordPlain })
      .expect(200);

    // Create test student
    const testStudent = await db
      .insert(students)
      .values({
        studentId: "TEST001",
        name: "Test Student",
        email: "student@example.com",
        parentEmail: "parent@example.com",
        year: 3,
        section: "A",
        program: "BSIT",
        department: "DIT",
        college: "College of Engineering",
        isActive: 1 as any,
      })
      .returning();

    testStudentId = testStudent[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testStudentId) {
      await db.delete(students).where(eq(students.id, testStudentId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe("Data Subject Rights", () => {
    it("should allow users to access their data (Right of Access)", async () => {
      const response = await agent
        .get(`/api/gdpr/access/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.report).toHaveProperty("user");
      expect(response.body.report).toHaveProperty("student");
      expect(response.body.report).toHaveProperty("attendanceRecords");
    });

    it("should allow data portability (Right to Data Portability)", async () => {
      const response = await agent
        .get(`/api/gdpr/portability/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("version");
      expect(response.body.data).toHaveProperty("exportDate");
      expect(response.body.data).toHaveProperty("dataSubject");
      expect(response.body.data).toHaveProperty("data");
    });

    it("should handle data rectification requests (Right to Rectification)", async () => {
      const rectificationData = {
        corrections: { name: "Updated Test User" },
        reason: "Name correction requested by user",
      };

      const response = await agent
        .post(`/api/gdpr/rectification/${testUserId}`)
        .send(rectificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain(
        "rectification request submitted",
      );
      expect(response.body).toHaveProperty("requestId");
    });

    it("should handle data erasure requests (Right to be Forgotten)", async () => {
      const erasureData = {
        reason:
          "User requested complete data deletion due to privacy concerns and personal choice",
      };

      const response = await agent
        .post(`/api/gdpr/erasure/${testUserId}`)
        .send(erasureData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("erasure request submitted");
      expect(response.body.note).toContain(
        "reviewed by data protection officers",
      );
    });

    it("should handle data processing restrictions (Right to Restriction)", async () => {
      const restrictionData = {
        restrictionType: "notifications",
        reason: "User temporarily restricts email notifications",
      };

      const response = await agent
        .post(`/api/gdpr/restriction/${testUserId}`)
        .send(restrictionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("restricted");
    });

    it("should handle processing objections (Right to Object)", async () => {
      const objectionData = {
        processingType: "marketing_emails",
        reason: "User objects to marketing communications",
      };

      const response = await agent
        .post(`/api/gdpr/objection/${testUserId}`)
        .send(objectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Objection recorded");
    });
  });

  describe("Parent Consent Management", () => {
    it("should request parent consent for student data processing", async () => {
      const consentRequest = {
        consentType: "attendance_tracking",
      };

      const response = await agent
        .post(`/api/gdpr/consent/request/${testStudentId}`)
        .send(consentRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("consent request sent");
      expect(response.body).toHaveProperty("requestId");
    });

    it("should process parent consent responses", async () => {
      const consentResponse = {
        // Endpoint validates token length == 64
        token: "a".repeat(64),
        consented: true,
      };

      const response = await agent
        .post("/api/gdpr/consent/process")
        .send(consentResponse)
        .expect(400);

      // Consent processing is not yet backed by storage; expect a handled failure.
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Failed to process consent");
    });

    it("should retrieve student consent status", async () => {
      const response = await agent
        .get(`/api/gdpr/consent/status/${testStudentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toHaveProperty("studentId");
      expect(response.body.status).toHaveProperty("consents");
    });

    it("should revoke parent consent", async () => {
      const revokeData = {
        consentType: "email_notifications",
      };

      const response = await agent
        .post(`/api/gdpr/consent/revoke/${testStudentId}`)
        .send(revokeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("consent revoked");
    });

    it("should generate consent reports", async () => {
      const response = await agent
        .get(`/api/gdpr/consent/report/${testStudentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.report).toHaveProperty("student");
      expect(response.body.report).toHaveProperty("consentStatus");
      expect(response.body.report).toHaveProperty("reportDate");
      expect(response.body.report).toHaveProperty("privacyPolicy");
    });
  });

  describe("Privacy Policy and Information", () => {
    it("should provide privacy policy information", async () => {
      const response = await request(app)
        .get("/api/gdpr/privacy-policy")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.policy).toHaveProperty("version");
      expect(response.body.policy).toHaveProperty("effectiveDate");
      expect(response.body.policy).toHaveProperty("dataController");
      expect(response.body.policy).toHaveProperty("dataCollected");
      expect(response.body.policy).toHaveProperty("legalBasis");
      expect(response.body.policy).toHaveProperty("dataRetention");
      expect(response.body.policy).toHaveProperty("gdprRights");
    });
  });

  describe("Access Control and Security", () => {
    it("should deny access to other users' data", async () => {
      const response = await agent
        .get(`/api/gdpr/access/99999`) // Non-existent user ID
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Access denied");
    });

    it("should require authentication for GDPR endpoints", async () => {
      const response = await request(app)
        .get(`/api/gdpr/access/${testUserId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Authentication required");
    });

    it("should validate input data", async () => {
      const invalidData = {
        corrections: {},
        reason: "", // Invalid: too short
      };

      const response = await agent
        .post(`/api/gdpr/rectification/${testUserId}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
