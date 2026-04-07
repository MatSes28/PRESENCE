import db from "../storage.js";
import {
  students,
  users,
  attendanceRecords,
  attendanceRecordsArchive,
  emailNotifications,
  userSessions,
  gdprConsents,
  dataSubjectRequests,
  privacyAuditLogs,
  legalHolds,
} from "../schema.js";
import { eq, and, or, lt, sql, desc } from "drizzle-orm";
import crypto from "crypto";

interface ConsentRecord {
  id: string;
  userId: number;
  consentType:
    | "data_processing"
    | "email_notifications"
    | "parent_communication";
  consented: boolean;
  consentDate: Date;
  consentVersion: string;
  ipAddress: string;
  userAgent: string;
  expiresAt?: Date;
}

interface DataSubjectRequest {
  id: string;
  userId: number;
  requestType:
    | "access"
    | "rectification"
    | "erasure"
    | "restriction"
    | "portability"
    | "objection";
  status: "pending" | "processing" | "completed" | "rejected";
  requestDate: Date;
  completedDate?: Date;
  reason?: string;
  requestedBy: number; // User who made the request
}

interface PrivacyAuditLog {
  id: string;
  userId: number;
  action: string;
  dataAccessed: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  justification: string;
}

class GDPRService {
  private currentConsentVersion = "1.0.0";

  private async hasActiveLegalHold(
    subjectUserId: number,
    scope: string | null = null,
  ): Promise<boolean> {
    const now = new Date();
    const holds = await db
      .select({ id: legalHolds.id })
      .from(legalHolds)
      .where(
        and(
          eq(legalHolds.subjectUserId, subjectUserId),
          eq(legalHolds.active, true),
          scope ? eq(legalHolds.scope, scope) : sql`1=1`,
          sql`(${legalHolds.expiresAt} IS NULL OR ${legalHolds.expiresAt} > ${now})`,
        ),
      )
      .limit(1);

    return holds.length > 0;
  }

  // Consent Management
  async recordConsent(
    userId: number,
    consentType: ConsentRecord["consentType"],
    consented: boolean,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    // Store consent in database
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      consentType,
      consented,
      consentDate: new Date(),
      consentVersion: this.currentConsentVersion,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };

    // Log the consent for audit purposes
    await this.logPrivacyEvent(
      userId,
      `consent_${consentType}`,
      consentType,
      ipAddress,
      userAgent,
      `User ${consented ? "granted" : "revoked"} consent for ${consentType}`,
    );

