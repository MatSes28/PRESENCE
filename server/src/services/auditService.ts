import { db } from "../storage.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: number | null;
  action: string;
  resource: string;
  resourceId: string | number | null;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: any;
}

interface AuditQuery {
  userId?: number;
  action?: string;
  resource?: string;
  resourceId?: string | number;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResource: Record<string, number>;
  eventsByUser: Record<number, number>;
  recentActivity: AuditEvent[];
  suspiciousActivity: AuditEvent[];
}

class AuditService {
  private auditTableName = "audit_log";

  // Log an audit event
  async logEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    try {
      // In a real implementation, this would insert into an audit_log table
      // For now, we'll log to console and could store in a JSON file or database
      console.log("AUDIT EVENT:", {
        id: auditEvent.id,
        timestamp: auditEvent.timestamp.toISOString(),
        userId: auditEvent.userId,
        action: auditEvent.action,
        resource: auditEvent.resource,
        resourceId: auditEvent.resourceId,
        success: auditEvent.success,
        ipAddress: auditEvent.ipAddress,
        errorMessage: auditEvent.errorMessage,
      });

      // TODO: Store in database
      // await db.insert(auditLogTable).values(auditEvent);
    } catch (error) {
      console.error("Failed to log audit event:", error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  // Query audit events
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    // In a real implementation, this would query the audit_log table
    // For now, return empty array
    return [];
  }

  // Get audit statistics
  async getAuditStats(startDate: Date, endDate: Date): Promise<AuditStats> {
    // In a real implementation, this would aggregate data from audit_log table
    return {
      totalEvents: 0,
      eventsByAction: {},
      eventsByResource: {},
      eventsByUser: {},
      recentActivity: [],
      suspiciousActivity: [],
    };
  }

  // Predefined audit event methods
  async logUserLogin(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "USER_LOGIN",
      resource: "auth",
      resourceId: userId,
      ipAddress,
      userAgent,
      sessionId,
      success,
      errorMessage,
      metadata: {
        loginMethod: "password",
      },
    });
  }

  async logUserLogout(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "USER_LOGOUT",
      resource: "auth",
      resourceId: userId,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    });
  }

  async logPasswordChange(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "PASSWORD_CHANGE",
      resource: "user",
      resourceId: userId,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
      metadata: {
        changeType: "user_initiated",
      },
    });
  }

  async logTwoFactorSetup(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "2FA_SETUP",
      resource: "user",
      resourceId: userId,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    });
  }

  async logTwoFactorVerification(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "2FA_VERIFY",
      resource: "auth",
      resourceId: userId,
      ipAddress,
      userAgent,
      sessionId,
      success,
    });
  }

  async logResourceCreate(
    userId: number,
    resource: string,
    resourceId: string | number,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "CREATE",
      resource,
      resourceId,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    });
  }

  async logResourceUpdate(
    userId: number,
    resource: string,
    resourceId: string | number,
    oldValues: any,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "UPDATE",
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    });
  }

  async logResourceDelete(
    userId: number,
    resource: string,
    resourceId: string | number,
    oldValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: "DELETE",
      resource,
      resourceId,
      oldValues,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    });
  }

  async logResourceAccess(
    userId: number,
    resource: string,
    resourceId: string | number,
    action: string,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean = true
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `ACCESS_${action.toUpperCase()}`,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      sessionId,
      success,
    });
  }

  async logAttendanceRecord(
    userId: number | null,
    studentId: number,
    classSessionId: number,
    action: "CREATE" | "UPDATE" | "DELETE",
    oldValues: any,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `ATTENDANCE_${action}`,
      resource: "attendance_record",
      resourceId: `${studentId}_${classSessionId}`,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
      metadata: {
        studentId,
        classSessionId,
        automated: userId === null, // If no userId, it was automated
      },
    });
  }

  async logRFIDScan(
    deviceId: string,
    rfidUid: string,
    success: boolean,
    studentId?: number,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent({
      userId: null, // RFID scans are automated
      action: "RFID_SCAN",
      resource: "rfid_device",
      resourceId: deviceId,
      ipAddress: "device", // RFID devices don't have IP
      userAgent: "rfid_scanner",
      success,
      errorMessage,
      metadata: {
        rfidUid,
        studentId,
        deviceId,
      },
    });
  }

  async logSensorTrigger(
    deviceId: string,
    sensorType: "entry" | "exit",
    distance: number,
    success: boolean
  ): Promise<void> {
    await this.logEvent({
      userId: null, // Sensor triggers are automated
      action: "SENSOR_TRIGGER",
      resource: "sensor_device",
      resourceId: deviceId,
      ipAddress: "device",
      userAgent: "sensor_device",
      success,
      metadata: {
        sensorType,
        distance,
        deviceId,
      },
    });
  }

  async logAdminAction(
    adminId: number,
    action: string,
    targetResource: string,
    targetId: string | number,
    details: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await this.logEvent({
      userId: adminId,
      action: `ADMIN_${action.toUpperCase()}`,
      resource: targetResource,
      resourceId: targetId,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
      metadata: {
        adminAction: true,
        ...details,
      },
    });
  }

  async logSecurityEvent(
    eventType: string,
    userId: number | null,
    details: any,
    ipAddress: string,
    userAgent: string,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `SECURITY_${eventType.toUpperCase()}`,
      resource: "security",
      resourceId: null,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
      metadata: details,
    });
  }

  async logSystemEvent(
    eventType: string,
    details: any,
    severity: "low" | "medium" | "high" | "critical" = "low"
  ): Promise<void> {
    await this.logEvent({
      userId: null,
      action: `SYSTEM_${eventType.toUpperCase()}`,
      resource: "system",
      resourceId: null,
      ipAddress: "system",
      userAgent: "system",
      success: true,
      metadata: {
        severity,
        ...details,
      },
    });
  }

  // Compliance and reporting methods
  async getGDPRDataExport(userId: number): Promise<any> {
    // Return all data related to a user for GDPR compliance
    const userData = {
      profile: {},
      sessions: [],
      auditTrail: [],
      attendanceRecords: [],
      preferences: {},
    };

    // In a real implementation, this would gather all user data
    return userData;
  }

  async deleteUserData(userId: number): Promise<void> {
    // Log the deletion for compliance
    await this.logEvent({
      userId: null, // System action
      action: "GDPR_DELETE",
      resource: "user",
      resourceId: userId,
      ipAddress: "system",
      userAgent: "gdpr_compliance",
      success: true,
      metadata: {
        complianceAction: "right_to_be_forgotten",
      },
    });

    // In a real implementation, this would anonymize/delete user data
  }

  // Data retention management
  async cleanupOldAuditLogs(retentionDays: number = 2555): Promise<number> {
    // Delete audit logs older than retention period (default 7 years for compliance)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // In a real implementation, this would delete old records
    console.log(
      `Cleaning up audit logs older than ${cutoffDate.toISOString()}`
    );

    await this.logSystemEvent("AUDIT_CLEANUP", {
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    });

    return 0; // Return number of deleted records
  }

  // Suspicious activity detection
  async detectSuspiciousActivity(
    userId: number,
    events: AuditEvent[]
  ): Promise<any[]> {
    const suspiciousPatterns = [];

    // Check for rapid successive failed logins
    const failedLogins = events.filter(
      (e) => e.action === "USER_LOGIN" && !e.success && e.userId === userId
    );

    if (failedLogins.length >= 3) {
      const timeSpan =
        failedLogins[failedLogins.length - 1].timestamp.getTime() -
        failedLogins[0].timestamp.getTime();
      if (timeSpan < 300000) {
        // 5 minutes
        suspiciousPatterns.push({
          type: "brute_force_attempt",
          severity: "high",
          description: "Multiple failed login attempts in short time span",
          events: failedLogins,
        });
      }
    }

    // Check for logins from different countries (would need IP geolocation)
    // Check for unusual access times
    // Check for mass data access

    return suspiciousPatterns;
  }

  // Generate compliance reports
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    reportType: "access" | "changes" | "security" | "full"
  ): Promise<any> {
    const events = await this.queryEvents({
      startDate,
      endDate,
    });

    const report = {
      reportType,
      period: { startDate, endDate },
      generatedAt: new Date(),
      summary: {
        totalEvents: events.length,
        successfulOperations: events.filter((e) => e.success).length,
        failedOperations: events.filter((e) => !e.success).length,
      },
      events: events.slice(0, 1000), // Limit for report size
    };

    return report;
  }
}

export const auditService = new AuditService();
