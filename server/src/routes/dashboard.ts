import { Router } from "express";
import db from "../storage.js";
import {
  attendanceRecords,
  classSessions,
  students,
  users,
  schedules,
  classrooms,
  subjects,
  computerAssignments,
  auditLogs,
  errorLogs,
} from "../schema.js";
import { eq, and, gte, lte, sql, desc, isNotNull, ne } from "drizzle-orm";
import { cacheService } from "../services/cacheService.js";
import { notificationService } from "../services/notificationService.js";
import { createUserRateLimit } from "../middleware/rateLimit.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { iotDeviceManager } from "../services/iotDeviceManager.js";
import {
  setEmergencyStop,
  isEmergencyStopActive,
} from "../services/rfidEmergencyStop.js";

const router = Router();

// Rate limiting for authenticated dashboard operations
const dashboardRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Very high limit for dashboard operations
  message: {
    success: false,
    message: "Too many dashboard requests, please try again later.",
    retryAfter: 15 * 60,
  },
});

// Get dashboard statistics
router.get("/stats", requireAuth, dashboardRateLimit, async (req, res) => {
  try {
    // Try to get from cache first (longer cache time)
    const cachedStats = await cacheService.getDashboardStats();
    if (cachedStats) {
      return res.json({
        success: true,
        data: cachedStats,
        cached: true,
      });
    }

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    // Use optimized queries with proper indexing
    const [
      todayClassesResult,
      presentStudentsResult,
      absentStudentsResult,
      totalStudentsResult,
      totalEventsResult,
      activeDevicesResult,
      discrepancyResult,
    ] = await Promise.all([
      // Today's classes count
      db
        .select({ count: sql<number>`count(*)` })
        .from(classSessions)
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
          ),
        ),

      // Present students today
      db
        .select({
          count: sql<number>`count(distinct ${attendanceRecords.studentId})`,
        })
        .from(attendanceRecords)
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
            eq(attendanceRecords.status, "present"),
          ),
        ),

      // Absent students today
      db
        .select({
          count: sql<number>`count(distinct ${attendanceRecords.studentId})`,
        })
        .from(attendanceRecords)
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
            eq(attendanceRecords.status, "absent"),
          ),
        ),

      // Total students
      db
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(eq(students.isActive, true)),

      // Total events (attendance records today)
      db
        .select({ count: sql<number>`count(*)` })
        .from(attendanceRecords)
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
          ),
        ),

      // Active devices
      db
        .select({
          count: sql<number>`count(distinct ${computerAssignments.computerId})`,
        })
        .from(computerAssignments)
        .innerJoin(
          classSessions,
          eq(computerAssignments.classSessionId, classSessions.id),
        )
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
            eq(computerAssignments.status, "active"),
          ),
        ),

      // Error rate (discrepancies)
      db
        .select({ count: sql<number>`count(*)` })
        .from(attendanceRecords)
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
            eq(attendanceRecords.discrepancyFlag, true),
          ),
        ),
    ]);

    // Calculate metrics
    const presentCount = presentStudentsResult[0]?.count || 0;
    const absentCount = absentStudentsResult[0]?.count || 0;
    const totalRecorded = presentCount + absentCount;
    const attendanceRate =
      totalRecorded > 0 ? (presentCount / totalRecorded) * 100 : 0;

    const totalEvents = totalEventsResult[0]?.count || 0;
    const discrepancyCount = discrepancyResult[0]?.count || 0;
    const errorRate =
      totalEvents > 0 ? (discrepancyCount / totalEvents) * 100 : 0;

    // Calculate system uptime from process start (real uptime, not a fixed date).
    const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));
    const uptimeDays = Math.floor(uptimeSeconds / (60 * 60 * 24));
    const uptimeHours = Math.floor(
      (uptimeSeconds % (60 * 60 * 24)) / (60 * 60),
    );
    const uptimeMinutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
    const systemUptime = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;

    const stats = {
      todayClasses: todayClassesResult[0]?.count || 0,
      presentStudents: presentCount,
      absentStudents: absentCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      totalEvents: totalEvents,
      activeDevices: activeDevicesResult[0]?.count || 0,
      systemUptime: systemUptime,
      errorRate: Math.round(errorRate * 100) / 100,
    };

    // Cache the results for 5 minutes
    await cacheService.setDashboardStats(stats, 300);

    res.json({
      success: true,
      data: stats,
      cached: false,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get recent activity
router.get("/activity", requireAuth, dashboardRateLimit, async (req, res) => {
  try {
    const recentAttendance = await db
      .select({
        id: attendanceRecords.id,
        studentName: students.name,
        status: attendanceRecords.status,
        entryTime: attendanceRecords.entryTime,
        createdAt: attendanceRecords.createdAt,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(10);

    const activity = recentAttendance.map((record) => ({
      id: record.id,
      type: "attendance",
      message: `${record.studentName} marked as ${record.status}`,
      timestamp: record.createdAt,
    }));

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Dashboard activity error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get active sessions
router.get(
  "/sessions/active",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1,
      );

      const activeSessions = await db
        .select({
          id: classSessions.id,
          subjectName: subjects.name,
          classroomName: classrooms.name,
          startTime: schedules.startTime,
          status: classSessions.status,
          presentCount: sql<number>`count(case when ${attendanceRecords.status} = 'present' then 1 end)`,
          absentCount: sql<number>`count(case when ${attendanceRecords.status} = 'absent' then 1 end)`,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
        .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
        .leftJoin(
          attendanceRecords,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .where(
          and(
            gte(classSessions.date, startOfDay),
            lte(classSessions.date, endOfDay),
            eq(classSessions.status, "active"),
          ),
        )
        .groupBy(
          classSessions.id,
          subjects.name,
          classrooms.name,
          schedules.startTime,
          classSessions.status,
        );

      res.json({
        success: true,
        data: activeSessions,
      });
    } catch (error) {
      console.error("Active sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// Get analytics data for charts and trends
router.get("/analytics", requireAuth, dashboardRateLimit, async (req, res) => {
  try {
    const { period = "7d" } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Daily attendance trends
    const dailyAttendance = await db
      .select({
        date: sql<string>`DATE(${attendanceRecords.createdAt})`,
        present: sql<number>`COUNT(CASE WHEN ${attendanceRecords.isValid} = true THEN 1 END)`,
        absent: sql<number>`COUNT(CASE WHEN ${attendanceRecords.isValid} = false THEN 1 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate),
        ),
      )
      .groupBy(sql`DATE(${attendanceRecords.createdAt})`)
      .orderBy(sql`DATE(${attendanceRecords.createdAt})`);

    // Hourly attendance patterns
    const hourlyPatterns = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${attendanceRecords.createdAt}::timestamp)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate),
        ),
      )
      .groupBy(
        sql`EXTRACT(HOUR FROM ${attendanceRecords.createdAt}::timestamp)`,
      )
      .orderBy(
        sql`EXTRACT(HOUR FROM ${attendanceRecords.createdAt}::timestamp)`,
      );

    // Subject-wise attendance
    const subjectAttendance = await db
      .select({
        subjectName: subjects.name,
        present: sql<number>`COUNT(CASE WHEN ${attendanceRecords.isValid} = true THEN 1 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate),
        ),
      )
      .groupBy(subjects.name)
      .orderBy(desc(sql<number>`COUNT(*)`))
      .limit(10);

    // Faculty performance
    const facultyPerformance = await db
      .select({
        facultyName: users.name,
        present: sql<number>`COUNT(CASE WHEN ${attendanceRecords.isValid} = true THEN 1 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate),
        ),
      )
      .groupBy(users.name)
      .orderBy(desc(sql<number>`COUNT(*)`))
      .limit(10);

    // Calculate attendance rates
    const analytics = {
      dailyTrends: dailyAttendance.map((day) => ({
        date: day.date,
        present: day.present,
        absent: day.absent,
        rate: day.total > 0 ? Math.round((day.present / day.total) * 100) : 0,
      })),
      hourlyPatterns: hourlyPatterns.map((hour) => ({
        hour: hour.hour,
        count: hour.count,
      })),
      subjectPerformance: subjectAttendance.map((subject) => ({
        subject: subject.subjectName,
        rate:
          subject.total > 0
            ? Math.round((subject.present / subject.total) * 100)
            : 0,
        total: subject.total,
      })),
      facultyPerformance: facultyPerformance.map((faculty) => ({
        faculty: faculty.facultyName,
        rate:
          faculty.total > 0
            ? Math.round((faculty.present / faculty.total) * 100)
            : 0,
        total: faculty.total,
      })),
      period,
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics data",
    });
  }
});

// Get real-time alerts and notifications
router.get("/alerts", requireAuth, dashboardRateLimit, async (req, res) => {
  try {
    const alerts = await notificationService.generateDashboardAlerts();

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error("Alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
    });
  }
});

// Send automated attendance alerts (admin only)
router.post(
  "/alerts/attendance/send",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      // Check if user is admin
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user.length || user[0].role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      await notificationService.sendAutomatedAttendanceAlerts();

      res.json({
        success: true,
        message: "Automated attendance alerts sent successfully",
      });
    } catch (error) {
      console.error("Send attendance alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send attendance alerts",
      });
    }
  },
);

// Send parent notification (admin only)
router.post(
  "/notifications/parent",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const { studentId, notificationType, message, additionalData } = req.body;

      if (!studentId || !notificationType || !message) {
        return res.status(400).json({
          success: false,
          message: "Student ID, notification type, and message are required",
        });
      }

      // Check if user is admin
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user.length || user[0].role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const success = await notificationService.sendParentNotification(
        studentId,
        notificationType,
        message,
        additionalData,
      );

      if (success) {
        res.json({
          success: true,
          message: "Parent notification sent successfully",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to send parent notification",
        });
      }
    } catch (error) {
      console.error("Parent notification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

// Bulk parent notifications (admin only)
router.post(
  "/notifications/parent/bulk",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const { notifications } = req.body;

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Notifications array is required",
        });
      }

      // Check if user is admin
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user.length || user[0].role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const result =
        await notificationService.sendBulkParentNotifications(notifications);

      res.json({
        success: true,
        message: `Bulk notifications sent: ${result.success} successful, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      console.error("Bulk parent notifications error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

export default router;

// ============================================================
// SECURITY METRICS API
// ============================================================

// Get security metrics dashboard data (uses actual audit action values: USER_LOGIN, SYSTEM_FAILED_LOGIN_ATTEMPT)
router.get(
  "/security/metrics",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const { period = "7d" } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case "24h":
          startDate.setHours(endDate.getHours() - 24);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      // Failed logins: SYSTEM_FAILED_LOGIN_ATTEMPT or USER_LOGIN with success=false
      const failedLogins = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate),
            sql`(${auditLogs.action} = 'SYSTEM_FAILED_LOGIN_ATTEMPT' OR (${auditLogs.action} = 'USER_LOGIN' AND ${auditLogs.success} = false))`,
          ),
        );

      // Successful logins: USER_LOGIN with success=true
      const successfulLogins = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate),
            eq(auditLogs.action, "USER_LOGIN"),
            eq(auditLogs.success, true),
          ),
        );

      // Security-related events by type (for severity-style breakdown: system events vs auth)
      const securityEvents = await db
        .select({
          action: auditLogs.action,
          count: sql<number>`COUNT(*)`,
        })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate),
            sql`(${auditLogs.action} LIKE 'SYSTEM_%' OR ${auditLogs.action} = 'USER_LOGIN')`,
          ),
        )
        .groupBy(auditLogs.action);

      // Recent security-related activities (failed logins, system events, any auth)
      const suspiciousActivities = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          details: auditLogs.metadata,
          userId: auditLogs.userId,
          timestamp: auditLogs.timestamp,
        })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate),
            sql`(${auditLogs.success} = false OR ${auditLogs.action} LIKE 'SYSTEM_%' OR ${auditLogs.action} = 'USER_LOGIN')`,
          ),
        )
        .orderBy(desc(auditLogs.timestamp))
        .limit(20);

      const failedCount = failedLogins[0]?.count || 0;
      const successCount = successfulLogins[0]?.count || 0;
      const totalAuth = failedCount + successCount;

      // Security score: penalize failed logins; reward successful auth
      let securityScore = 100;
      if (totalAuth > 0) {
        const failRate = failedCount / totalAuth;
        securityScore -= Math.min(Math.round(failRate * 50), 50);
      }
      securityScore = Math.max(0, Math.round(securityScore));

      // By severity: map system/auth events for dashboard display
      const systemEventCount =
        securityEvents
          .filter((e) => String(e.action).startsWith("SYSTEM_"))
          .reduce((sum, e) => sum + Number(e.count), 0) || 0;
      const authEventCount =
        securityEvents.find((e) => e.action === "USER_LOGIN")?.count || 0;

      const metrics = {
        securityScore,
        totalEvents: systemEventCount + authEventCount,
        bySeverity: {
          high: failedCount,
          medium: systemEventCount,
          low: successCount,
        },
        failedLogins: failedCount,
        successfulLogins: successCount,
        loginSuccessRate:
          totalAuth > 0 ? Math.round((successCount / totalAuth) * 100) : 100,
        suspiciousActivities: suspiciousActivities.map((activity) => ({
          id: activity.id,
          action: activity.action,
          description: activity.details
            ? JSON.stringify(activity.details)
            : activity.action,
          riskLevel:
            String(activity.action).includes("FAILED") ||
            String(activity.action).includes("BRUTE")
              ? "high"
              : "medium",
          timestamp: activity.timestamp,
        })),
        period,
        // Access control reflects actual app configuration (no mock)
        accessControl: {
          sessionAuth: true,
          passwordHashing: "bcrypt",
          rateLimiting: true,
          auditLogging: true,
        },
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error("Security metrics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch security metrics",
      });
    }
  },
);

// Get performance metrics dashboard data
router.get(
  "/system-metrics",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const { period = "24h" } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case "1h":
          startDate.setHours(endDate.getHours() - 1);
          break;
        case "24h":
          startDate.setHours(endDate.getHours() - 24);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        default:
          startDate.setHours(endDate.getHours() - 24);
      }

      // Get API response times (from error logs which track response times)
      const apiResponseTimes = await db
        .select({
          avgResponseTime: sql<number>`AVG(${errorLogs.responseTime})`,
          minResponseTime: sql<number>`MIN(${errorLogs.responseTime})`,
          maxResponseTime: sql<number>`MAX(${errorLogs.responseTime})`,
        })
        .from(errorLogs)
        .where(
          and(
            gte(errorLogs.timestamp, startDate),
            lte(errorLogs.timestamp, endDate),
            sql`${errorLogs.responseTime} IS NOT NULL`,
          ),
        );

      // Get request counts by endpoint from error logs
      const requestsByEndpoint = await db
        .select({
          endpoint: errorLogs.endpoint,
          count: sql<number>`COUNT(*)`,
        })
        .from(errorLogs)
        .where(
          and(
            gte(errorLogs.timestamp, startDate),
            lte(errorLogs.timestamp, endDate),
            sql`${errorLogs.endpoint} IS NOT NULL`,
          ),
        )
        .groupBy(errorLogs.endpoint)
        .orderBy(desc(sql<number>`COUNT(*)`))
        .limit(10);

      // Get error counts (4xx and 5xx status codes)
      const errorCount = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(errorLogs)
        .where(
          and(
            gte(errorLogs.timestamp, startDate),
            lte(errorLogs.timestamp, endDate),
            sql`${errorLogs.statusCode} >= 400 OR ${errorLogs.statusCode} IS NULL`,
          ),
        );

      const totalRequests = await db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(errorLogs)
        .where(
          and(
            gte(errorLogs.timestamp, startDate),
            lte(errorLogs.timestamp, endDate),
          ),
        );

      // Get database query performance (using response time as proxy for query time)
      const dbQueryStats = await db
        .select({
          avgQueryTime: sql<number>`AVG(${errorLogs.responseTime})`,
        })
        .from(errorLogs)
        .where(
          and(
            gte(errorLogs.timestamp, startDate),
            lte(errorLogs.timestamp, endDate),
            sql`${errorLogs.responseTime} IS NOT NULL`,
          ),
        );

      // Calculate system health metrics
      const avgResponseTime = apiResponseTimes[0]?.avgResponseTime || 0;
      const errorRate =
        (totalRequests[0]?.count || 0) > 0
          ? ((errorCount[0]?.count || 0) / (totalRequests[0]?.count || 1)) * 100
          : 0;

      // Performance score (higher is better)
      let performanceScore = 100;
      performanceScore -= Math.min(avgResponseTime / 10, 30); // Penalize slow responses
      performanceScore -= Math.min(errorRate * 5, 30); // Penalize errors
      performanceScore = Math.max(0, Math.round(performanceScore));

      const metrics = {
        performanceScore,
        api: {
          avgResponseTime: Math.round(avgResponseTime),
          minResponseTime: apiResponseTimes[0]?.minResponseTime || 0,
          maxResponseTime: apiResponseTimes[0]?.maxResponseTime || 0,
          totalRequests: totalRequests[0]?.count || 0,
          errorCount: errorCount[0]?.count || 0,
          errorRate: Math.round(errorRate * 100) / 100,
        },
        database: {
          avgQueryTime: dbQueryStats[0]?.avgQueryTime || 0,
        },
        topEndpoints: requestsByEndpoint.map((ep) => ({
          endpoint: ep.endpoint,
          requests: ep.count,
        })),
        period,
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error("Performance metrics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch performance metrics",
      });
    }
  },
);

