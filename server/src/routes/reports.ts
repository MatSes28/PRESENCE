import { Router } from "express";
import { db } from "../storage.js";
import {
  attendanceRecords,
  classSessions,
  students,
  users,
  schedules,
  subjects,
  enrollments,
  reportHistory,
} from "../schema.js";
import { eq, and, gte, lte, lt, desc, sql } from "drizzle-orm";
import { reportSchedulerService } from "../services/reportScheduler.js";

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

// Middleware to check admin access
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
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
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authorization check failed",
    });
  }
};

// Get all report schedules
router.get("/schedules", requireAuth, async (req, res) => {
  try {
    const schedules = reportSchedulerService.getAllSchedules();

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    console.error("Get report schedules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report schedules",
    });
  }
});

// Create a new report schedule
router.post("/schedules", requireAdmin, async (req, res) => {
  try {
    const {
      name,
      type,
      recipients,
      reportType,
      filters,
      scheduleTime,
      isActive = true,
    } = req.body;

    if (!name || !type || !recipients || !reportType || !scheduleTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const scheduleId = await reportSchedulerService.createSchedule({
      name,
      type,
      recipients,
      reportType,
      filters: filters || {},
      scheduleTime,
      isActive,
    });

    res.status(201).json({
      success: true,
      message: "Report schedule created successfully",
      data: { scheduleId },
    });
  } catch (error) {
    console.error("Create report schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create report schedule",
    });
  }
});

// Update a report schedule
router.put("/schedules/:id", requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const updates = req.body;

    const success = await reportSchedulerService.updateSchedule(
      scheduleId,
      updates
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    res.json({
      success: true,
      message: "Report schedule updated successfully",
    });
  } catch (error) {
    console.error("Update report schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update report schedule",
    });
  }
});

// Delete a report schedule
router.delete("/schedules/:id", requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;

    const success = await reportSchedulerService.deleteSchedule(scheduleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Report schedule not found",
      });
    }

    res.json({
      success: true,
      message: "Report schedule deleted successfully",
    });
  } catch (error) {
    console.error("Delete report schedule error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report schedule",
    });
  }
});

// Manually trigger a report
router.post("/schedules/:id/trigger", requireAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;

    const success = await reportSchedulerService.triggerReport(scheduleId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Failed to trigger report",
      });
    }

    res.json({
      success: true,
      message: "Report triggered successfully",
    });
  } catch (error) {
    console.error("Trigger report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger report",
    });
  }
});

// Generate on-demand report
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { reportType, filters = {}, dateRange } = req.body;

    if (!reportType) {
      return res.status(400).json({
        success: false,
        message: "Report type is required",
      });
    }

    // Create a temporary schedule for on-demand report
    const tempScheduleId = await reportSchedulerService.createSchedule({
      name: "On-Demand Report",
      type: "daily", // Doesn't matter for on-demand
      recipients: [], // Not used for on-demand
      reportType,
      filters,
      scheduleTime: "00:00",
      isActive: false,
    });

    // Generate the report (this is a bit of a hack, but works)
    // In a real implementation, you'd have a separate method for on-demand reports
    const success = await reportSchedulerService.triggerReport(tempScheduleId);

    // Clean up the temporary schedule
    reportSchedulerService.deleteSchedule(tempScheduleId);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate report",
      });
    }

    res.json({
      success: true,
      message: "Report generated successfully",
      note: "Report has been sent to configured recipients",
    });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
});

// Get report templates
router.get("/templates", requireAuth, async (req, res) => {
  try {
    const templates = [
      {
        id: "attendance_summary",
        name: "Attendance Summary Report",
        description: "Comprehensive attendance statistics and trends",
        type: "attendance",
        defaultFilters: {},
      },
      {
        id: "student_performance",
        name: "Student Performance Report",
        description: "Individual student attendance and performance metrics",
        type: "performance",
        defaultFilters: {},
      },
      {
        id: "faculty_analytics",
        name: "Faculty Analytics Report",
        description: "Faculty performance and class analytics",
        type: "analytics",
        defaultFilters: {},
      },
      {
        id: "system_summary",
        name: "System Summary Report",
        description: "Overall system health and statistics",
        type: "summary",
        defaultFilters: {},
      },
    ];

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error("Get report templates error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report templates",
    });
  }
});

// Get attendance records for preview (used by frontend Reports page)
router.get("/attendance-records", requireAuth, async (req, res) => {
  try {
    const {
      limit = 10,
      offset = 0,
      date,
      studentId,
      sessionId,
      status,
    } = req.query;

    // Build conditions first
    const conditions = [];

    if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);

      conditions.push(gte(attendanceRecords.createdAt, startOfDay));
      conditions.push(lte(attendanceRecords.createdAt, endOfDay));
    }

    if (studentId) {
      conditions.push(
        eq(attendanceRecords.studentId, parseInt(studentId as string))
      );
    }

    if (sessionId) {
      conditions.push(
        eq(attendanceRecords.classSessionId, parseInt(sessionId as string))
      );
    }

    if (status) {
      conditions.push(eq(attendanceRecords.status, status as string));
    }

    // Build query with conditional where clause
    const baseQuery = db
      .select({
        record: attendanceRecords,
        student: {
          id: students.id,
          name: students.name,
          studentId: students.studentId,
        },
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id));

    const query =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const records = await query
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Get attendance records error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance records",
    });
  }
});

