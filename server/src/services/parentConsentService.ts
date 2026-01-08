import { db } from "../storage.js";
import { students, users } from "../schema.js";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { gdprService } from "./gdprService.js";

interface ParentConsent {
  id: string;
  studentId: number;
  parentEmail: string;
  consentType:
    | "attendance_tracking"
    | "email_notifications"
    | "data_processing"
    | "emergency_contact";
  consented: boolean;
  consentDate: Date;
  consentVersion: string;
  ipAddress: string;
  userAgent: string;
  expiresAt?: Date;
  consentToken: string; // For secure consent verification
}

interface ConsentRequest {
  id: string;
  studentId: number;
  parentEmail: string;
  consentType: ParentConsent["consentType"];
  requestDate: Date;
  status: "pending" | "approved" | "rejected" | "expired";
  token: string;
  expiresAt: Date;
  requestedBy: number;
}

class ParentConsentService {
  private consentVersion = "1.0.0";
  private consentValidityDays = 365; // 1 year

  // Generate secure consent token
  private generateConsentToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // Request parent consent
  async requestParentConsent(
    studentId: number,
    consentType: ParentConsent["consentType"],
    requestedBy: number
  ): Promise<string> {
    // Get student and parent information
    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (student.length === 0) {
      throw new Error("Student not found");
    }

    if (!student[0].parentEmail) {
      throw new Error("Parent email not available for this student");
    }

    const token = this.generateConsentToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const consentRequest: ConsentRequest = {
      id: crypto.randomUUID(),
      studentId,
      parentEmail: student[0].parentEmail,
      consentType,
      requestDate: new Date(),
      status: "pending",
      token,
      expiresAt,
      requestedBy,
    };

    console.log("Parent Consent Request Created:", consentRequest);

    // TODO: Store in parent_consent_requests table
    // TODO: Send email to parent with consent link

    return consentRequest.id;
  }

  // Process parent consent (when parent clicks email link)
  async processParentConsent(
    token: string,
    consented: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    // TODO: Find consent request by token from database
    // For now, log the consent request for debugging
    console.log("[GDPR] Processing consent request:", {
      token,
      consented,
      ipAddress,
      timestamp: new Date(),
    });

    // Return false to indicate database not available for storage
    return false;
  }

  // Check if parent consent is valid
  async checkParentConsent(
    studentId: number,
    consentType: ParentConsent["consentType"]
  ): Promise<boolean> {
    // TODO: Check database for valid consent
    // For development, log and return false to require actual consent
    console.log(
      `[GDPR] Checking consent for student ${studentId}, type: ${consentType}`
    );
    // Return false until database storage is implemented
    return false;
  }

  // Get consent status for a student
  async getStudentConsentStatus(studentId: number): Promise<any> {
    // TODO: Query database for all consents
    // Return pending status until database storage is implemented
    console.log(`[GDPR] Getting consent status for student ${studentId}`);
    return {
      studentId,
      consents: {
        attendance_tracking: {
          consented: false,
          status: "pending",
        },
        email_notifications: {
          consented: false,
          status: "pending",
        },
        data_processing: {
          consented: false,
          status: "pending",
        },
        emergency_contact: {
          consented: false,
          status: "pending",
        },
      },
      lastUpdated: new Date(),
      note: "Consent tracking requires database storage implementation",
    };
  }

  // Revoke parent consent
  async revokeParentConsent(
    studentId: number,
    consentType: ParentConsent["consentType"],
    requestedBy: number
  ): Promise<void> {
    console.log("Parent Consent Revoked:", {
      studentId,
      consentType,
      requestedBy,
      timestamp: new Date(),
    });

    // TODO: Update consent in database
    // TODO: Notify relevant systems (stop email notifications, etc.)
  }

  // Send consent renewal reminders
  async sendConsentRenewalReminders(): Promise<void> {
    const renewalThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days before expiry
    const cutoffDate = new Date(Date.now() + renewalThreshold);

    // TODO: Find consents expiring soon
    // TODO: Send renewal emails to parents

    console.log("Consent renewal reminders sent");
  }

  // Validate consent for data operations
  async validateDataOperation(
    studentId: number,
    operation: "attendance_tracking" | "email_notification" | "data_access",
    ipAddress: string,
    userAgent: string
  ): Promise<boolean> {
    let consentType: ParentConsent["consentType"];

    switch (operation) {
      case "attendance_tracking":
        consentType = "attendance_tracking";
        break;
      case "email_notification":
        consentType = "email_notifications";
        break;
      case "data_access":
        consentType = "data_processing";
        break;
      default:
        return false;
    }

    const hasConsent = await this.checkParentConsent(studentId, consentType);

    if (!hasConsent) {
      // Log privacy violation attempt
      await gdprService.logPrivacyEvent(
        studentId,
        `consent_violation_attempt`,
        `operation: ${operation}, consent_type: ${consentType}`,
        ipAddress,
        userAgent,
        "Data operation attempted without valid parent consent"
      );
    }

    return hasConsent;
  }

  // Generate consent form/report
  async generateConsentReport(studentId: number): Promise<any> {
    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (student.length === 0) {
      throw new Error("Student not found");
    }

    const consentStatus = await this.getStudentConsentStatus(studentId);

    return {
      student: {
        id: student[0].id,
        name: student[0].name,
        parentEmail: student[0].parentEmail,
      },
      consentStatus,
      reportDate: new Date(),
      validUntil: new Date(
        Date.now() + this.consentValidityDays * 24 * 60 * 60 * 1000
      ),
      privacyPolicy: {
        version: this.consentVersion,
        dataCollected: [
          "Student attendance records",
          "Email address for notifications",
          "RFID card data for identification",
          "Emergency contact information",
        ],
        dataUsage: [
          "Attendance tracking and reporting",
          "Parent notifications",
          "Academic performance monitoring",
          "Emergency communications",
        ],
        dataRetention: "7 years from last activity",
        parentRights: [
          "Access to child's data",
          "Correction of inaccurate data",
          "Deletion of data (right to be forgotten)",
          "Data portability",
          "Objection to processing",
        ],
      },
    };
  }

  // Start automated consent management
  startConsentManagement(): void {
    // For development/testing, use shorter intervals
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      // Send renewal reminders weekly (7 days)
      setInterval(() => {
        this.sendConsentRenewalReminders();
      }, 7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds

      // Clean up expired consents monthly (30 days) - split into weekly checks
      setInterval(() => {
        this.cleanupExpiredConsents();
      }, 7 * 24 * 60 * 60 * 1000); // Weekly cleanup in production
    } else {
      // Development: run daily for testing
      setInterval(() => {
        this.sendConsentRenewalReminders();
        this.cleanupExpiredConsents();
      }, 24 * 60 * 60 * 1000); // Daily in development
    }
  }

  // Clean up expired consents
  private async cleanupExpiredConsents(): Promise<void> {
    const now = new Date();

    // TODO: Find and remove expired consents
    console.log("Expired consents cleaned up");
  }
}

export const parentConsentService = new ParentConsentService();

// Start consent management
parentConsentService.startConsentManagement();
