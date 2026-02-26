import { Router } from "express";
import { integrationService } from "../services/integrationService.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// Sync students from LMS
router.post("/sync/students/:integrationId", requireAdmin, async (req, res) => {
  try {
    const { integrationId } = req.params;
    const result = await integrationService.syncStudentsFromLMS(integrationId);

    res.json({
      success: result.success,
      message: result.success
        ? `Synced ${result.syncedRecords} students successfully`
        : "Sync failed",
      data: result,
    });
  } catch (error) {
    console.error("Student sync error:", error);
    res.status(500).json({
      success: false,
      message: "Student synchronization failed",
    });
  }
});

// Sync attendance to LMS
router.post(
  "/sync/attendance/:integrationId/:sessionId",
  requireAdmin,
  async (req, res) => {
    try {
      const { integrationId, sessionId } = req.params;
      const result = await integrationService.syncAttendanceToLMS(
        integrationId,
        parseInt(sessionId),
      );

      res.json({
        success: result.success,
        message: result.success
          ? `Synced ${result.syncedRecords} attendance records`
          : "Attendance sync failed",
        data: result,
      });
    } catch (error) {
      console.error("Attendance sync error:", error);
      res.status(500).json({
        success: false,
        message: "Attendance synchronization failed",
      });
    }
  },
);

// Google Classroom integration
router.post(
  "/google-classroom/sync/:classroomId",
  requireAdmin,
  async (req, res) => {
    try {
      const { classroomId } = req.params;
      const result =
        await integrationService.syncWithGoogleClassroom(classroomId);

      res.json({
        success: result.success,
        message: result.success
          ? `Synced ${result.syncedRecords} records from Google Classroom`
          : "Google Classroom sync failed",
        data: result,
      });
    } catch (error) {
      console.error("Google Classroom sync error:", error);
      res.status(500).json({
        success: false,
        message: "Google Classroom synchronization failed",
      });
    }
  },
);

// Microsoft Teams integration
router.post("/microsoft-teams/sync/:teamId", requireAdmin, async (req, res) => {
  try {
    const { teamId } = req.params;
    const result = await integrationService.syncWithMicrosoftTeams(teamId);

    res.json({
      success: result.success,
      message: result.success
        ? `Synced ${result.syncedRecords} records from Microsoft Teams`
        : "Microsoft Teams sync failed",
      data: result,
    });
  } catch (error) {
    console.error("Microsoft Teams sync error:", error);
    res.status(500).json({
      success: false,
      message: "Microsoft Teams synchronization failed",
    });
  }
});

// Webhook endpoints for real-time integration
router.post("/webhook/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    // Verify webhook signature if needed
    const result = await integrationService.handleWebhook(provider, payload);

    res.json(result);
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
});

// Export data endpoints
router.get("/export/:format/:dataType", requireAdmin, async (req, res) => {
  try {
    const { format, dataType } = req.params;

    if (!["csv", "json", "xml"].includes(format)) {
      return res.status(400).json({
        success: false,
        message: "Invalid format. Supported: csv, json, xml",
      });
    }

    if (!["students", "attendance", "sessions"].includes(dataType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data type. Supported: students, attendance, sessions",
      });
    }

    const data = await integrationService.exportData(
      format as "csv" | "json" | "xml",
      dataType as "students" | "attendance" | "sessions",
    );

    // Set appropriate headers
    const mimeTypes = {
      csv: "text/csv",
      json: "application/json",
      xml: "application/xml",
    };

    res.setHeader("Content-Type", mimeTypes[format as keyof typeof mimeTypes]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${dataType}_export.${format}"`,
    );

    res.send(data);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Data export failed",
    });
  }
});

// Get integration status
router.get("/status", requireAdmin, async (req, res) => {
  try {
    // Return status of all integrations.
    // Production readiness: do not report synthetic/assumed status.
    // If an integration isn't configured, mark it inactive and leave lastSync as null.
    const integrations = {
      moodle: {
        configured: !!process.env.MOODLE_API_CONFIG,
        active: !!process.env.MOODLE_API_CONFIG,
        lastSync: null,
      },
      canvas: {
        configured: !!process.env.CANVAS_API_CONFIG,
        active: !!process.env.CANVAS_API_CONFIG,
        lastSync: null,
      },
      google_classroom: {
        configured: !!process.env.GOOGLE_CLASSROOM_API_KEY,
        active: !!process.env.GOOGLE_CLASSROOM_API_KEY,
        lastSync: null,
      },
      microsoft_teams: {
        configured: !!process.env.MICROSOFT_TEAMS_API_KEY,
        active: !!process.env.MICROSOFT_TEAMS_API_KEY,
        lastSync: null,
      },
    };

    res.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error("Integration status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get integration status",
    });
  }
});

// Bulk sync endpoint
router.post("/sync/bulk", requireAdmin, async (req, res) => {
  try {
    const { integrations, dataTypes } = req.body;

    const results = {
      totalSynced: 0,
      totalErrors: 0,
      details: [] as any[],
    };

    for (const integration of integrations) {
      for (const dataType of dataTypes) {
        try {
          let result;

          switch (dataType) {
            case "students":
              result =
                await integrationService.syncStudentsFromLMS(integration);
              break;
            case "attendance":
              // Would need session IDs for attendance sync
              continue;
            default:
              continue;
          }

          results.totalSynced += result.syncedRecords;
          results.totalErrors += result.errors.length;
          results.details.push({
            integration,
            dataType,
            result,
          });
        } catch (error) {
          results.totalErrors++;
          results.details.push({
            integration,
            dataType,
            error: (error as Error).message,
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Bulk sync completed: ${results.totalSynced} records synced, ${results.totalErrors} errors`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk sync error:", error);
    res.status(500).json({
      success: false,
      message: "Bulk synchronization failed",
    });
  }
});

export default router;
