import { db } from "../storage.js";
import {
  students,
  users,
  attendanceRecords,
  emailNotifications,
  userSessions,
} from "../schema.js";
import { eq, and, lt, sql } from "drizzle-orm";
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

  // Consent Management
  async recordConsent(
    userId: number,
    consentType: ConsentRecord["consentType"],
    consented: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // In a real implementation, this would be stored in a consent table
    // For now, we'll log it and store in a simple structure
    const consentRecord: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      consentType,
      consented,
      consentDate: new Date(),
      consentVersion: this.currentConsentVersion,
      ipAddress,
      userAgent,
    };

    console.log("GDPR Consent Recorded:", consentRecord);

    // TODO: Store in database
    // await db.insert(consentRecords).values(consentRecord);
  }

  async checkConsent(
    userId: number,
    consentType: ConsentRecord["consentType"]
  ): Promise<boolean> {
    // TODO: Check database for valid consent
    // For now, return true for development
    return true;
  }

  async revokeConsent(
    userId: number,
    consentType: ConsentRecord["consentType"]
  ): Promise<void> {
    await this.recordConsent(
      userId,
      consentType,
      false,
      "system",
      "consent_revocation"
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

    // Get related data
    const studentData = await db
      .select()
      .from(students)
      .where(eq(students.id, userId));

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
    corrections: any
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    // Log the rectification request
    console.log("GDPR Rectification Request:", {
      requestId,
      userId,
      requestedBy,
      corrections,
      timestamp: new Date(),
    });

    // TODO: Store in data_subject_requests table
    // TODO: Implement automated rectification workflow

    return requestId;
  }

  // Right to Erasure (Right to be Forgotten)
  async requestDataErasure(
    userId: number,
    requestedBy: number,
    reason: string
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    // Log the erasure request
    console.log("GDPR Erasure Request:", {
      requestId,
      userId,
      requestedBy,
      reason,
      timestamp: new Date(),
    });

    // TODO: Implement data anonymization/deletion workflow
    // This is complex and should be done carefully with legal review

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

      // Delete attendance records
      const attendanceResult = await db
        .delete(attendanceRecords)
        .where(eq(attendanceRecords.studentId, userId))
        .returning();

      results.attendanceRecordsDeleted = attendanceResult.length;

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

      // Log the erasure execution
      await this.logPrivacyEvent(
        userId,
        "data_erasure_executed",
        `Data erasure completed by admin ${approvedBy}`,
        "system",
        "gdpr_service",
        `Erased: ${results.attendanceRecordsDeleted} attendance records, ${results.notificationsDeleted} notifications, ${results.sessionsDeleted} sessions`
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
    requestedBy: number
  ): Promise<void> {
    // TODO: Implement processing restrictions
    console.log("GDPR Processing Restriction:", {
      userId,
      restrictionType,
      requestedBy,
      timestamp: new Date(),
    });
  }

  // Right to Object to Processing
  async objectToProcessing(
    userId: number,
    processingType: string,
    requestedBy: number
  ): Promise<void> {
    // TODO: Implement processing objections
    console.log("GDPR Processing Objection:", {
      userId,
      processingType,
      requestedBy,
      timestamp: new Date(),
    });
  }

  // Privacy Audit Logging
  async logPrivacyEvent(
    userId: number,
    action: string,
    dataAccessed: string,
    ipAddress: string,
    userAgent: string,
    justification: string
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

    console.log("GDPR Privacy Audit:", auditLog);

    // TODO: Store in privacy_audit_log table
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
        `GDPR: Archiving ${oldRecords.length} old attendance records`
      );

      // TODO: Move to archive table instead of deleting
      // For now, just log the action
    }

    // Clean up old notifications
    const oldNotifications = await db
      .select()
      .from(emailNotifications)
      .where(lt(emailNotifications.sentAt, cutoffDate));

    if (oldNotifications.length > 0) {
      console.log(
        `GDPR: Cleaning up ${oldNotifications.length} old notifications`
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
    setInterval(() => {
      this.enforceDataRetention();
    }, 24 * 60 * 60 * 1000); // Daily
  }
}

export const gdprService = new GDPRService();

// Start privacy monitoring
gdprService.startPrivacyMonitoring();
