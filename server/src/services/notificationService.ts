import { db } from "../storage.js";
import {
  users,
  students,
  attendanceRecords,
  classSessions,
  schedules,
  subjects,
  enrollments,
  pushNotifications,
  pushSubscriptions,
} from "../schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";

interface PushNotification {
  id?: number;
  userId: number;
  title: string;
  message: string;
  type: "attendance" | "assignment" | "alert" | "reminder" | "achievement";
  data?: any;
  read: boolean;
  createdAt: Date;
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
  // Send push notification to user
  async sendPushNotification(
    userId: number,
    notification: Omit<PushNotification, "id" | "read" | "createdAt">
  ): Promise<boolean> {
    try {
      // Store notification in database
      const [storedNotification] = await db
        .insert(pushNotifications)
        .values({
          userId,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data,
          read: false,
          createdAt: new Date(),
        })
        .returning();

      // Get user's push subscriptions
      const subscriptions = await this.getUserPushSubscriptions(userId);

      // Send push notifications
      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendWebPush(sub, notification))
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;

      console.log(
        `[NOTIFICATION] Sent push notification to ${successCount}/${subscriptions.length} devices for user ${userId}`
      );

      return successCount > 0;
    } catch (error) {
      console.error("Push notification error:", error);
      return false;
    }
  }

  // Register push subscription for user
  async registerPushSubscription(
    subscription: PushSubscription
  ): Promise<boolean> {
    try {
      // Check if subscription already exists
      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, subscription.userId),
            eq(pushSubscriptions.endpoint, subscription.endpoint)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing subscription
        await db
          .update(pushSubscriptions)
          .set({
            p256dh: subscription.p256dh,
            auth: subscription.auth,
            userAgent: subscription.userAgent,
          })
          .where(eq(pushSubscriptions.id, existing[0].id));
      } else {
        // Create new subscription
        await db.insert(pushSubscriptions).values(subscription);
      }

      return true;
    } catch (error) {
      console.error("Push subscription registration error:", error);
      return false;
    }
  }

  // Get user's unread notifications
  async getUserNotifications(
    userId: number,
    limit: number = 50
  ): Promise<PushNotification[]> {
    try {
      return await db
        .select()
        .from(pushNotifications)
        .where(eq(pushNotifications.userId, userId))
        .orderBy(desc(pushNotifications.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Get notifications error:", error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationRead(
    notificationId: number,
    userId: number
  ): Promise<boolean> {
    try {
      await db
        .update(pushNotifications)
        .set({ read: true })
        .where(
          and(
            eq(pushNotifications.id, notificationId),
            eq(pushNotifications.userId, userId)
          )
        );

      return true;
    } catch (error) {
      console.error("Mark notification read error:", error);
      return false;
    }
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
      const enrollments = await db
        .select({ studentId: students.id, parentEmail: students.parentEmail })
        .from(students)
        .innerJoin(enrollments, eq(enrollments.studentId, students.id))
        .where(eq(enrollments.subjectId, sessionData.schedule.subjectId));

      // Send reminders to parents
      for (const enrollment of enrollments) {
        if (enrollment.parentEmail) {
          // Find user by email to get userId
          const user = await db
            .select()
            .from(users)
            .where(eq(users.email, enrollment.parentEmail))
            .limit(1);

          if (user.length > 0) {
            const reminderNotification = {
              title: `Class Reminder: ${sessionData.subject.name}`,
              message: `Your child has a ${sessionData.subject.name} class in ${minutesBefore} minutes.`,
              type: "reminder" as const,
              data: {
                sessionId,
                subject: sessionData.subject.name,
                startTime: sessionData.schedule.startTime,
                classroom: sessionData.schedule.classroomId,
              },
            };

            await this.sendPushNotification(user[0].id, reminderNotification);
          }
        }
      }
    } catch (error) {
      console.error("Session reminder error:", error);
    }
  }

  // Private helper methods
  private async getUserPushSubscriptions(
    userId: number
  ): Promise<PushSubscription[]> {
    try {
      return await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));
    } catch (error) {
      console.error("Get push subscriptions error:", error);
      return [];
    }
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

    await this.sendPushNotification(parentUser[0].id, notification);
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

    await this.sendPushNotification(facultyId, notification);
  }
}

export const notificationService = new NotificationService();
