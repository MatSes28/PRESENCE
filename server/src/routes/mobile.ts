import { Router } from "express";
import bcrypt from "bcryptjs";
import { notificationService } from "../services/notificationService.js";
import db from "../storage.js";
import {
  users,
  students,
  attendanceRecords,
  classSessions,
  schedules,
  subjects,
  enrollments,
} from "../schema.js";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import * as QRCode from "qrcode";

const router = Router();

async function getSessionScope(sessionId: number) {
  const sessionScope = await db
    .select({
      sessionId: classSessions.id,
      status: classSessions.status,
      date: classSessions.date,
      facultyId: schedules.facultyId,
      subjectId: schedules.subjectId,
    })
    .from(classSessions)
    .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
    .where(eq(classSessions.id, sessionId))
    .limit(1);

  return sessionScope[0] ?? null;
}

async function userCanAccessSession(req: any, sessionId: number) {
  const sessionScope = await getSessionScope(sessionId);
  if (!sessionScope) {
    return { exists: false, allowed: false, sessionScope: null };
  }

  if (req.session?.userRole === "admin") {
    return { exists: true, allowed: true, sessionScope };
  }

  return {
    exists: true,
    allowed: sessionScope.facultyId === Number(req.session?.userId),
    sessionScope,
  };
}

async function isStudentEnrolledInSubject(studentId: number, subjectId: number) {
  const enrollment = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.subjectId, subjectId),
        eq(enrollments.isActive, true),
      ),
    )
    .limit(1);

  return enrollment.length > 0;
}

function requireMobileSession(req: any, res: any, next: any) {
  // Allow CORS preflight.
  if (req.method === "OPTIONS") return next();

  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  return next();
}

