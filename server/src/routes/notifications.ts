import { Router } from "express";
import { db } from "../storage.js";
import {
  emailNotifications,
  students,
  classSessions,
  schedules,
  subjects,
  users,
} from "../schema.js";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireAuth, requireAdminOrFaculty } from "../middleware/auth.js";
import { emailService } from "../services/emailService.js";

const router = Router();

// Get all notifications (with role-based filtering)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    let query = db
      .select({
        notification: emailNotifications,
        student: students,
        classSession: classSessions,
        schedule: schedules,
        subject: subjects,
        faculty: users,
      })
      .from(emailNotifications)
      .innerJoin(students, eq(emailNotifications.studentId, students.id))
      .innerJoin(
        classSessions,
        eq(emailNotifications.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(users, eq(schedules.facultyId, users.id));

    if (userRole === "faculty") {
      // Faculty can only see notifications for their subjects
      query = query.where(eq(schedules.facultyId, userId));
    }

    const notifications = await query.orderBy(desc(emailNotifications.sentAt));

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get notifications for a specific student
router.get("/student/:studentId", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    // Check if faculty has access to this student
    if (userRole === "faculty") {
      const accessCheck = await db
        .select()
        .from(emailNotifications)
        .innerJoin(
          classSessions,
          eq(emailNotifications.classSessionId, classSessions.id)
        )
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(
          and(
            eq(emailNotifications.studentId, studentId),
            eq(schedules.facultyId, userId)
          )
        )
        .limit(1);

      if (accessCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this student's notifications",
        });
      }
    }

    const notifications = await db
      .select({
        notification: emailNotifications,
        classSession: classSessions,
        schedule: schedules,
        subject: subjects,
      })
      .from(emailNotifications)
      .innerJoin(
        classSessions,
        eq(emailNotifications.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(eq(emailNotifications.studentId, studentId))
      .orderBy(desc(emailNotifications.sentAt));

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get student notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Send notification manually (faculty only)
router.post("/", requireAdminOrFaculty, async (req, res) => {
  try {
    const { studentId, classSessionId, type, message } = req.body;
    const userId = req.session?.userId;

    if (!studentId || !classSessionId || !type) {
      return res.status(400).json({
        success: false,
        message: "Student ID, class session ID, and type are required",
      });
    }

    // Check if faculty has access to this class session
    const sessionCheck = await db
      .select()
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          eq(classSessions.id, classSessionId),
          eq(schedules.facultyId, userId)
        )
      )
      .limit(1);

    if (sessionCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this class session",
      });
    }

    // Get student and parent email
    const studentData = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (studentData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const student = studentData[0];
    const recipientEmail = student.parentEmail || student.email;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "No email address available for this student",
      });
    }

    // Send email - only for absences, focused on parents
    if (type === "absent") {
      // Get subject name for the notification
      const sessionData = await db
        .select({
          subjectName: subjects.name,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .where(eq(classSessions.id, classSessionId))
        .limit(1);

      const subjectName =
        sessionData.length > 0 ? sessionData[0].subjectName : "Subject";

      const emailSent = await emailService.sendAbsenceNotification(
        recipientEmail,
        student.name,
        subjectName,
        new Date()
      );

      if (!emailSent) {
        return res.status(500).json({
          success: false,
          message: "Failed to send absence notification",
        });
      }

      // Log the notification
      const [notification] = await db
        .insert(emailNotifications)
        .values({
          studentId,
          classSessionId,
          type,
          sentAt: new Date(),
          recipientEmail,
          message: `Your child ${
            student.name
          } was marked absent from ${subjectName} on ${new Date().toLocaleDateString()}.`,
        })
        .returning();

      res.status(201).json({
        success: true,
        message: "Absence notification sent successfully",
        notification,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Only absence notifications are supported",
      });
    }
  } catch (error) {
    console.error("Send notification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Send bulk notifications (faculty only)
router.post("/bulk", requireAdminOrFaculty, async (req, res) => {
  try {
    const { studentIds, classSessionId, type, message } = req.body;
    const userId = req.session?.userId;

    if (!studentIds || !Array.isArray(studentIds) || !classSessionId || !type) {
      return res.status(400).json({
        success: false,
        message: "Student IDs array, class session ID, and type are required",
      });
    }

    // Check if faculty has access to this class session
    const sessionCheck = await db
      .select()
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          eq(classSessions.id, classSessionId),
          eq(schedules.facultyId, userId)
        )
      )
      .limit(1);

    if (sessionCheck.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this class session",
      });
    }

    const notifications = [];
    const errors = [];

    for (const studentId of studentIds) {
      try {
        // Get student data
        const studentData = await db
          .select()
          .from(students)
          .where(eq(students.id, studentId))
          .limit(1);

        if (studentData.length === 0) {
          errors.push(`Student ${studentId} not found`);
          continue;
        }

        const student = studentData[0];
        const recipientEmail = student.parentEmail || student.email;

        if (!recipientEmail) {
          errors.push(`No email address for student ${student.name}`);
          continue;
        }

        // Send email - only absences supported in bulk
        if (type === "absent") {
          // Get subject name for the notification
          const sessionData = await db
            .select({
              subjectName: subjects.name,
            })
            .from(classSessions)
            .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
            .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
            .where(eq(classSessions.id, classSessionId))
            .limit(1);

          const subjectName =
            sessionData.length > 0 ? sessionData[0].subjectName : "Subject";

          const emailSent = await emailService.sendAbsenceNotification(
            recipientEmail,
            student.name,
            subjectName,
            new Date()
          );

          if (emailSent) {
            // Log the notification
            const [notification] = await db
              .insert(emailNotifications)
              .values({
                studentId,
                classSessionId,
                type,
                sentAt: new Date(),
                recipientEmail,
                message: `Your child ${
                  student.name
                } was marked absent from ${subjectName} on ${new Date().toLocaleDateString()}.`,
              })
              .returning();

            notifications.push(notification);
          } else {
            errors.push(`Failed to send email to ${student.name}`);
          }
        } else {
          errors.push(
            `Only absence notifications are supported for student ${student.name}`
          );
        }
      } catch (error) {
        console.error(
          `Error sending notification to student ${studentId}:`,
          error
        );
        errors.push(`Error sending notification to student ${studentId}`);
      }
    }

    res.json({
      success: true,
      message: `Sent ${notifications.length} notifications successfully`,
      notifications,
      errors,
    });
  } catch (error) {
    console.error("Bulk notification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get notification statistics
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    const baseCondition =
      userRole === "faculty" ? eq(schedules.facultyId, userId) : undefined;

    // Get notification counts by type
    const typeStats = await db
      .select({
        type: emailNotifications.type,
        count: sql<number>`count(*)`,
      })
      .from(emailNotifications)
      .innerJoin(
        classSessions,
        eq(emailNotifications.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(baseCondition)
      .groupBy(emailNotifications.type);

    // Get recent notifications (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentNotifications = await db
      .select()
      .from(emailNotifications)
      .innerJoin(
        classSessions,
        eq(emailNotifications.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(and(baseCondition, gte(emailNotifications.sentAt, thirtyDaysAgo)))
      .orderBy(desc(emailNotifications.sentAt));

    res.json({
      success: true,
      stats: {
        byType: typeStats,
        recentCount: recentNotifications.length,
        totalCount: typeStats.reduce((sum, stat) => sum + stat.count, 0),
      },
    });
  } catch (error) {
    console.error("Get notification stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
