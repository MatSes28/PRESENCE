import { db } from "../storage.js";
import {
  users,
  students,
  attendanceRecords,
  classSessions,
  schedules,
  subjects,
  enrollments,
  computers,
  iotDevices,
  errorLogs,
  auditLogs,
  // pushNotifications,
  // pushSubscriptions,
} from "../schema.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { emailService } from "./emailService.js";

interface PushNotification {
  id?: number;
  userId: number;
  title: string;
  message: string;
  type: "attendance" | "assignment" | "alert" | "reminder" | "achievement";
  data?: any;
  read?: boolean;
  createdAt?: Date;
}

interface PushSubscription {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: Date;
}

class NotificationService {
  // Send push notification to user (temporarily disabled for Docker build)
  async sendPushNotification(
    userId: number,
    notification: Omit<PushNotification, "id" | "read" | "createdAt">
  ): Promise<boolean> {
    // Temporarily disabled - push notification tables not available in build
    console.log(
      `[NOTIFICATION] Push notification disabled: ${notification.title} for user ${userId}`
    );
    return false;
  }

  // Register push subscription for user (temporarily disabled)
  async registerPushSubscription(
    subscription: PushSubscription
  ): Promise<boolean> {
    console.log("[NOTIFICATION] Push subscription registration disabled");
    return false;
  }

  // Get user's unread notifications (temporarily disabled)
  async getUserNotifications(
    userId: number,
    limit: number = 50
  ): Promise<PushNotification[]> {
    console.log(`[NOTIFICATION] Get notifications disabled for user ${userId}`);
    return [];
  }

  // Mark notification as read (temporarily disabled)
  async markNotificationRead(
    notificationId: number,
    userId: number
  ): Promise<boolean> {
    console.log(
      `[NOTIFICATION] Mark notification read disabled: ${notificationId}`
    );
    return false;
  }

  // Send attendance notifications
  async sendAttendanceNotification(
    studentId: number,
    sessionId: number,
    status: "present" | "late" | "absent"
  ): Promise<void> {
    try {
      // Get student and session details
      const student = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      const session = await db
        .select({
          session: classSessions,
          schedule: schedules,
          subject: subjects,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .where(eq(classSessions.id, sessionId))
        .limit(1);

      if (!student.length || !session.length) return;

      const studentData = student[0];
      const sessionData = session[0];

      // Notify parent if email exists
      if (studentData.parentEmail) {
        await this.sendParentAttendanceNotification(
          studentData,
          sessionData,
          status
        );
      }

      // Notify faculty
      await this.sendFacultyAttendanceNotification(
        sessionData.schedule.facultyId,
        studentData,
        sessionData,
        status
      );
    } catch (error) {
      console.error("Attendance notification error:", error);
    }
  }

  // Enhanced parent notification system
  async sendParentNotification(
    studentId: number,
    notificationType:
      | "attendance"
      | "absence"
      | "late"
      | "behavior"
      | "achievement",
    message: string,
    additionalData?: any
  ): Promise<boolean> {
    try {
      const student = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      if (!student.length || !student[0].parentEmail) {
        return false;
      }

      const studentData = student[0];
      const subject = this.getParentNotificationSubject(
        notificationType,
        studentData.name
      );
      const htmlContent = this.generateParentNotificationHTML(
        notificationType,
        studentData,
        message,
        additionalData
      );

      return await emailService.sendEmail({
        to: studentData.parentEmail,
        subject,
        htmlContent,
        textContent: this.stripHtml(htmlContent),
      });
    } catch (error) {
      console.error("Parent notification error:", error);
      return false;
    }
  }

  // Bulk parent notifications
  async sendBulkParentNotifications(
    notifications: Array<{
      studentId: number;
      notificationType:
        | "attendance"
        | "absence"
        | "late"
        | "behavior"
        | "achievement";
      message: string;
      additionalData?: any;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const notification of notifications) {
      const result = await this.sendParentNotification(
        notification.studentId,
        notification.notificationType,
        notification.message,
        notification.additionalData
      );

      if (result) {
        success++;
      } else {
        failed++;
      }

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`Bulk parent notifications: ${success} sent, ${failed} failed`);
    return { success, failed };
  }

  // Automated attendance alerts
  async sendAutomatedAttendanceAlerts(): Promise<void> {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Find students with consecutive absences
      const consecutiveAbsences = await this.findConsecutiveAbsences(2);

      // Find students with declining attendance
      const decliningAttendance = await this.findDecliningAttendance(0.7); // Below 70%

      // Send alerts for consecutive absences
      for (const student of consecutiveAbsences) {
        await this.sendParentNotification(
          student.studentId,
          "absence",
          `Your child ${student.name} has been absent for ${student.consecutiveDays} consecutive days. Please contact the faculty or department.`,
          { consecutiveDays: student.consecutiveDays }
        );
      }

      // Send alerts for declining attendance
      for (const student of decliningAttendance) {
        await this.sendParentNotification(
          student.studentId,
          "attendance",
          `Your child's attendance rate has dropped to ${Math.round(
            student.attendanceRate * 100
          )}%. Please ensure regular attendance.`,
          { attendanceRate: student.attendanceRate }
        );
      }

      console.log(
        `Sent ${consecutiveAbsences.length} consecutive absence alerts and ${decliningAttendance.length} declining attendance alerts`
      );
    } catch (error) {
      console.error("Automated attendance alerts error:", error);
    }
  }

  // Real-time dashboard alerts
  async generateDashboardAlerts(): Promise<
    Array<{
      id: string;
      type: "critical" | "warning" | "info";
      title: string;
      message: string;
      timestamp: Date;
      actionRequired: boolean;
      actionUrl?: string;
    }>
  > {
    const alerts = [];

    try {
      // Check for system issues
      const systemAlerts = await this.checkSystemAlerts();
      alerts.push(...systemAlerts);

      // Check for attendance anomalies
      const attendanceAlerts = await this.checkAttendanceAlerts();
      alerts.push(...attendanceAlerts);

      // Check for equipment issues
      const equipmentAlerts = await this.checkEquipmentAlerts();
      alerts.push(...equipmentAlerts);

      // Check for security issues
      const securityAlerts = await this.checkSecurityAlerts();
      alerts.push(...securityAlerts);

      return alerts.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    } catch (error) {
      console.error("Dashboard alerts error:", error);
      return alerts;
    }
  }

  // Send bulk notifications
  async sendBulkNotifications(
    userIds: number[],
    notification: Omit<PushNotification, "id" | "read" | "createdAt">
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        const result = await this.sendPushNotification(userId, notification);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
        failed++;
      }

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return { success, failed };
  }