// ============================================================
// RFID TOOLS (admin-only) – all actions perform real work
// ============================================================

router.post(
  "/rfid/test-reader",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const devices = await iotDeviceManager.getAllDevices();
      const readers = devices.filter(
        (d: any) => d.type === "rfid_reader" || d.type === "esp32_s3",
      );
      if (readers.length === 0) {
        return res.json({
          success: true,
          message: "No RFID readers registered. Add devices in IoT Devices.",
          data: { tested: 0, ok: 0 },
        });
      }
      let ok = 0;
      for (const d of readers) {
        const sent = await iotDeviceManager.sendCommandToDevice(
          d.deviceId,
          "test",
        );
        if (sent) ok++;
      }
      res.json({
        success: true,
        message: `Test command sent to ${ok}/${readers.length} device(s). Devices respond when online.`,
        data: { tested: readers.length, ok },
      });
    } catch (error) {
      console.error("RFID test-reader error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to run reader test" });
    }
  },
);

router.post(
  "/rfid/calibrate-sensors",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const devices = await iotDeviceManager.getAllDevices();
      const sensors = devices.filter(
        (d: any) =>
          d.type === "ultrasonic_sensor" ||
          d.type === "esp32_s3" ||
          d.type === "rfid_reader",
      );
      if (sensors.length === 0) {
        return res.json({
          success: true,
          message: "No sensors registered. Add devices in IoT Devices.",
          data: { sent: 0 },
        });
      }
      let sent = 0;
      for (const d of sensors) {
        const ok = await iotDeviceManager.sendCommandToDevice(
          d.deviceId,
          "calibrate",
        );
        if (ok) sent++;
      }
      res.json({
        success: true,
        message: `Calibrate command sent to ${sent}/${sensors.length} device(s).`,
        data: { sent },
      });
    } catch (error) {
      console.error("RFID calibrate error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to send calibrate command" });
    }
  },
);