// Mobile-optimized authentication
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password, deviceToken, deviceType } = req.body;

    // Basic login validation (simplified)
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Session fixation protection: rotate session ID on login
    if (req.session) {
      await new Promise<void>((resolve, reject) => {
        req.session!.regenerate((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      req.session.userId = user[0].id;
      req.session.userRole = user[0].role;

      await new Promise<void>((resolve, reject) => {
        req.session!.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Register device for push notifications if token provided
    if (deviceToken) {
      try {
        await notificationService.registerPushSubscription({
          userId: user[0].id,
          endpoint: deviceToken,
          p256dh: deviceToken.substring(0, 88), // Use device token as p256dh for mobile
          auth: deviceToken.substring(0, 24), // Use device token substring as auth
          userAgent: deviceType || "mobile",
          createdAt: new Date(),
        });
      } catch (error) {
        console.log("[MOBILE] Push subscription registration skipped");
      }
    }

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user[0].id,
          name: user[0].name,
          email: user[0].email,
          role: user[0].role,
        },
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

// All mobile endpoints below require an authenticated session.
router.use(requireMobileSession);

// Register device for push notifications
router.post("/device/register", async (req, res) => {
  try {
    const { deviceToken, deviceType, platform } = req.body;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        message: "deviceToken is required",
      });
    }

    await notificationService.registerPushSubscription({
      userId: Number(req.session.userId),
      endpoint: deviceToken,
      p256dh: "mobile-p256dh", // Mobile push services use different format
      auth: "mobile-auth",
      userAgent: `${platform || "unknown"}-${deviceType || "mobile"}`,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: "Device registered successfully",
    });
  } catch (error) {
    console.error("Device registration error:", error);
    res.status(500).json({
      success: false,
      message: "Device registration failed",
    });
  }
});

// Get mobile dashboard data (optimized for mobile)
router.get("/dashboard/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow reading your own dashboard unless you're an admin.
    const requestedUserId = parseInt(userId);
    if (
      Number.isFinite(requestedUserId) &&
      requestedUserId !== Number(req.session.userId) &&
      req.session.userRole !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const effectiveUserId = Number(req.session.userId);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, effectiveUserId))
      .limit(1);

    if (!user.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let dashboardData: any = {
      user: {
        id: user[0].id,
        name: user[0].name,
        role: user[0].role,
      },
      notifications: [],
      upcomingSessions: [],
      recentActivity: [],
    };

    // Get recent notifications
    const notifications = await notificationService.getUserNotifications(
      effectiveUserId,
      10,
    );
    dashboardData.notifications = notifications.slice(0, 5);

    // Get upcoming sessions (next 24 hours)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (user[0].role === "faculty") {
      const sessions = await db
        .select({
          session: classSessions,
          schedule: schedules,
          subject: subjects,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .where(
          and(
            eq(schedules.facultyId, user[0].id),
            gte(classSessions.date, new Date()),
            lte(classSessions.date, tomorrow),
          ),
        )
        .orderBy(classSessions.date)
        .limit(5);

      dashboardData.upcomingSessions = sessions.map((s) => ({
        id: s.session.id,
        subject: s.subject.name,
        date: s.session.date,
        startTime: s.schedule.startTime,
        classroom: s.schedule.classroomId,
      }));
    }

    // Get recent activity
    const recentAttendance = await db
      .select({
        student: students,
        session: classSessions,
        subject: subjects,
        record: attendanceRecords,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(
        user[0].role === "faculty"
          ? eq(schedules.facultyId, user[0].id)
          : undefined,
      )
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(10);

    dashboardData.recentActivity = recentAttendance.map((r) => ({
      type: "attendance",
      message: `${r.student.name} marked ${r.record.status} for ${r.subject.name}`,
      timestamp: r.record.createdAt,
    }));

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Mobile dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
});

// QR Code generation for attendance
router.get("/qr/generate/:sessionId", async (req, res) => {
  try {
    const parsedSessionId = parseInt(req.params.sessionId, 10);

    if (!Number.isFinite(parsedSessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const access = await userCanAccessSession(req, parsedSessionId);
    if (!access.exists) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this session",
      });
    }

    // Generate QR code data
    const qrData = {
      sessionId: parsedSessionId,
      type: "attendance_check",
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    };

    const qrText = JSON.stringify(qrData);
    const qrCode = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });

    res.json({
      success: true,
      data: {
        qrCode,
        sessionData: qrData,
        qrText, // Mobile apps can generate QR from this too
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate QR code",
    });
  }
});

// QR Code attendance check
router.post("/qr/attendance", async (req, res) => {
  try {
    const { qrData, studentId, rfidDetected } = req.body;

    // Parse QR data
    let sessionData;
    try {
      sessionData = typeof qrData === "string" ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code data",
      });
    }

    // Validate QR code hasn't expired
    if (new Date() > new Date(sessionData.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: "QR code has expired",
      });
    }

    const parsedStudentId = parseInt(studentId, 10);
    const parsedSessionId = parseInt(sessionData.sessionId, 10);

    if (!Number.isFinite(parsedStudentId) || !Number.isFinite(parsedSessionId)) {
      return res.status(400).json({
        success: false,
        message: "Valid studentId and sessionId are required",
      });
    }

    // Check if session exists and is active
    const access = await userCanAccessSession(req, parsedSessionId);
    if (!access.exists) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this session",
      });
    }

    if (
      !(await isStudentEnrolledInSubject(
        parsedStudentId,
        access.sessionScope!.subjectId,
      ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Student is not enrolled in this class",
      });
    }

    const session = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, parsedSessionId))
      .limit(1);

    if (!session.length) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Check if student is already marked for this session
    const existingRecord = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.studentId, parsedStudentId),
          eq(attendanceRecords.classSessionId, parsedSessionId),
        ),
      )
      .limit(1);

    if (existingRecord.length > 0) {
      return res.json({
        success: true,
        message: "Attendance already recorded",
        data: {
          status: existingRecord[0].status,
          timestamp: existingRecord[0].createdAt,
        },
      });
    }

    // Determine attendance status based on timing
    const sessionStart = new Date(session[0].date);
    const now = new Date();
    const minutesLate = (now.getTime() - sessionStart.getTime()) / (1000 * 60);

    let status: "present" | "late" | "absent" = "present";
    if (minutesLate > 15) {
      status = "late";
    }

    // Record attendance
    const [newRecord] = await db
      .insert(attendanceRecords)
      .values({
        studentId: parsedStudentId,
        classSessionId: parsedSessionId,
        entryTime: now,
        status,
        rfidDetected: rfidDetected || false,
        sensorDetected: false, // Mobile check-in
        isValid: true,
      })
      .returning();

    // Send notification
    await notificationService.sendAttendanceNotification(
      parsedStudentId,
      parsedSessionId,
      status,
    );

    res.json({
      success: true,
      message: `Attendance recorded: ${status}`,
      data: {
        recordId: newRecord.id,
        status,
        timestamp: newRecord.createdAt,
      },
    });
  } catch (error) {
    console.error("QR attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record attendance",
    });
  }
});