  // Send reminder notifications
  async sendSessionReminders(
    sessionId: number,
    minutesBefore: number = 15
  ): Promise<void> {
    try {
      const session = await db
        .select({
          session: classSessions,
          schedule: schedules,
          subject: subjects,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .where(eq(classSessions.id, sessionId))
        .limit(1);

      if (!session.length) return;

      const sessionData = session[0];

      // Get enrolled students
      const { enrollments: enrollmentsTable } = await import("../schema.js");
      const enrolledStudents = await db
        .select({ studentId: students.id, parentEmail: students.parentEmail })
        .from(students)
        .innerJoin(
          enrollmentsTable,
          eq(enrollmentsTable.studentId, students.id)
        )
        .where(eq(enrollmentsTable.subjectId, sessionData.schedule.subjectId));

      // Send reminders to parents (push notifications temporarily disabled)
      console.log(
        `[NOTIFICATION] Session reminders disabled - ${enrolledStudents.length} students would be notified`
      );
    } catch (error) {
      console.error("Session reminder error:", error);
    }
  }

  // Private helper methods
  private async getUserPushSubscriptions(
    userId: number
  ): Promise<PushSubscription[]> {
    // Temporarily disabled
    console.log(
      `[NOTIFICATION] Get push subscriptions disabled for user ${userId}`
    );
    return [];
  }

  private async sendWebPush(
    subscription: PushSubscription,
    notification: any
  ): Promise<boolean> {
    // This would integrate with a web push service like Firebase Cloud Messaging
    // For now, we'll simulate the push notification
    try {
      console.log(`[WEB PUSH] Would send to ${subscription.endpoint}:`, {
        title: notification.title,
        body: notification.message,
        icon: "/icon-192x192.png",
        badge: "/badge-72x72.png",
        data: notification.data,
      });

      // In a real implementation, you would:
      // 1. Use web-push library
      // 2. Send encrypted payload to the endpoint
      // 3. Handle subscription updates/renewals

      return true;
    } catch (error) {
      console.error("Web push send error:", error);
      return false;
    }
  }

  private async sendParentAttendanceNotification(
    student: any,
    session: any,
    status: string
  ): Promise<void> {
    // Find parent user account
    const parentUser = await db
      .select()
      .from(users)
      .where(eq(users.email, student.parentEmail))
      .limit(1);

    if (parentUser.length === 0) return;

    const statusMessages = {
      present: "was marked present",
      late: "was marked late",
      absent: "was marked absent",
    };

    const notification = {
      title: `Attendance Update: ${student.name}`,
      message: `Your child ${student.name} ${
        statusMessages[status as keyof typeof statusMessages]
      } for ${session.subject.name} class.`,
      type: "attendance" as const,
      data: {
        studentId: student.id,
        sessionId: session.session.id,
        status,
        subject: session.subject.name,
        timestamp: new Date().toISOString(),
      },
    };

    // Push notification temporarily disabled
    console.log(
      `[NOTIFICATION] Parent attendance notification disabled for ${parentUser[0].id}`
    );
  }

  private async sendFacultyAttendanceNotification(
    facultyId: number,
    student: any,
    session: any,
    status: string
  ): Promise<void> {
    const notification = {
      title: `Student Attendance: ${student.name}`,
      message: `${student.name} ${status} for ${session.subject.name} class.`,
      type: "attendance" as const,
      data: {
        studentId: student.id,
        sessionId: session.session.id,
        status,
        subject: session.subject.name,
        classroom: session.schedule.classroomId,
      },
    };

    // Push notification temporarily disabled
    console.log(
      `[NOTIFICATION] Faculty attendance notification disabled for ${facultyId}`
    );
  }

  // Helper methods for parent notifications
  private getParentNotificationSubject(
    type: string,
    studentName: string
  ): string {
    const subjects = {
      attendance: `Attendance Update - ${studentName}`,
      absence: `Student Absence Alert - ${studentName}`,
      late: `Late Arrival Notice - ${studentName}`,
      behavior: `Behavioral Notice - ${studentName}`,
      achievement: `Achievement Recognition - ${studentName}`,
    };
    return (
      subjects[type as keyof typeof subjects] ||
      `Student Notification - ${studentName}`
    );
  }

  private generateParentNotificationHTML(
    type: string,
    student: any,
    message: string,
    additionalData?: any
  ): string {
    const typeConfig = {
      attendance: { color: "#10B981", icon: "📊" },
      absence: { color: "#EF4444", icon: "❌" },
      late: { color: "#F59E0B", icon: "⏰" },
      behavior: { color: "#8B5CF6", icon: "⚠️" },
      achievement: { color: "#06B6D4", icon: "🏆" },
    };

    const config =
      typeConfig[type as keyof typeof typeConfig] || typeConfig.attendance;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>CLIRDEC:PRESENCE - Student Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; text-align: center;">CLIRDEC:PRESENCE</h1>
              <p style="color: white; margin: 10px 0 0 0; text-align: center; opacity: 0.9;">Student Notification System</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 48px;">${config.icon}</span>
              </div>

              <h2 style="color: #333; margin-top: 0; text-align: center;">${this.getParentNotificationSubject(
                type,
                student.name
              )}</h2>

              <div style="background: ${config.color}20; border: 2px solid ${
      config.color
    }; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: ${
                  config.color
                }; font-weight: bold; font-size: 16px;">${message}</p>
              </div>

              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>Student Details:</strong><br>
                Name: ${student.name}<br>
                ID: ${student.studentId}<br>
                ${
                  additionalData
                    ? Object.entries(additionalData)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("<br>")
                    : ""
                }
              </div>

              <p style="color: #666; font-size: 14px;">
                This is an automated notification from the CLIRDEC:PRESENCE attendance monitoring system.
                If you have any questions, please contact your faculty member or the department.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              <p>Central Luzon State University - Information Technology Department</p>
              <p>CLIRDEC:PRESENCE - Proximity and RFID-Enabled Smart Entry for Classroom Engagement</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Attendance monitoring methods
  private async findConsecutiveAbsences(minDays: number): Promise<
    Array<{
      studentId: number;
      name: string;
      consecutiveDays: number;
    }>
  > {
    // Query for students with consecutive absences
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get attendance records grouped by student
    const attendanceHistory = await db
      .select({
        studentId: students.id,
        name: students.name,
        lastAbsent: sql<Date>`MAX(${classSessions.date})`,
        absentCount: sql<number>`COUNT(CASE WHEN ${attendanceRecords.status} = 'absent' THEN 1 END)`,
      })
      .from(students)
      .leftJoin(attendanceRecords, eq(attendanceRecords.studentId, students.id))
      .leftJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(gte(classSessions.date, thirtyDaysAgo))
      .groupBy(students.id, students.name)
      .having(
        sql<number>`COUNT(CASE WHEN ${attendanceRecords.status} = 'absent' THEN 1 END) >= ${minDays}`
      );

    return attendanceHistory.map((record) => ({
      studentId: record.studentId,
      name: record.name,
      consecutiveDays: Number(record.absentCount) || minDays,
    }));
  }

  private async findDecliningAttendance(threshold: number): Promise<
    Array<{
      studentId: number;
      name: string;
      attendanceRate: number;
    }>
  > {
    // Calculate attendance rates for recent period
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceRates = await db
      .select({
        studentId: students.id,
        name: students.name,
        totalSessions: sql<number>`COUNT(DISTINCT ${classSessions.id})`,
        attendedSessions: sql<number>`COUNT(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1 END)`,
      })
      .from(students)
      .leftJoin(attendanceRecords, eq(attendanceRecords.studentId, students.id))
      .leftJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(gte(classSessions.date, thirtyDaysAgo))
      .groupBy(students.id, students.name)
      .having(sql<number>`COUNT(DISTINCT ${classSessions.id}) >= 5`);

    return attendanceRates
      .map((rate) => ({
        studentId: rate.studentId,
        name: rate.name,
        attendanceRate:
          rate.totalSessions > 0
            ? rate.attendedSessions / rate.totalSessions
            : 0,
      }))
      .filter((rate) => rate.attendanceRate < threshold);
  }

  // Dashboard alert methods
  private async checkSystemAlerts(): Promise<
    Array<{
      id: string;
      type: "critical" | "warning" | "info";
      title: string;
      message: string;
      timestamp: Date;
      actionRequired: boolean;
      actionUrl?: string;
    }>
  > {
    const alerts = [];

    // Check database connectivity
    try {
      await db.select().from(users).limit(1);
    } catch (error) {
      alerts.push({
        id: `system-db-${Date.now()}`,
        type: "critical",
        title: "Database Connection Failed",
        message:
          "Unable to connect to the database. System functionality may be impaired.",
        timestamp: new Date(),
        actionRequired: true,
        actionUrl: "/settings",
      });
    }

    // Check for high error rates from error logs
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentErrors = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(errorLogs)
      .where(gte(errorLogs.timestamp, oneHourAgo));

    const errorCount = recentErrors[0]?.count || 0;
    const errorRate = Math.min(errorCount / 100, 1); // Normalize: 100 errors = 100%

    if (errorRate > 0.1) {
      alerts.push({
        id: `system-errors-${Date.now()}`,
        type: "warning",
        title: "High Error Rate Detected",
        message: `${errorCount} errors detected in the last hour. Please check system logs.`,
        timestamp: new Date(),
        actionRequired: false,
      });
    }

    return alerts;
  }

  private async checkAttendanceAlerts(): Promise<
    Array<{
      id: string;
      type: "critical" | "warning" | "info";
      title: string;
      message: string;
      timestamp: Date;
      actionRequired: boolean;
      actionUrl?: string;
    }>
  > {
    const alerts = [];

    // Check for classes with no attendance records today
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const sessionsWithoutAttendance = await db
      .select({
        sessionId: classSessions.id,
        subjectName: subjects.name,
        startTime: schedules.startTime,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          sql`${attendanceRecords.id} IS NULL`
        )
      );

    if (sessionsWithoutAttendance.length > 0) {
      alerts.push({
        id: `attendance-missing-${Date.now()}`,
        type: "warning",
        title: "Missing Attendance Records",
        message: `${sessionsWithoutAttendance.length} class sessions today have no attendance records.`,
        timestamp: new Date(),
        actionRequired: true,
        actionUrl: "/live-attendance",
      });
    }

    // Check for unusually low attendance
    const todayAttendance = await db
      .select({
        totalEnrolled: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`,
        totalPresent: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'present' THEN ${attendanceRecords.studentId} END)`,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .leftJoin(enrollments, eq(enrollments.subjectId, schedules.subjectId))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(gte(classSessions.date, startOfDay));

    if (todayAttendance.length > 0) {
      const attendanceRate =
        todayAttendance[0].totalEnrolled > 0
          ? todayAttendance[0].totalPresent / todayAttendance[0].totalEnrolled
          : 0;

      if (attendanceRate < 0.5) {
        alerts.push({
          id: `attendance-low-${Date.now()}`,
          type: "critical",
          title: "Critically Low Attendance",
          message: `Today's attendance rate is only ${Math.round(
            attendanceRate * 100
          )}%. This requires immediate attention.`,
          timestamp: new Date(),
          actionRequired: true,
          actionUrl: "/dashboard",
        });
      }
    }

    return alerts;
  }

  private async checkEquipmentAlerts(): Promise<
    Array<{
      id: string;
      type: "critical" | "warning" | "info";
      title: string;
      message: string;
      timestamp: Date;
      actionRequired: boolean;
      actionUrl?: string;
    }>
  > {
    const alerts = [];

    // Check for offline IoT devices
    const offlineDevices = await db
      .select()
      .from(iotDevices)
      .where(
        and(
          eq(iotDevices.status, "offline"),
          sql`${iotDevices.lastSeen} < NOW() - INTERVAL '1 hour'`
        )
      );

    if (offlineDevices.length > 0) {
      alerts.push({
        id: `equipment-offline-${Date.now()}`,
        type: "warning",
        title: "IoT Devices Offline",
        message: `${offlineDevices.length} IoT devices have been offline for more than an hour.`,
        timestamp: new Date(),
        actionRequired: true,
        actionUrl: "/iot-devices",
      });
    }

    // Check for computers needing maintenance
    const computersNeedingMaintenance = await db
      .select()
      .from(computers)
      .where(
        and(
          sql`${computers.nextMaintenance} < NOW() + INTERVAL '7 days'`,
          sql`${computers.status} != 'maintenance'`
        )
      );

    if (computersNeedingMaintenance.length > 0) {
      alerts.push({
        id: `maintenance-due-${Date.now()}`,
        type: "info",
        title: "Maintenance Due",
        message: `${computersNeedingMaintenance.length} computers require maintenance within the next week.`,
        timestamp: new Date(),
        actionRequired: false,
        actionUrl: "/lab-computers",
      });
    }

    return alerts;
  }

  private async checkSecurityAlerts(): Promise<
    Array<{
      id: string;
      type: "critical" | "warning" | "info";
      title: string;
      message: string;
      timestamp: Date;
      actionRequired: boolean;
      actionUrl?: string;
    }>
  > {
    const alerts = [];

    // Get failed login attempts from audit logs
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const failedLogins = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.timestamp, oneHourAgo),
          eq(auditLogs.action, "login_failed")
        )
      );

    const failedLoginCount = failedLogins[0]?.count || 0;
    if (failedLoginCount > 5) {
      alerts.push({
        id: `security-logins-${Date.now()}`,
        type: "warning",
        title: "Multiple Failed Login Attempts",
        message: `${failedLoginCount} failed login attempts detected in the last hour.`,
        timestamp: new Date(),
        actionRequired: true,
        actionUrl: "/settings",
      });
    }

    // Check for high-risk activities (using action type and error messages)
    const highRiskActivities = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        errorMessage: auditLogs.errorMessage,
        userId: auditLogs.userId,
        timestamp: auditLogs.timestamp,
        success: auditLogs.success,
      })
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.timestamp, oneHourAgo),
          sql`${auditLogs.action} IN ('security_violation', 'unauthorized_access', 'data_breach', 'admin_action') OR ${auditLogs.success} = false`
        )
      )
      .orderBy(desc(auditLogs.timestamp))
      .limit(5);

    if (highRiskActivities.length > 0) {
      alerts.push({
        id: `security-access-${Date.now()}`,
        type: "critical",
        title: "High-Risk Activity Detected",
        message: `${highRiskActivities.length} high-risk activities detected. Please review security logs.`,
        timestamp: new Date(),
        actionRequired: true,
        actionUrl: "/settings",
      });
    }

    return alerts;
  }
}

export const notificationService = new NotificationService();
