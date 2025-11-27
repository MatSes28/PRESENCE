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
} from "../schema.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
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

// Get report history (mock implementation)
router.get("/history", requireAuth, async (req, res) => {
  try {
    // In a real implementation, you'd store report history in the database
    const history = [
      {
        id: "report_001",
        name: "Daily Attendance Summary",
        type: "attendance",
        generatedAt: new Date(Date.now() - 86400000), // Yesterday
        status: "completed",
        recipients: ["admin@clsu.edu.ph"],
        downloadUrl: "/reports/download/report_001.pdf",
      },
      {
        id: "report_002",
        name: "Weekly Performance Report",
        type: "performance",
        generatedAt: new Date(Date.now() - 604800000), // Last week
        status: "completed",
        recipients: ["admin@clsu.edu.ph"],
        downloadUrl: "/reports/download/report_002.pdf",
      },
    ];

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

export default router;
