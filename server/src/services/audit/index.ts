import { auditLogger } from "./auditLogger.js";
import { auditQueryService } from "./auditQuery.js";
import { auditEventLogger } from "./auditEvents.js";
import { auditSecurityService } from "./auditSecurity.js";
import { auditComplianceService } from "./auditCompliance.js";
import { auditRetentionService } from "./auditRetention.js";
import { auditIntegrityService } from "./auditIntegrity.js";

// Re-export types for external use
export type { AuditEvent } from "./auditLogger.js";
export type { AuditQuery, AuditStats } from "./auditQuery.js";

/**
 * Unified Audit Service
 *
 * This service provides a comprehensive audit logging and compliance system
 * with the following capabilities:
 *
 * - Tamper-proof audit logging with cryptographic hashing
 * - Query and analytics functionality
 * - Predefined event logging methods
 * - Security monitoring and threat detection
 * - Compliance reporting (GDPR, SOX, HIPAA, PCI)
 * - Data retention and lifecycle management
 */
class AuditService {
  // Core logging functionality
  readonly logger = auditLogger;

  // Query and statistics
  readonly query = auditQueryService;

  // Predefined event logging
  readonly events = auditEventLogger;

  // Security monitoring
  readonly security = auditSecurityService;

  // Compliance and reporting
  readonly compliance = auditComplianceService;

  // Data retention management
  readonly retention = auditRetentionService;

  // Integrity verification
  readonly integrity = auditIntegrityService;

  // Legacy method aliases for backward compatibility
  async logEvent(
    event: Parameters<typeof auditLogger.logEvent>[0],
  ): Promise<void> {
    return auditLogger.logEvent(event);
  }

  async queryEvents(
    query: Parameters<typeof auditQueryService.queryEvents>[0],
  ): Promise<ReturnType<typeof auditQueryService.queryEvents>> {
    return auditQueryService.queryEvents(query);
  }

  async getAuditStats(
    startDate: Date,
    endDate: Date,
  ): Promise<ReturnType<typeof auditQueryService.getAuditStats>> {
    return auditQueryService.getAuditStats(startDate, endDate);
  }

  // Authentication events
  async logUserLogin(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    return auditEventLogger.logUserLogin(
      userId,
      ipAddress,
      userAgent,
      sessionId,
      success,
      errorMessage,
    );
  }

  async logUserLogout(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
  ): Promise<void> {
    return auditEventLogger.logUserLogout(
      userId,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  async logPasswordChange(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
  ): Promise<void> {
    return auditEventLogger.logPasswordChange(
      userId,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  // Resource CRUD events
  async logResourceCreate(
    userId: number,
    resource: string,
    resourceId: string | number,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
  ): Promise<void> {
    return auditEventLogger.logResourceCreate(
      userId,
      resource,
      resourceId,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  async logResourceUpdate(
    userId: number,
    resource: string,
    resourceId: string | number,
    oldValues: any,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
  ): Promise<void> {
    return auditEventLogger.logResourceUpdate(
      userId,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  async logResourceDelete(
    userId: number,
    resource: string,
    resourceId: string | number,
    oldValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
  ): Promise<void> {
    return auditEventLogger.logResourceDelete(
      userId,
      resource,
      resourceId,
      oldValues,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  // Attendance events
  async logAttendanceRecord(
    userId: number | null,
    studentId: number,
    classSessionId: number,
    action: "CREATE" | "UPDATE" | "DELETE",
    oldValues: any,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId?: string,
  ): Promise<void> {
    return auditEventLogger.logAttendanceRecord(
      userId,
      studentId,
      classSessionId,
      action,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  // IoT events
  async logRFIDScan(
    deviceId: string,
    rfidUid: string,
    success: boolean,
    studentId?: number,
    errorMessage?: string,
  ): Promise<void> {
    return auditEventLogger.logRFIDScan(
      deviceId,
      rfidUid,
      success,
      studentId,
      errorMessage,
    );
  }

  async logSensorTrigger(
    deviceId: string,
    sensorType: "entry" | "exit",
    distance: number,
    success: boolean,
  ): Promise<void> {
    return auditEventLogger.logSensorTrigger(
      deviceId,
      sensorType,
      distance,
      success,
    );
  }

  // Administrative events
  async logAdminAction(
    adminId: number,
    action: string,
    targetResource: string,
    targetId: string | number,
    details: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
  ): Promise<void> {
    return auditEventLogger.logAdminAction(
      adminId,
      action,
      targetResource,
      targetId,
      details,
      ipAddress,
      userAgent,
      sessionId,
    );
  }

  // Security events (use security service for security-specific events)
  async logSecurityEvent(
    eventType: string,
    userId: number | null,
    details: any,
    ipAddress: string,
    userAgent: string,
    sessionId?: string,
  ): Promise<void> {
    // For security events, use the security service
    return auditSecurityService.logFailedLoginAttempt(
      userId || 0,
      ipAddress,
      userAgent,
      `Security event: ${eventType}`,
    );
  }

  // Backward compatibility methods
  async logFailedLoginAttempt(
    userId: number | null,
    ipAddress: string,
    userAgent: string,
    reason: string,
  ): Promise<void> {
    return auditSecurityService.logFailedLoginAttempt(
      userId,
      ipAddress,
      userAgent,
      reason,
    );
  }

  async logSystemEvent(
    eventType: string,
    details: any,
    severity: "low" | "medium" | "high" | "critical" = "low",
  ): Promise<void> {
    return auditEventLogger.logSystemEvent(eventType, details, severity);
  }

  // Compliance methods
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    reportType: "access" | "changes" | "security" | "full",
  ): Promise<any> {
    return auditComplianceService.generateComplianceReport(
      startDate,
      endDate,
      reportType,
    );
  }

  async generateGDPRDataExport(userId: number): Promise<any> {
    return auditComplianceService.generateGDPRDataExport(userId);
  }

  async deleteUserData(userId: number): Promise<void> {
    return auditComplianceService.deleteUserData(userId);
  }

  // Data retention methods
  async cleanupOldAuditLogs(retentionDays: number = 2555): Promise<number> {
    return auditRetentionService.cleanupOldAuditLogs(retentionDays);
  }

  // Security monitoring methods
  async detectSuspiciousActivity(
    userId: number,
    events: Parameters<typeof auditSecurityService.detectSuspiciousActivity>[1],
  ): Promise<any[]> {
    return auditSecurityService.detectSuspiciousActivity(userId, events);
  }

  // Utility methods
  getRetentionPolicy(): any {
    return auditRetentionService.getRetentionPolicy();
  }

  async verifyIntegrity(
    options?: Parameters<typeof auditIntegrityService.verifyHashChain>[0],
  ) {
    return auditIntegrityService.verifyHashChain(options);
  }

  async validateComplianceRequirements(): Promise<any> {
    return auditComplianceService.validateComplianceRequirements();
  }

  async generateRegulatoryReport(
    regulator: "gdpr" | "sox" | "hipaa" | "pci",
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return auditComplianceService.generateRegulatoryReport(
      regulator,
      startDate,
      endDate,
    );
  }
}

// Export singleton instance
export const auditService = new AuditService();

// Export individual services for advanced usage
export {
  auditLogger,
  auditQueryService,
  auditEventLogger,
  auditSecurityService,
  auditComplianceService,
  auditRetentionService,
  auditIntegrityService,
};
