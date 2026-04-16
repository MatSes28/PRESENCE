import { Router } from "express";
import db from "../storage.js";
import PDFDocument from "pdfkit";
import {
  attendanceRecords,
  classSessions,
  students,
  schedules,
  subjects,
  enrollments,
  reportHistory,
} from "../schema.js";
import { eq, and, gte, lte, lt, desc, sql } from "drizzle-orm";
import { reportSchedulerService } from "../services/reportScheduler.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

const toPrintableValue = (value: any): string => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.values(value)
      .filter((entry) => entry != null && entry !== "")
      .map((entry) => toPrintableValue(entry))
      .join(" - ");
  }
  return String(value);
};

const flattenReportRow = (row: Record<string, any>, prefix = "") => {
  return Object.entries(row).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const nextKey = prefix ? `${prefix}_${key}` : key;

      if (value && typeof value === "object" && !(value instanceof Date)) {
        Object.assign(
          acc,
          flattenReportRow(value as Record<string, any>, nextKey),
        );
      } else {
        acc[nextKey] = toPrintableValue(value);
      }

      return acc;
    },
    {},
  );
};

const flattenReportRows = (rows: any[]) =>
  rows.map((row) => flattenReportRow(row));

const buildPdfBuffer = async (
  title: string,
  rows: Record<string, string>[],
) => {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(18).text(title, { align: "center" });
  doc.moveDown();
  doc.fontSize(10).text(`Generated at ${new Date().toLocaleString()}`, {
    align: "center",
  });
  doc.moveDown(2);

  if (rows.length === 0) {
    doc.fontSize(12).text("No report data available for the selected filters.");
    doc.end();
    return bufferPromise;
  }

  const headers = Object.keys(rows[0]);
  const maxColumns = Math.max(headers.length, 1);
  const columnWidth = Math.max(80, 500 / maxColumns);

  doc.fontSize(9);
  headers.forEach((header, index) => {
    doc.text(
      header.replace(/_/g, " ").toUpperCase(),
      40 + index * columnWidth,
      doc.y,
      {
        width: columnWidth - 8,
        continued: index < headers.length - 1,
      },
    );
  });
  doc.moveDown();
  doc.moveTo(40, doc.y).lineTo(560, doc.y).stroke("#cccccc");
  doc.moveDown(0.5);

  rows.slice(0, 150).forEach((row) => {
    if (doc.y > 720) {
      doc.addPage();
    }

    headers.forEach((header, index) => {
      doc.text(row[header] || "", 40 + index * columnWidth, doc.y, {
        width: columnWidth - 8,
        continued: index < headers.length - 1,
      });
    });
    doc.moveDown();
  });

  doc.end();
  return bufferPromise;
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
      updates,
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
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
    const {
      limit = 10,
      offset = 0,
      date,
      startDate,
      endDate,
      subjectId,
      studentId,
      sessionId,
      status,
    } = req.query;

    // Build conditions first
    const conditions = [];

    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      conditions.push(gte(attendanceRecords.createdAt, start));
      conditions.push(lte(attendanceRecords.createdAt, end));
    } else if (date) {
      const startOfDay = new Date(date as string);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date as string);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(attendanceRecords.createdAt, startOfDay));
      conditions.push(lte(attendanceRecords.createdAt, endOfDay));
    }

    if (studentId) {
      conditions.push(
        eq(attendanceRecords.studentId, parseInt(studentId as string)),
      );
    }

    if (sessionId) {
      conditions.push(
        eq(attendanceRecords.classSessionId, parseInt(sessionId as string)),
      );
    }

    if (status) {
      conditions.push(eq(attendanceRecords.status, status as string));
    }

    if (isFaculty) {
      conditions.push(eq(schedules.facultyId, facultyUserId));
    }

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
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .leftJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id));

    if (subjectId) {
      conditions.push(eq(schedules.subjectId, parseInt(subjectId as string)));
    }

    const query =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const countQuery = db
      .select({ total: sql<number>`count(*)` })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .leftJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id));

    const [{ total = 0 } = { total: 0 }] =
      conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;

    const records = await query
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      data: records,
      total: Number(total),
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
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
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
            eq(attendanceRecords.classSessionId, classSessions.id),
          )
          .leftJoin(schedules, eq(classSessions.scheduleId, schedules.id))
          .leftJoin(subjects, eq(schedules.subjectId, subjects.id));

        // Apply date filters
        const conditions = [];
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          conditions.push(gte(attendanceRecords.createdAt, start));
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          conditions.push(lte(attendanceRecords.createdAt, end));
        }
        if (subjectId) {
          conditions.push(eq(schedules.subjectId, parseInt(subjectId)));
        }
        if (classroomId) {
          conditions.push(eq(schedules.classroomId, parseInt(classroomId)));
        }
        if (isFaculty) {
          conditions.push(eq(schedules.facultyId, facultyUserId));
        } else if (facultyId) {
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
            eq(classSessions.id, attendanceRecords.classSessionId),
          )
          .groupBy(classSessions.id, schedules.id);

        // Apply date filters
        const sessionConditions = [];
        if (startDate) {
          sessionConditions.push(
            gte(classSessions.createdAt, new Date(startDate)),
          );
        }
        if (endDate) {
          sessionConditions.push(
            lte(classSessions.createdAt, new Date(endDate)),
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

    const flattenedData = flattenReportRows(data);

    // Generate CSV or return JSON data
    if (format === "csv") {
      // Convert data to CSV
      const headers =
        flattenedData.length > 0 ? Object.keys(flattenedData[0]).join(",") : "";
      const rows = flattenedData.map((row: any) =>
        Object.values(row)
          .map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const csv = [headers, ...rows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attendance_report_${new Date().toISOString().split("T")[0]}.csv"`,
      );
      return res.send(csv);
    }

    if (format === "pdf") {
      const pdfBuffer = await buildPdfBuffer(
        `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
        flattenedData,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}_report_${new Date().toISOString().split("T")[0]}.pdf"`,
      );
      return res.send(pdfBuffer);
    }

    // For JSON format or empty data, return the data directly
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
        reportType: reportHistory.reportType,
        generatedAt: reportHistory.generatedAt,
        status: reportHistory.status,
        recordCount: reportHistory.recordCount,
        filePath: reportHistory.filePath,
        errorMessage: reportHistory.errorMessage,
        parameters: reportHistory.parameters,
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
    const isFaculty = req.session?.userRole === "faculty";
    const facultyUserId = Number(req.session?.userId);
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
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          gte(attendanceRecords.createdAt, today),
          lt(attendanceRecords.createdAt, tomorrow),
          isFaculty ? eq(schedules.facultyId, facultyUserId) : undefined,
        ),
      )
      .groupBy(attendanceRecords.status);

    // Active sessions today
    const activeSessions = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          gte(classSessions.date, today),
          lt(classSessions.date, tomorrow),
          eq(classSessions.status, "active"),
          isFaculty ? eq(schedules.facultyId, facultyUserId) : undefined,
        ),
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
