import { Router } from "express";
import { dataAnonymizationService } from "../services/dataAnonymizationService.js";
import { dataRetentionService } from "../services/dataRetentionService.js";
import { encryptionService } from "../services/encryptionService.js";
import { gdprService } from "../services/gdprService.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validation.js";

const router = Router();

// Anonymized analytics endpoints

// Get anonymized student data for analytics
router.get("/analytics/students", requireAdmin, async (req, res) => {
  try {
    const anonymizedStudents =
      await dataAnonymizationService.getAnonymizedStudents();

    res.json({
      success: true,
      data: anonymizedStudents,
      privacyNote: "All data has been anonymized for analytics purposes",
    });
  } catch (error) {
    console.error("Get anonymized students error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get anonymized attendance data
router.get("/analytics/attendance", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const anonymizedAttendance =
      await dataAnonymizationService.getAnonymizedAttendanceRecords(limit);

    res.json({
      success: true,
      data: anonymizedAttendance,
      privacyNote: "All data has been anonymized for analytics purposes",
    });
  } catch (error) {
    console.error("Get anonymized attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get aggregated analytics (privacy-safe statistics)
router.get("/analytics/aggregated", requireAdmin, async (req, res) => {
  try {
    const aggregatedData =
      await dataAnonymizationService.getAggregatedAnalytics();

    res.json({
      success: true,
      data: aggregatedData,
    });
  } catch (error) {
    console.error("Get aggregated analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get privacy-safe statistics
router.get("/analytics/statistics", requireAuth, async (req, res) => {
  try {
    const statistics =
      await dataAnonymizationService.getPrivacySafeStatistics();

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error("Get privacy statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Export anonymized data
router.get("/analytics/export", requireAdmin, async (req, res) => {
  try {
    const exportData = await dataAnonymizationService.exportAnonymizedData();

    res.json({
      success: true,
      export: exportData,
    });
  } catch (error) {
    console.error("Export anonymized data error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Data retention management endpoints

// Execute data retention cleanup
router.post("/retention/cleanup", requireAdmin, async (req, res) => {
  try {
    const results = await dataRetentionService.executeRetentionCleanup();

    res.json({
      success: true,
      message: "Data retention cleanup completed",
      results,
    });
  } catch (error) {
    console.error("Data retention cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Preview retention cleanup
router.get("/retention/preview", requireAdmin, async (req, res) => {
  try {
    const preview = await dataRetentionService.previewRetentionCleanup();

    res.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error("Preview retention cleanup error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get retention policies
router.get("/retention/policies", requireAdmin, async (req, res) => {
  try {
    const policies = dataRetentionService.getRetentionPolicies();

    res.json({
      success: true,
      policies,
    });
  } catch (error) {
    console.error("Get retention policies error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update retention policy
router.put(
  "/retention/policies/:table",
  requireAdmin,
  validateRequest({
    retentionDays: (value) => {
      if (!value || typeof value !== "number" || value < 1) {
        return "Retention days must be a positive number";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const { table } = req.params;
      const { retentionDays } = req.body;

      dataRetentionService.updateRetentionPolicy(table, retentionDays);

      res.json({
        success: true,
        message: `Retention policy updated for ${table}`,
      });
    } catch (error) {
      console.error("Update retention policy error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Encryption management endpoints

// Generate encryption report
router.get("/encryption/report", requireAdmin, async (req, res) => {
  try {
    const report = await encryptionService.generateEncryptionReport();

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Generate encryption report error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Verify encryption integrity
router.get("/encryption/verify", requireAdmin, async (req, res) => {
  try {
    const integrityCheck = await encryptionService.verifyEncryptionIntegrity();

    res.json({
      success: true,
      integrity: integrityCheck,
    });
  } catch (error) {
    console.error("Verify encryption integrity error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Privacy compliance endpoints

// Get data processing inventory
router.get("/compliance/inventory", requireAdmin, async (req, res) => {
  try {
    const inventory = {
      dataCategories: [
        "Personal identification data (names, IDs)",
        "Contact information (emails, phone numbers)",
        "Attendance and location data",
        "Device and sensor data",
        "Communication records",
      ],
      processingPurposes: [
        "Attendance tracking and reporting",
        "Academic performance monitoring",
        "Parent communication",
        "System security and access control",
        "Analytics and reporting (anonymized)",
      ],
      dataRecipients: [
        "Educational institution staff",
        "Parents/guardians",
        "System administrators",
        "External analytics services (anonymized only)",
      ],
      retentionPeriods: {
        attendance_records: "7 years",
        personal_data: "7 years or until consent withdrawn",
        logs: "2 years",
        sessions: "1 year",
      },
      securityMeasures: [
        "Field-level encryption for sensitive data",
        "Access controls and authentication",
        "Audit logging",
        "Data anonymization for analytics",
        "Regular security assessments",
      ],
    };

    res.json({
      success: true,
      inventory,
    });
  } catch (error) {
    console.error("Get compliance inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Generate privacy impact assessment
router.post(
  "/compliance/pia",
  requireAdmin,
  validateRequest({
    dataProcessing: (value) => {
      if (!value || typeof value !== "string" || value.length < 5) {
        return "Data processing description must be at least 5 characters";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const { dataProcessing } = req.body;
      const assessment = await gdprService.performPrivacyImpactAssessment(
        dataProcessing
      );

      // In a real implementation, this would generate a proper PIA
      const pia = {
        processing: dataProcessing,
        riskLevel: "low",
        mitigationMeasures: [
          "Data minimization",
          "Purpose limitation",
          "Consent management",
          "Data subject rights implementation",
          "Regular audits",
        ],
        assessmentDate: new Date(),
        assessor: "System Administrator",
      };

      res.json({
        success: true,
        pia,
      });
    } catch (error) {
      console.error("Generate PIA error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

export default router;