    // Persist consent record (append-only; versioned)
    await db.insert(gdprConsents).values({
      id: consentRecord.id,
      userId: consentRecord.userId,
      consentType: consentRecord.consentType,
      consented: consentRecord.consented,
      consentVersion: consentRecord.consentVersion,
      ipAddress: consentRecord.ipAddress,
      userAgent: consentRecord.userAgent,
      justification: `User ${consented ? "granted" : "revoked"} consent for ${consentType}`,
      metadata: {},
      createdAt: consentRecord.consentDate,
      expiresAt: consentRecord.expiresAt,
      revokedAt: consented ? null : new Date(),
    });
  }

  async checkConsent(
    userId: number,
    consentType: ConsentRecord["consentType"],
  ): Promise<boolean> {
    const now = new Date();

    await this.logPrivacyEvent(
      userId,
      `consent_check`,
      consentType,
      "system",
      "gdpr_service",
      `Checking consent for ${consentType}`,
    );

    const latest = await db
      .select({ consented: gdprConsents.consented })
      .from(gdprConsents)
      .where(
        and(
          eq(gdprConsents.userId, userId),
          eq(gdprConsents.consentType, consentType),
          sql`(${gdprConsents.expiresAt} IS NULL OR ${gdprConsents.expiresAt} > ${now})`,
        ),
      )
      .orderBy(desc(gdprConsents.createdAt))
      .limit(1);

    return latest[0]?.consented ?? false;
  }

  async revokeConsent(
    userId: number,
    consentType: ConsentRecord["consentType"],
  ): Promise<void> {
    await this.recordConsent(
      userId,
      consentType,
      false,
      "system",
      "consent_revocation",
    );
  }

  // Data Subject Rights Implementation

  // Right of Access - Allow users to see their data
  async getDataAccessReport(userId: number): Promise<any> {
    const userData = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userData.length === 0) {
      throw new Error("User not found");
    }

    // Get related data (best-effort mapping)
    const userEmail = userData[0]?.email || null;
    const studentData = await db
      .select()
      .from(students)
      .where(
        userEmail
          ? or(eq(students.id, userId), eq(students.email, userEmail))
          : eq(students.id, userId),
      );

    const attendanceData = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, userId))
      .limit(100); // Limit for performance

    const notificationData = await db
      .select()
      .from(emailNotifications)
      .where(eq(emailNotifications.studentId, userId))
      .limit(50);

    return {
      user: userData[0],
      student: studentData[0] || null,
      attendanceRecords: attendanceData,
      notifications: notificationData,
      exportDate: new Date(),
      dataRetention: "7 years from last activity",
    };
  }

  // Right to Rectification - Allow users to correct their data
  async requestDataRectification(
    userId: number,
    requestedBy: number,
    corrections: any,
    reason?: string,
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    await db.insert(dataSubjectRequests).values({
      id: requestId,
      userId,
      requestType: "rectification",
      status: "pending",
      requestedBy,
      reason: reason || null,
      corrections: corrections || null,
      reviewedBy: null,
      reviewNotes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return requestId;
  }

  // Right to Erasure (Right to be Forgotten)
  async requestDataErasure(
    userId: number,
    requestedBy: number,
    reason: string,
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    await db.insert(dataSubjectRequests).values({
      id: requestId,
      userId,
      requestType: "erasure",
      status: "pending",
      requestedBy,
      reason,
      corrections: null,
      reviewedBy: null,
      reviewNotes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return requestId;
  }

  // Execute data erasure (admin function after approval)
  async executeDataErasure(userId: number, approvedBy: number): Promise<any> {
    const results = {
      userAnonymized: false,
      attendanceRecordsDeleted: 0,
      notificationsDeleted: 0,
      sessionsDeleted: 0,
      errors: [] as string[],
      executedAt: new Date(),
    };

    try {
      if (await this.hasActiveLegalHold(userId, "erasure")) {
        throw new Error(
          "Erasure blocked by an active legal hold. Contact the data protection officer.",
        );
      }

      // Capture pre-erasure identifiers for best-effort linkage.
      const existingUser = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const originalEmail = existingUser[0]?.email || null;

      // Anonymize user data instead of deleting (for audit trails)
      await db
        .update(users)
        .set({
          name: "[DELETED]",
          email: `deleted_${userId}@anonymous.local`,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      results.userAnonymized = true;

      // Attendance records may be covered by academic integrity retention.
      // Default behavior: retain records; rely on pseudonymization of user/student.
      results.attendanceRecordsDeleted = 0;

      // Delete email notifications
      const notificationResult = await db
        .delete(emailNotifications)
        .where(eq(emailNotifications.studentId, userId))
        .returning();

      results.notificationsDeleted = notificationResult.length;

      // Delete user sessions
      const sessionResult = await db
        .delete(userSessions)
        .where(eq(userSessions.userId, userId))
        .returning();

      results.sessionsDeleted = sessionResult.length;

      // Pseudonymize student record when it exists.
      await db
        .update(students)
        .set({
          name: "[ERASED]",
          studentId: `ERASED_${userId}`,
          email: null,
          rfidUid: null,
          parentEmail: `deleted_${userId}@anonymous.local`,
          parentName: null,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          originalEmail
            ? or(eq(students.id, userId), eq(students.email, originalEmail))
            : eq(students.id, userId),
        );

      // Mark the most recent erasure request as completed (if present)
      const pending = await db
        .select({ id: dataSubjectRequests.id })
        .from(dataSubjectRequests)
        .where(
          and(
            eq(dataSubjectRequests.userId, userId),
            eq(dataSubjectRequests.requestType, "erasure"),
            sql`${dataSubjectRequests.status} IN ('pending','processing')`,
          ),
        )
        .orderBy(desc(dataSubjectRequests.createdAt))
        .limit(1);

      if (pending[0]?.id) {
        await db
          .update(dataSubjectRequests)
          .set({
            status: "completed",
            reviewedBy: approvedBy,
            reviewNotes:
              "Erasure executed (pseudonymization + session/notification deletion)",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dataSubjectRequests.id, pending[0].id));
      }

      // Log the erasure execution
      await this.logPrivacyEvent(
        userId,
        "data_erasure_executed",
        `Data erasure completed by admin ${approvedBy}`,
        "system",
        "gdpr_service",
        `Erased: ${results.attendanceRecordsDeleted} attendance records, ${results.notificationsDeleted} notifications, ${results.sessionsDeleted} sessions`,
      );
    } catch (error) {
      console.error("Data erasure execution error:", error);
      results.errors.push(error.message);
    }

    return results;
  }

  // Right to Data Portability
  async exportDataPortability(userId: number): Promise<any> {
    const dataReport = await this.getDataAccessReport(userId);

    // Convert to portable format (JSON)
    const portableData = {
      version: "1.0",
      exportDate: new Date(),
      dataController: "CLIRDEC:PRESENCE System",
      dataSubject: dataReport.user,
      data: {
        personal: dataReport.student,
        attendance: dataReport.attendanceRecords,
        communications: dataReport.notifications,
      },
      gdprRights: {
        access: true,
        rectification: true,
        erasure: true,
        portability: true,
        restriction: true,
        objection: true,
      },
    };

    return portableData;
  }

  // Right to Restriction of Processing
  async restrictDataProcessing(
    userId: number,
    restrictionType: "attendance" | "notifications" | "all",
    requestedBy: number,
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    await db.insert(dataSubjectRequests).values({
      id: requestId,
      userId,
      requestType: "restriction",
      status: "pending",
      requestedBy,
      reason: `restrictionType=${restrictionType}`,
      corrections: null,
      reviewedBy: null,
      reviewNotes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Right to Object to Processing
  async objectToProcessing(
    userId: number,
    processingType: string,
    requestedBy: number,
  ): Promise<void> {
    const requestId = crypto.randomUUID();
    await db.insert(dataSubjectRequests).values({
      id: requestId,
      userId,
      requestType: "objection",
      status: "pending",
      requestedBy,
      reason: processingType,
      corrections: null,
      reviewedBy: null,
      reviewNotes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Privacy Audit Logging
  async logPrivacyEvent(
    userId: number,
    action: string,
    dataAccessed: string,
    ipAddress: string,
    userAgent: string,
    justification: string,
  ): Promise<void> {
    const auditLog: PrivacyAuditLog = {
      id: crypto.randomUUID(),
      userId,
      action,
      dataAccessed,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      justification,
    };

    try {
      await db.insert(privacyAuditLogs).values({
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        dataAccessed: auditLog.dataAccessed,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        justification: auditLog.justification,
        metadata: {},
        createdAt: auditLog.timestamp,
      });
    } catch (error) {
      console.warn("Privacy audit log write failed:", error);
    }
  }

  // Admin: list DSAR requests
  async listDataSubjectRequests(filters: {
    userId?: number;
    status?: string;
    requestType?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const conditions: any[] = [];
    if (filters.userId)
      conditions.push(eq(dataSubjectRequests.userId, filters.userId));
    if (filters.status)
      conditions.push(eq(dataSubjectRequests.status, filters.status));
    if (filters.requestType)
      conditions.push(eq(dataSubjectRequests.requestType, filters.requestType));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const query = db
      .select()
      .from(dataSubjectRequests)
      .orderBy(desc(dataSubjectRequests.createdAt))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    return whereClause ? query.where(whereClause) : query;
  }

  // Admin: review / complete DSAR
  async reviewDataSubjectRequest(params: {
    requestId: string;
    status: "processing" | "completed" | "rejected";
    reviewedBy: number;
    reviewNotes?: string;
  }): Promise<void> {
    await db
      .update(dataSubjectRequests)
      .set({
        status: params.status,
        reviewedBy: params.reviewedBy,
        reviewNotes: params.reviewNotes || null,
        completedAt: params.status === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(dataSubjectRequests.id, params.requestId));
  }

  // Data Retention Management
  async enforceDataRetention(): Promise<void> {
    const retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years
    const cutoffDate = new Date(Date.now() - retentionPeriod);

    // Archive old attendance records
    const oldRecords = await db
      .select()
      .from(attendanceRecords)
      .where(lt(attendanceRecords.createdAt, cutoffDate));

    if (oldRecords.length > 0) {
      console.log(
        `GDPR: Archiving ${oldRecords.length} old attendance records`,
      );

      await db.insert(attendanceRecordsArchive).values(
        oldRecords.map((r) => ({
          originalRecordId: r.id,
          studentId: r.studentId,
          classSessionId: r.classSessionId,
          entryTime: r.entryTime,
          exitTime: r.exitTime,
          status: r.status,
          rfidDetected: r.rfidDetected,
          sensorDetected: r.sensorDetected,
          isValid: r.isValid,
          discrepancyFlag: r.discrepancyFlag,
          notes: r.notes,
          originalCreatedAt: r.createdAt,
          originalUpdatedAt: r.updatedAt,
          archiveReason: "retention",
        })),
      );

      await db
        .delete(attendanceRecords)
        .where(lt(attendanceRecords.createdAt, cutoffDate));
    }

    // Clean up old notifications
    const oldNotifications = await db
      .select()
      .from(emailNotifications)
      .where(lt(emailNotifications.sentAt, cutoffDate));

    if (oldNotifications.length > 0) {
      console.log(
        `GDPR: Cleaning up ${oldNotifications.length} old notifications`,
      );
    }
  }

  // Privacy Impact Assessment Helper
  async performPrivacyImpactAssessment(dataProcessing: string): Promise<any> {
    // This would be used for new features to assess privacy impact
    return {
      processing: dataProcessing,
      riskLevel: "low", // Would be calculated based on data sensitivity
      mitigationMeasures: [
        "Data minimization",
        "Purpose limitation",
        "Consent management",
        "Data subject rights",
      ],
      assessmentDate: new Date(),
    };
  }

  // Automated Privacy Monitoring
  startPrivacyMonitoring(): void {
    // Run retention enforcement daily
    setInterval(
      () => {
        this.enforceDataRetention();
      },
      24 * 60 * 60 * 1000,
    ); // Daily
  }
}

export const gdprService = new GDPRService();

// Start privacy monitoring
gdprService.startPrivacyMonitoring();
