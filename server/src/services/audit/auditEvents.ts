import { auditLogger } from "./auditLogger.js";

export class AuditEventLogger {
  // Authentication events
  async logUserLogin(
    userId: number,
    ipAddress: string,
    userAgent: string,
    sessionId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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

  // Resource CRUD events
  async logResourceCreate(
    userId: number,
    resource: string,
    resourceId: string | number,
    newValues: any,
    ipAddress: string,
    userAgent: string,
    sessionId: string
  ): Promise<void> {
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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

  // Attendance-specific events
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
    await auditLogger.logEvent({
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

  // IoT/Device events
  async logRFIDScan(
    deviceId: string,
    rfidUid: string,
    success: boolean,
    studentId?: number,
    errorMessage?: string
  ): Promise<void> {
    await auditLogger.logEvent({
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
    await auditLogger.logEvent({
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

  // Administrative events
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
    await auditLogger.logEvent({
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

  // System events
  async logSystemEvent(
    eventType: string,
    details: any,
    severity: "low" | "medium" | "high" | "critical" = "low"
  ): Promise<void> {
    await auditLogger.logEvent({
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
}

export const auditEventLogger = new AuditEventLogger();
