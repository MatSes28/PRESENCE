import { auditEventLogger } from "./auditEvents.js";
import type { AuditEvent } from "./auditLogger.js";

export class AuditSecurityService {
  // Security event logging methods
  async logFailedLoginAttempt(
    userId: number | null,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    await auditEventLogger.logSystemEvent(
      "FAILED_LOGIN_ATTEMPT",
      {
        reason,
        ipAddress,
        userAgent,
      },
      "medium"
    );
  }

  async logBruteForceDetected(
    userId: number | null,
    ipAddress: string,
    attempts: number,
    timeWindowMinutes: number
  ): Promise<void> {
    await auditEventLogger.logSystemEvent(
      "BRUTE_FORCE_DETECTED",
      {
        attempts,
        timeWindowMinutes,
        severity: "high",
        ipAddress,
      },
      "high"
    );
  }

  async logSuspiciousAccess(
    userId: number,
    resource: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ): Promise<void> {
    await auditEventLogger.logSystemEvent(
      "SUSPICIOUS_ACCESS",
      {
        userId,
        resource,
        reason,
        severity: "medium",
        ipAddress,
        userAgent,
      },
      "medium"
    );
  }

  async logPolicyViolation(
    userId: number,
    policy: string,
    details: any,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await auditEventLogger.logSystemEvent(
      "POLICY_VIOLATION",
      {
        userId,
        policy,
        details,
        severity: "high",
        ipAddress,
        userAgent,
      },
      "high"
    );
  }

  async logDataExport(
    userId: number,
    dataType: string,
    recordCount: number,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await auditEventLogger.logSystemEvent(
      "DATA_EXPORT",
      {
        userId,
        dataType,
        recordCount,
        severity: "medium",
        ipAddress,
        userAgent,
      },
      "medium"
    );
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

    // Check for unusual access times (outside business hours)
    const unusualAccess = events.filter((e) => {
      const hour = e.timestamp.getHours();
      return hour < 6 || hour > 22; // Outside 6 AM - 10 PM
    });

    if (unusualAccess.length > 0) {
      suspiciousPatterns.push({
        type: "unusual_access_time",
        severity: "low",
        description: "Access outside normal business hours",
        events: unusualAccess,
      });
    }

    // Check for mass data access (many read operations in short time)
    const recentReads = events.filter(
      (e) =>
        e.action.includes("ACCESS") &&
        e.timestamp > new Date(Date.now() - 3600000) // Last hour
    );

    if (recentReads.length > 100) {
      suspiciousPatterns.push({
        type: "mass_data_access",
        severity: "medium",
        description: "Unusual volume of data access operations",
        events: recentReads.slice(0, 10), // Just show first 10
      });
    }

    // Check for failed operations from same IP
    const failedOps = events.filter((e) => !e.success);
    const ipGroups = failedOps.reduce((acc, e) => {
      acc[e.ipAddress] = (acc[e.ipAddress] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(ipGroups).forEach(([ip, count]) => {
      if (count >= 10) {
        suspiciousPatterns.push({
          type: "high_failure_rate",
          severity: "high",
          description: `High failure rate from IP ${ip}`,
          ipAddress: ip,
          failureCount: count,
        });
      }
    });

    return suspiciousPatterns;
  }

  // Security monitoring methods
  async monitorFailedLogins(
    ipAddress: string,
    timeWindowMinutes: number = 15
  ): Promise<{ count: number; isBlocked: boolean }> {
    // This would typically query recent failed login attempts
    // For now, return a placeholder implementation
    const count = 0; // Would be queried from database
    const isBlocked = count >= 5; // Simple threshold

    if (isBlocked) {
      await this.logBruteForceDetected(
        null,
        ipAddress,
        count,
        timeWindowMinutes
      );
    }

    return { count, isBlocked };
  }

  async checkSuspiciousPatterns(userId: number): Promise<any[]> {
    // Get recent events for this user (would be implemented with actual query)
    const recentEvents: AuditEvent[] = []; // Would be queried from database

    return await this.detectSuspiciousActivity(userId, recentEvents);
  }

  // Security compliance checks
  async generateSecurityReport(startDate: Date, endDate: Date): Promise<any> {
    // This would generate a comprehensive security report
    // For now, return a placeholder structure
    return {
      period: { startDate, endDate },
      generatedAt: new Date(),
      summary: {
        totalSecurityEvents: 0,
        failedLoginAttempts: 0,
        securityIncidents: 0,
        policyViolations: 0,
      },
      incidentsByType: {},
      suspiciousIPs: {},
      securityCompliance: {
        bruteForceProtection: true,
        anomalyDetection: true,
        incidentResponse: true,
      },
    };
  }
}

export const auditSecurityService = new AuditSecurityService();
