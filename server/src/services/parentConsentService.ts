import db from "../storage.js";
import { students, parentConsentRequests, parentConsents } from "../schema.js";
import { eq, and, desc, lte, gt, isNull } from "drizzle-orm";
import crypto from "crypto";
import { gdprService } from "./gdprService.js";
import { emailService } from "./emailService.js";
import { encryptionService } from "./encryptionService.js";

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
  consentToken: string;
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
  private consentValidityDays = 365;

  private resolveParentEmail(student: any): string {
    if (!student?.parentEmail) {
      throw new Error("Parent email not available for this student");
    }

    try {
      return encryptionService.decryptParentData(
        student.parentEmail,
        student.parentName || undefined,
      ).email;
    } catch {
      return student.parentEmail;
    }
  }

  private generateConsentToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async requestParentConsent(
    studentId: number,
    consentType: ParentConsent["consentType"],
    requestedBy: number,
  ): Promise<string> {
    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (student.length === 0) throw new Error("Student not found");

    const parentEmail = this.resolveParentEmail(student[0]);
    const token = this.generateConsentToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const consentRequest: ConsentRequest = {
      id: crypto.randomUUID(),
      studentId,
      parentEmail,
      consentType,
      requestDate: new Date(),
      status: "pending",
      token,
      expiresAt,
      requestedBy,
    };

    await db.insert(parentConsentRequests).values({
      id: consentRequest.id,
      studentId: consentRequest.studentId,
      parentEmail: consentRequest.parentEmail,
      consentType: consentRequest.consentType,
      requestDate: consentRequest.requestDate,
      status: consentRequest.status,
      token: consentRequest.token,
      expiresAt: consentRequest.expiresAt,
      requestedBy: consentRequest.requestedBy,
      updatedAt: new Date(),
    });

    await gdprService.logPrivacyEvent(
      studentId,
      "parent_consent_requested",
      consentType,
      "system",
      "parent_consent_service",
      `Parent consent requested for ${consentType} by user ${requestedBy}`,
    );

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const consentLink = `${frontend}/consent?token=${token}`;
    await emailService.sendEmail({
      to: parentEmail,
      subject: `Parent Consent Request: ${consentType}`,
      htmlContent: `
        <h2>Parent Consent Request</h2>
        <p>Please review and submit your consent for <strong>${consentType}</strong>.</p>
        <p>This link expires on ${expiresAt.toISOString()}.</p>
        <p><a href="${consentLink}">Review Consent</a></p>
      `,
      textContent: `Parent Consent Request\nConsent type: ${consentType}\nLink: ${consentLink}`,
    });

    return consentRequest.id;
  }

  async processParentConsent(
    token: string,
    consented: boolean,
    ipAddress: string,
    userAgent: string,
  ): Promise<boolean> {
    const now = new Date();
    const reqRow = await db
      .select()
      .from(parentConsentRequests)
      .where(
        and(
          eq(parentConsentRequests.token, token),
          eq(parentConsentRequests.status, "pending"),
          gt(parentConsentRequests.expiresAt, now),
        ),
      )
      .limit(1);

    if (!reqRow.length) return false;

    const request = reqRow[0];
    await db.insert(parentConsents).values({
      requestId: request.id,
      studentId: request.studentId,
      parentEmail: request.parentEmail,
      consentType: request.consentType,
      consented,
      consentDate: now,
      consentVersion: this.consentVersion,
      ipAddress,
      userAgent,
      expiresAt: consented
        ? new Date(
            now.getTime() + this.consentValidityDays * 24 * 60 * 60 * 1000,
          )
        : null,
      revokedAt: consented ? null : now,
      metadata: { source: "parent_consent_link" },
      updatedAt: now,
    });

    await db
      .update(parentConsentRequests)
      .set({
        status: consented ? "approved" : "rejected",
        processedAt: now,
        processedIpAddress: ipAddress,
        processedUserAgent: userAgent,
        updatedAt: now,
      })
      .where(eq(parentConsentRequests.id, request.id));

    await gdprService.logPrivacyEvent(
      request.studentId,
      consented ? "parent_consent_approved" : "parent_consent_rejected",
      request.consentType,
      ipAddress,
      userAgent,
      `Parent consent ${consented ? "approved" : "rejected"}`,
    );

    return true;
  }

  async checkParentConsent(
    studentId: number,
    consentType: ParentConsent["consentType"],
  ): Promise<boolean> {
    const now = new Date();
    const row = await db
      .select({ id: parentConsents.id })
      .from(parentConsents)
      .where(
        and(
          eq(parentConsents.studentId, studentId),
          eq(parentConsents.consentType, consentType),
          eq(parentConsents.consented, true),
          isNull(parentConsents.revokedAt),
          gt(parentConsents.expiresAt, now),
        ),
      )
      .orderBy(desc(parentConsents.consentDate))
      .limit(1);

    return row.length > 0;
  }

  async getStudentConsentStatus(studentId: number): Promise<any> {
    const now = new Date();
    const consents = await db
      .select()
      .from(parentConsents)
      .where(eq(parentConsents.studentId, studentId))
      .orderBy(desc(parentConsents.consentDate));

    const pending = await db
      .select()
      .from(parentConsentRequests)
      .where(
        and(
          eq(parentConsentRequests.studentId, studentId),
          eq(parentConsentRequests.status, "pending"),
          gt(parentConsentRequests.expiresAt, now),
        ),
      );

    const latestByType = new Map<string, any>();
    for (const c of consents) {
      if (!latestByType.has(c.consentType)) latestByType.set(c.consentType, c);
    }

    const resolveStatus = (type: ParentConsent["consentType"]) => {
      const c = latestByType.get(type);
      const hasPending = pending.some((p) => p.consentType === type);
      if (!c) {
        return {
          consented: false,
          status: hasPending ? "pending" : "not_requested",
        };
      }
      const expired = c.expiresAt ? new Date(c.expiresAt) <= now : false;
      const revoked = !!c.revokedAt;
      return {
        consented: !!c.consented && !expired && !revoked,
        status: revoked
          ? "revoked"
          : expired
            ? "expired"
            : c.consented
              ? "approved"
              : "rejected",
        updatedAt: c.updatedAt,
        expiresAt: c.expiresAt,
      };
    };

    return {
      studentId,
      consents: {
        attendance_tracking: resolveStatus("attendance_tracking"),
        email_notifications: resolveStatus("email_notifications"),
        data_processing: resolveStatus("data_processing"),
        emergency_contact: resolveStatus("emergency_contact"),
      },
      lastUpdated: new Date(),
    };
  }

  async revokeParentConsent(
    studentId: number,
    consentType: ParentConsent["consentType"],
    requestedBy: number,
  ): Promise<void> {
    const now = new Date();
    await db
      .update(parentConsents)
      .set({
        revokedAt: now,
        consented: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(parentConsents.studentId, studentId),
          eq(parentConsents.consentType, consentType),
          isNull(parentConsents.revokedAt),
        ),
      );

    await gdprService.logPrivacyEvent(
      studentId,
      "parent_consent_revoked",
      consentType,
      "system",
      "parent_consent_service",
      `Parent consent revoked by user ${requestedBy}`,
    );
  }

  async sendConsentRenewalReminders(): Promise<void> {
    const renewalThreshold = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const cutoffDate = new Date(Date.now() + renewalThreshold);

    const expiringSoon = await db
      .select()
      .from(parentConsents)
      .where(
        and(
          eq(parentConsents.consented, true),
          isNull(parentConsents.revokedAt),
          lte(parentConsents.expiresAt, cutoffDate),
          gt(parentConsents.expiresAt, now),
        ),
      );

    for (const consent of expiringSoon) {
      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
      const link = `${frontend}/student/${consent.studentId}/privacy`;
      await emailService.sendEmail({
        to: consent.parentEmail,
        subject: `Consent Renewal Reminder: ${consent.consentType}`,
        htmlContent: `<p>Your consent for <strong>${consent.consentType}</strong> is expiring on ${new Date(consent.expiresAt).toISOString()}.</p><p>Review and renew: <a href="${link}">${link}</a></p>`,
        textContent: `Consent renewal reminder for ${consent.consentType}. Renew at: ${link}`,
      });
    }

    console.log("Consent renewal reminders sent");
  }

  async validateDataOperation(
    studentId: number,
    operation: "attendance_tracking" | "email_notification" | "data_access",
    ipAddress: string,
    userAgent: string,
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
      await gdprService.logPrivacyEvent(
        studentId,
        "consent_violation_attempt",
        `operation: ${operation}, consent_type: ${consentType}`,
        ipAddress,
        userAgent,
        "Data operation attempted without valid parent consent",
      );
    }

    return hasConsent;
  }

  async generateConsentReport(studentId: number): Promise<any> {
    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (student.length === 0) throw new Error("Student not found");

    const consentStatus = await this.getStudentConsentStatus(studentId);
    const parentEmail = this.resolveParentEmail(student[0]);

    return {
      student: {
        id: student[0].id,
        name: student[0].name,
        parentEmail,
      },
      consentStatus,
      reportDate: new Date(),
      validUntil: new Date(
        Date.now() + this.consentValidityDays * 24 * 60 * 60 * 1000,
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

  startConsentManagement(): void {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      setInterval(
        () => {
          this.sendConsentRenewalReminders();
        },
        7 * 24 * 60 * 60 * 1000,
      );

      setInterval(
        () => {
          this.cleanupExpiredConsents();
        },
        7 * 24 * 60 * 60 * 1000,
      );
    } else {
      setInterval(
        () => {
          this.sendConsentRenewalReminders();
          this.cleanupExpiredConsents();
        },
        24 * 60 * 60 * 1000,
      );
    }
  }

  private async cleanupExpiredConsents(): Promise<void> {
    const now = new Date();

    await db
      .update(parentConsentRequests)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(parentConsentRequests.status, "pending"),
          lte(parentConsentRequests.expiresAt, now),
        ),
      );

    await db
      .update(parentConsents)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(parentConsents.consented, true),
          isNull(parentConsents.revokedAt),
          lte(parentConsents.expiresAt, now),
        ),
      );

    console.log("Expired consents cleaned up");
  }
}

export const parentConsentService = new ParentConsentService();

parentConsentService.startConsentManagement();
