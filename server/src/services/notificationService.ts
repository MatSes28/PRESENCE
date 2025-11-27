import { db } from "../storage.js";
import {
  users,
  students,
  attendanceRecords,
  classSessions,
  schedules,
  subjects,
  enrollments,
  // pushNotifications,
  // pushSubscriptions,
} from "../schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";

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
}

export const notificationService = new NotificationService();
