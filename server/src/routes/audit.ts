import { Router } from "express";
import { auditService } from "../services/auditService.js";
import { logAggregationService } from "../services/logAggregationService.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Apply authentication to all audit routes
router.use(requireAuth);

// Get audit statistics
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const stats = await auditService.getAuditStats(start, end);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting audit stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve audit statistics",
    });
  }
});

// Query audit events
router.get("/events", requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      ipAddress,
      success,
      limit,
      offset,
    } = req.query;

    const query = {
      userId: userId ? parseInt(userId as string) : undefined,
      action: action as string,
      resource: resource as string,
      resourceId: resourceId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      ipAddress: ipAddress as string,
      success: success ? success === "true" : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const events = await auditService.queryEvents(query);

    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error("Error querying audit events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to query audit events",
    });
  }
});

// Generate compliance report
router.get("/compliance-report", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, reportType } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const type =
      (reportType as "access" | "changes" | "security" | "full") || "full";

    const report = await auditService.generateComplianceReport(
      start,
      end,
      type
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating compliance report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate compliance report",
    });
  }
});

// GDPR data export
router.get("/gdpr-export/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const data = await auditService.generateGDPRDataExport(userIdNum);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error generating GDPR export:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate GDPR data export",
    });
  }
});

// GDPR data deletion (right to be forgotten)
router.delete("/gdpr-delete/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    await auditService.deleteUserData(userIdNum);

    res.json({
      success: true,
      message: "User data deletion initiated",
    });
  } catch (error) {
    console.error("Error deleting user data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user data",
    });
  }
});

// Log aggregation and analysis routes

// Get aggregated log statistics
router.get("/aggregated-stats", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const stats = await logAggregationService.generateAggregatedStats(
      start,
      end
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting aggregated stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve aggregated statistics",
    });
  }
});

// Search logs
router.get("/search", requireAdmin, async (req, res) => {
  try {
    const {
      text,
      userId,
      action,
      resource,
      ipAddress,
      startDate,
      endDate,
      success,
      limit,
      offset,
    } = req.query;

    const query = {
      text: text as string,
      userId: userId ? parseInt(userId as string) : undefined,
      action: action as string,
      resource: resource as string,
      ipAddress: ipAddress as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      success: success ? success === "true" : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const results = await logAggregationService.searchLogs(query);

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error("Error searching logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search logs",
    });
  }
});

// Get real-time logs
router.get("/realtime", requireAdmin, async (req, res) => {
  try {
    const { since, limit } = req.query;

    const sinceDate = since
      ? new Date(since as string)
      : new Date(Date.now() - 5 * 60 * 1000);
    const limitNum = limit ? parseInt(limit as string) : 100;

    const logs = await logAggregationService.getRealTimeLogs(
      sinceDate,
      limitNum
    );

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error getting real-time logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get real-time logs",
    });
  }
});

// Export logs
router.get("/export", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, format, ...filters } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const exportFormat = (format as "json" | "csv" | "xml") || "json";

    const exportedData = await logAggregationService.exportLogs(
      start,
      end,
      exportFormat,
      filters
    );

    // Set appropriate headers based on format
    const fileName = `audit_logs_${start.toISOString().split("T")[0]}_${
      end.toISOString().split("T")[0]
    }`;

    switch (exportFormat) {
      case "json":
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}.json"`
        );
        break;
      case "csv":
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}.csv"`
        );
        break;
      case "xml":
        res.setHeader("Content-Type", "application/xml");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}.xml"`
        );
        break;
    }

    res.send(exportedData);
  } catch (error) {
    console.error("Error exporting logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export logs",
    });
  }
});

// Get log aggregation service configuration
router.get("/config", requireAdmin, async (req, res) => {
  try {
    const config = logAggregationService.getConfig();

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error getting log aggregation config:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get configuration",
    });
  }
});

// Update log aggregation service configuration
router.put("/config", requireAdmin, async (req, res) => {
  try {
    const newConfig = req.body;

    logAggregationService.updateConfig(newConfig);

    res.json({
      success: true,
      message: "Configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating log aggregation config:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update configuration",
    });
  }
});

export default router;