// Generate report (used by frontend Reports page)
router.post("/generate-report", requireAuth, async (req, res) => {
  try {
    const {
      type,
      format = "csv",
      startDate,
      endDate,
      subjectId,
      classroomId,
      facultyId,
    } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Report type is required",
      });
    }

    // Build query based on report type
    let query;
    let data = [];

    switch (type) {
      case "attendance":
        query = db
          .select({
            record: attendanceRecords,
            student: {
              id: students.id,
              name: students.name,
              studentId: students.studentId,
            },
            session: {
              id: classSessions.id,
              subjectName: subjects.name,
            },
          })
          .from(attendanceRecords)
          .leftJoin(students, eq(attendanceRecords.studentId, students.id))
          .leftJoin(
            classSessions,
            eq(attendanceRecords.classSessionId, classSessions.id)
          )
          .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
          .leftJoin(subjects, eq(schedules.subjectId, subjects.id));

        // Apply date filters
        const conditions = [];
        if (startDate) {
          conditions.push(
            gte(attendanceRecords.createdAt, new Date(startDate))
          );
        }
        if (endDate) {
          conditions.push(lte(attendanceRecords.createdAt, new Date(endDate)));
        }
        if (subjectId) {
          conditions.push(eq(schedules.subjectId, parseInt(subjectId)));
        }
        if (classroomId) {
          conditions.push(eq(schedules.classroomId, parseInt(classroomId)));
        }
        if (facultyId) {
          conditions.push(eq(schedules.facultyId, parseInt(facultyId)));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        data = await query.orderBy(desc(attendanceRecords.createdAt));
        break;

      case "students":
        query = db
          .select({
            student: students,
            enrollmentCount: sql<number>`count(${enrollments.id})`,
          })
          .from(students)
          .leftJoin(enrollments, eq(students.id, enrollments.studentId))
          .groupBy(students.id);

        data = await query;
        break;

      case "classroom":
        query = db
          .select({
            session: classSessions,
            schedule: schedules,
            attendanceCount: sql<number>`count(${attendanceRecords.id})`,
            presentCount: sql<number>`count(case when ${attendanceRecords.status} = 'present' then 1 end)`,
          })
          .from(classSessions)
          .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
          .leftJoin(
            attendanceRecords,
            eq(classSessions.id, attendanceRecords.classSessionId)
          )
          .groupBy(classSessions.id, schedules.id);

        // Apply date filters
        const sessionConditions = [];
        if (startDate) {
          sessionConditions.push(
            gte(classSessions.createdAt, new Date(startDate))
          );
        }
        if (endDate) {
          sessionConditions.push(
            lte(classSessions.createdAt, new Date(endDate))
          );
        }

        if (sessionConditions.length > 0) {
          query = query.where(and(...sessionConditions));
        }

        data = await query.orderBy(desc(classSessions.createdAt));
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        });
    }

    // For now, return the data directly
    // In a real implementation, you'd generate a file and return a download URL
    res.json({
      success: true,
      message: "Report data retrieved successfully",
      data: {
        type,
        format,
        recordCount: data.length,
        generatedAt: new Date(),
        data,
      },
    });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
});

// Get report history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const history = await db
      .select({
        id: reportHistory.id,
        name: reportHistory.name,
        type: reportHistory.type,
        generatedAt: reportHistory.generatedAt,
        status: reportHistory.status,
        recipients: reportHistory.recipients,
        downloadUrl: reportHistory.downloadUrl,
      })
      .from(reportHistory)
      .orderBy(desc(reportHistory.generatedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Get report history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report history",
    });
  }
});

// Get real-time attendance statistics
router.get("/real-time-stats", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's attendance stats
    const todayStats = await db
      .select({
        status: attendanceRecords.status,
        count: sql<number>`count(*)`,
      })
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.createdAt, today),
          lt(attendanceRecords.createdAt, tomorrow)
        )
      )
      .groupBy(attendanceRecords.status);

    // Active sessions today
    const activeSessions = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.date, today),
          lt(classSessions.date, tomorrow),
          eq(classSessions.status, "active")
        )
      );

    // Process stats
    let todayPresent = 0;
    let todayLate = 0;
    let todayAbsent = 0;

    todayStats.forEach((stat: any) => {
      switch (stat.status) {
        case "present":
          todayPresent = Number(stat.count);
          break;
        case "late":
          todayLate = Number(stat.count);
          break;
        case "absent":
          todayAbsent = Number(stat.count);
          break;
      }
    });

    res.json({
      success: true,
      data: {
        todayPresent,
        todayLate,
        todayAbsent,
        activeSessions: Number((activeSessions[0] as any)?.count || 0),
      },
    });
  } catch (error) {
    console.error("Get real-time stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch real-time statistics",
    });
  }
});

export default router;
