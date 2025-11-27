import { Router } from "express";
import { db } from "../storage.js";
import {
  attendanceRecords,
  classSessions,
  students,
  users,
  schedules,
  classrooms,
  subjects,
  computerAssignments,
} from "../schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const router = Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

// Get dashboard statistics
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    // Today's classes count
    const todayClassesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay)
        )
      );

    // Present students today
    const presentStudentsResult = await db
      .select({
        count: sql<number>`count(distinct ${attendanceRecords.studentId})`,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay),
          eq(attendanceRecords.status, "present")
        )
      );

    // Absent students today
    const absentStudentsResult = await db
      .select({
        count: sql<number>`count(distinct ${attendanceRecords.studentId})`,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay),
          eq(attendanceRecords.status, "absent")
        )
      );

    // Total students
    const totalStudentsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.isActive, true));

    // Calculate attendance rate
    const presentCount = presentStudentsResult[0]?.count || 0;
    const absentCount = absentStudentsResult[0]?.count || 0;
    const totalRecorded = presentCount + absentCount;
    const attendanceRate =
      totalRecorded > 0 ? (presentCount / totalRecorded) * 100 : 0;

    // Calculate total events (attendance records today)
    const totalEventsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay)
        )
      );

    // Calculate active devices (computers that have active assignments today)
    const activeDevicesResult = await db
      .select({
        count: sql<number>`count(distinct ${computerAssignments.computerId})`,
      })
      .from(computerAssignments)
      .innerJoin(
        classSessions,
        eq(computerAssignments.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay),
          eq(computerAssignments.status, "active")
        )
      );

    // Calculate system uptime (simplified - days since system start)
    // In a real system, this would be tracked in a system status table
    const systemStartDate = new Date("2024-01-01"); // Mock system start date
    const uptimeMs = today.getTime() - systemStartDate.getTime();
    const uptimeDays = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const uptimeHours = Math.floor(
      (uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const uptimeMinutes = Math.floor(
      (uptimeMs % (1000 * 60 * 60)) / (1000 * 60)
    );
    const systemUptime = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`;

    // Calculate error rate (discrepancies vs total records)
    const discrepancyResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay),
          eq(attendanceRecords.discrepancyFlag, true)
        )
      );

    const totalEvents = totalEventsResult[0]?.count || 0;
    const discrepancyCount = discrepancyResult[0]?.count || 0;
    const errorRate =
      totalEvents > 0 ? (discrepancyCount / totalEvents) * 100 : 0;

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

    res.json({
      success: true,
      data: stats,
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
router.get("/activity", requireAuth, async (req, res) => {
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
router.get("/sessions/active", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
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
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(
        and(
          gte(classSessions.date, startOfDay),
          lte(classSessions.date, endOfDay),
          eq(classSessions.status, "active")
        )
      )
      .groupBy(
        classSessions.id,
        subjects.name,
        classrooms.name,
        schedules.startTime,
        classSessions.status
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
});

// Get analytics data for charts and trends
router.get("/analytics", requireAuth, async (req, res) => {
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
          lte(attendanceRecords.createdAt, endDate)
        )
      )
      .groupBy(sql`DATE(${attendanceRecords.createdAt})`)
      .orderBy(sql`DATE(${attendanceRecords.createdAt})`);

    // Hourly attendance patterns
    const hourlyPatterns = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${attendanceRecords.createdAt})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate)
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${attendanceRecords.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${attendanceRecords.createdAt})`);

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
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate)
        )
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
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(
        and(
          gte(attendanceRecords.createdAt, startDate),
          lte(attendanceRecords.createdAt, endDate)
        )
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

export default router;
