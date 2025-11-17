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

    // Mock additional stats for now
    const stats = {
      todayClasses: todayClassesResult[0]?.count || 0,
      presentStudents: presentCount,
      absentStudents: absentCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      totalEvents: 150, // Mock
      activeDevices: 2, // Mock
      systemUptime: "7d 12h 30m", // Mock
      errorRate: 0.5, // Mock
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

export default router;