// Offline sync endpoint
router.post("/sync", async (req, res) => {
  try {
    const { offlineData, deviceInfo } = req.body;

    // Process offline attendance records
    const results = {
      attendanceRecords: { success: 0, failed: 0 },
      notifications: { sent: 0, failed: 0 },
    };

    if (offlineData?.attendanceRecords) {
      for (const record of offlineData.attendanceRecords) {
        try {
          const parsedStudentId = parseInt(record.studentId, 10);
          const parsedSessionId = parseInt(record.sessionId, 10);

          if (
            !Number.isFinite(parsedStudentId) ||
            !Number.isFinite(parsedSessionId)
          ) {
            results.attendanceRecords.failed++;
            continue;
          }

          const access = await userCanAccessSession(req, parsedSessionId);
          if (!access.exists || !access.allowed) {
            results.attendanceRecords.failed++;
            continue;
          }

          if (
            !(await isStudentEnrolledInSubject(
              parsedStudentId,
              access.sessionScope!.subjectId,
            ))
          ) {
            results.attendanceRecords.failed++;
            continue;
          }

          const existingRecord = await db
            .select({ id: attendanceRecords.id })
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.studentId, parsedStudentId),
                eq(attendanceRecords.classSessionId, parsedSessionId),
              ),
            )
            .limit(1);

          if (existingRecord.length > 0) {
            results.attendanceRecords.success++;
            continue;
          }

          // Validate and insert offline record
          await db.insert(attendanceRecords).values({
            studentId: parsedStudentId,
            classSessionId: parsedSessionId,
            entryTime: new Date(record.timestamp),
            status: record.status,
            rfidDetected: false,
            sensorDetected: false,
            isValid: true,
            notes: `Offline sync from ${
              deviceInfo?.deviceType || "mobile device"
            }`,
          });

          results.attendanceRecords.success++;
        } catch (error) {
          console.error("Offline attendance sync error:", error);
          results.attendanceRecords.failed++;
        }
      }
    }

    res.json({
      success: true,
      message: "Offline data synced successfully",
      data: {
        results,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Offline sync error:", error);
    res.status(500).json({
      success: false,
      message: "Offline sync failed",
    });
  }
});

// Get mobile-optimized session data
router.get("/sessions/:sessionId/mobile", async (req, res) => {
  try {
    const parsedSessionId = parseInt(req.params.sessionId, 10);

    if (!Number.isFinite(parsedSessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const access = await userCanAccessSession(req, parsedSessionId);
    if (!access.exists) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this session",
      });
    }

    const sessionData = await db
      .select({
        session: classSessions,
        schedule: schedules,
        subject: subjects,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(eq(classSessions.id, parsedSessionId))
      .limit(1);

    if (!sessionData.length) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Get attendance summary
    const attendanceSummary = await db
      .select({
        status: attendanceRecords.status,
        count: count(attendanceRecords.id),
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.classSessionId, parsedSessionId))
      .groupBy(attendanceRecords.status);

    // Get enrolled students count
    const enrolledCount = await db
      .select({ count: count() })
      .from(students)
      .innerJoin(enrollments, eq(enrollments.studentId, students.id))
      .where(eq(enrollments.subjectId, sessionData[0].schedule.subjectId));

    const summary = {
      present: 0,
      late: 0,
      absent: 0,
    };

    attendanceSummary.forEach((item) => {
      summary[item.status as keyof typeof summary] = item.count;
    });

    res.json({
      success: true,
      data: {
        session: {
          id: sessionData[0].session.id,
          subject: sessionData[0].subject.name,
          date: sessionData[0].session.date,
          startTime: sessionData[0].schedule.startTime,
          endTime: sessionData[0].schedule.endTime,
          classroom: sessionData[0].schedule.classroomId,
        },
        attendance: {
          ...summary,
          totalEnrolled: enrolledCount[0]?.count || 0,
          attendanceRate: enrolledCount[0]?.count
            ? ((summary.present + summary.late) / enrolledCount[0].count) * 100
            : 0,
        },
      },
    });
  } catch (error) {
    console.error("Mobile session data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load session data",
    });
  }
});

export default router;