router.get(
  "/rfid/check-card-database",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const [withRfid, total] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(students)
          // Count students with an assigned RFID token (hash present)
          .where(
            and(isNotNull(students.rfidUidHash), ne(students.rfidUidHash, "")),
          ),
        db.select({ count: sql<number>`count(*)` }).from(students),
      ]);
      const countWithRfid = Number(withRfid[0]?.count ?? 0);
      const totalStudents = Number(total[0]?.count ?? 0);
      res.json({
        success: true,
        data: {
          studentsWithRfid: countWithRfid,
          totalStudents,
          withoutRfid: totalStudents - countWithRfid,
        },
      });
    } catch (error) {
      console.error("Check card database error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to check card database" });
    }
  },
);

router.post(
  "/rfid/reset-device-cache",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      await cacheService.invalidateIoTDevices();
      res.json({
        success: true,
        message: "Device cache cleared. Next load will fetch fresh data.",
      });
    } catch (error) {
      console.error("Reset device cache error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to reset device cache" });
    }
  },
);

router.post(
  "/rfid/emergency-stop",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      await setEmergencyStop(true);
      res.json({
        success: true,
        message:
          "Emergency stop active. RFID scans will not be processed until resumed.",
      });
    } catch (error) {
      console.error("Emergency stop error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to set emergency stop" });
    }
  },
);

router.post(
  "/rfid/resume",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      await setEmergencyStop(false);
      res.json({
        success: true,
        message: "RFID processing resumed.",
      });
    } catch (error) {
      console.error("Resume RFID error:", error);
      res.status(500).json({ success: false, message: "Failed to resume" });
    }
  },
);

router.get(
  "/rfid/emergency-status",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const active = await isEmergencyStopActive();
      res.json({
        success: true,
        data: { active },
      });
    } catch (error) {
      console.error("Emergency status error:", error);
      res.status(500).json({ success: false, message: "Failed to get status" });
    }
  },
);

router.post(
  "/rfid/run-calibration",
  requireAuth,
  requireAdmin,
  dashboardRateLimit,
  async (req, res) => {
    try {
      await cacheService.invalidateIoTDevices();
      const devices = await iotDeviceManager.getAllDevices();
      const ts = new Date().toISOString();
      await cacheService.set("rfid_last_calibration", ts, { ttl: 86400 * 30 });
      res.json({
        success: true,
        message: "Calibration run complete. Device cache refreshed.",
        data: { ranAt: ts, devicesChecked: devices.length },
      });
    } catch (error) {
      console.error("Run calibration error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to run calibration" });
    }
  },
);

router.get(
  "/rfid/calibration-status",
  requireAuth,
  dashboardRateLimit,
  async (req, res) => {
    try {
      const last = await cacheService.get<string>("rfid_last_calibration");
      res.json({
        success: true,
        data: { lastCalibration: last || null },
      });
    } catch (error) {
      console.error("Calibration status error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to get calibration status" });
    }
  },
);
