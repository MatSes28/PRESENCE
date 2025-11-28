import { Router } from "express";
import { gdprService } from "../services/gdprService.js";
import { parentConsentService } from "../services/parentConsentService.js";
import { validateRequest, validationRules } from "../middleware/validation.js";

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

// Middleware to check if user can access GDPR data (own data or admin)
const requireDataAccess = (req: any, res: any, next: any) => {
  const requestedUserId = parseInt(req.params.userId);
  const currentUserId = req.session?.userId;
  const userRole = req.session?.role;

  // Users can access their own data, admins can access any data
  if (currentUserId === requestedUserId || userRole === "admin") {
    (req as any).requestedUserId = requestedUserId;
    next();
  } else {
    return res.status(403).json({
      success: false,
      message:
        "Access denied: Can only access own data or requires admin privileges",
    });
  }
};

// GDPR Data Subject Rights Endpoints

// Right of Access - Get data access report
router.get(
  "/access/:userId",
  requireAuth,
  requireDataAccess,
  async (req, res) => {
    try {
      const userId = req.requestedUserId;
      const report = await gdprService.getDataAccessReport(userId);

      // Log privacy access
      await gdprService.logPrivacyEvent(
        userId,
        "data_access_request",
        "GDPR data access report generated",
        req.ip,
        req.get("User-Agent") || "",
        "User requested data access report under GDPR Article 15"
      );

      res.json({
        success: true,
        message: "Data access report generated",
        report,
      });
    } catch (error) {
      console.error("GDPR access error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Right to Data Portability - Export data
router.get(
  "/portability/:userId",
  requireAuth,
  requireDataAccess,
  async (req, res) => {
    try {
      const userId = req.requestedUserId;
      const portableData = await gdprService.exportDataPortability(userId);

      // Log privacy export
      await gdprService.logPrivacyEvent(
        userId,
        "data_portability_request",
        "GDPR data portability export generated",
        req.ip,
        req.get("User-Agent") || "",
        "User requested data portability under GDPR Article 20"
      );

      res.json({
        success: true,
        message: "Data portability export generated",
        data: portableData,
      });
    } catch (error) {
      console.error("GDPR portability error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Right to Rectification - Request data correction
router.post(
  "/rectification/:userId",
  requireAuth,
  requireDataAccess,
  validateRequest({
    corrections: (value) => {
      if (!value || typeof value !== "object") {
        return "Corrections must be provided as an object";
      }
      return null;
    },
    reason: (value) => {
      if (!value || typeof value !== "string" || value.length < 10) {
        return "Reason must be at least 10 characters";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const userId = req.requestedUserId;
      const { corrections, reason } = req.body;
      const requestedBy = req.session.userId;

      const requestId = await gdprService.requestDataRectification(
        userId,
        requestedBy,
        corrections
      );

      // Log privacy rectification request
      await gdprService.logPrivacyEvent(
        userId,
        "data_rectification_request",
        `GDPR rectification requested: ${reason}`,
        req.ip,
        req.get("User-Agent") || "",
        "User requested data rectification under GDPR Article 16"
      );

      res.json({
        success: true,
        message: "Data rectification request submitted",
        requestId,
      });
    } catch (error) {
      console.error("GDPR rectification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Right to Erasure - Request data deletion
router.post(
  "/erasure/:userId",
  requireAuth,
  requireDataAccess,
  validateRequest({
    reason: (value) => {
      if (!value || typeof value !== "string" || value.length < 20) {
        return "Reason must be at least 20 characters explaining why data should be erased";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const userId = req.requestedUserId;
      const { reason } = req.body;
      const requestedBy = req.session.userId;

      const requestId = await gdprService.requestDataErasure(
        userId,
        requestedBy,
        reason
      );

      // Log privacy erasure request
      await gdprService.logPrivacyEvent(
        userId,
        "data_erasure_request",
        `GDPR erasure requested: ${reason}`,
        req.ip,
        req.get("User-Agent") || "",
        "User requested data erasure under GDPR Article 17"
      );

      res.json({
        success: true,
        message: "Data erasure request submitted for review",
        requestId,
        note: "This request will be reviewed by data protection officers before processing",
      });
    } catch (error) {
      console.error("GDPR erasure error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Right to Restriction - Request processing restriction
router.post(
  "/restriction/:userId",
  requireAuth,
  requireDataAccess,
  validateRequest({
    restrictionType: (value) => {
      const validTypes = ["attendance", "notifications", "all"];
      if (!validTypes.includes(value)) {
        return `Restriction type must be one of: ${validTypes.join(", ")}`;
      }
      return null;
    },
    reason: (value) => {
      if (!value || typeof value !== "string" || value.length < 10) {
        return "Reason must be at least 10 characters";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const userId = req.requestedUserId;
      const { restrictionType, reason } = req.body;
      const requestedBy = req.session.userId;

      await gdprService.restrictDataProcessing(
        userId,
        restrictionType,
        requestedBy
      );

      // Log privacy restriction
      await gdprService.logPrivacyEvent(
        userId,
        "data_restriction_request",
        `GDPR processing restriction: ${restrictionType} - ${reason}`,
        req.ip,
        req.get("User-Agent") || "",
        "User requested processing restriction under GDPR Article 18"
      );

      res.json({
        success: true,
        message: `Data processing restricted for: ${restrictionType}`,
      });
    } catch (error) {
      console.error("GDPR restriction error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Right to Object - Object to processing
router.post(
  "/objection/:userId",
  requireAuth,
  requireDataAccess,
  validateRequest({
    processingType: (value) => {
      if (!value || typeof value !== "string" || value.length < 5) {
        return "Processing type must be specified";
      }
      return null;
    },
    reason: (value) => {
      if (!value || typeof value !== "string" || value.length < 10) {
        return "Reason must be at least 10 characters";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const userId = req.requestedUserId;
      const { processingType, reason } = req.body;
      const requestedBy = req.session.userId;

      await gdprService.objectToProcessing(userId, processingType, requestedBy);

      // Log privacy objection
      await gdprService.logPrivacyEvent(
        userId,
        "data_objection_request",
        `GDPR processing objection: ${processingType} - ${reason}`,
        req.ip,
        req.get("User-Agent") || "",
        "User objected to processing under GDPR Article 21"
      );

      res.json({
        success: true,
        message: `Objection recorded for processing type: ${processingType}`,
      });
    } catch (error) {
      console.error("GDPR objection error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Parent Consent Management Endpoints

// Request parent consent
router.post(
  "/consent/request/:studentId",
  requireAuth,
  validateRequest({
    consentType: (value) => {
      const validTypes = [
        "attendance_tracking",
        "email_notifications",
        "data_processing",
        "emergency_contact",
      ];
      if (!validTypes.includes(value)) {
        return `Consent type must be one of: ${validTypes.join(", ")}`;
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const { consentType } = req.body;
      const requestedBy = req.session.userId;

      const requestId = await parentConsentService.requestParentConsent(
        studentId,
        consentType,
        requestedBy
      );

      res.json({
        success: true,
        message: "Parent consent request sent",
        requestId,
      });
    } catch (error) {
      console.error("Parent consent request error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
);

// Process parent consent (from email link)
router.post(
  "/consent/process",
  validateRequest({
    token: (value) => {
      if (!value || typeof value !== "string" || value.length !== 64) {
        return "Invalid consent token";
      }
      return null;
    },
    consented: (value) => {
      if (typeof value !== "boolean") {
        return "Consent must be true or false";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const { token, consented } = req.body;

      const success = await parentConsentService.processParentConsent(
        token,
        consented,
        req.ip,
        req.get("User-Agent") || ""
      );

      if (success) {
        res.json({
          success: true,
          message: consented
            ? "Consent granted successfully"
            : "Consent denied",
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Failed to process consent",
        });
      }
    } catch (error) {
      console.error("Parent consent process error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  }
);

// Get student consent status
router.get("/consent/status/:studentId", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const status = await parentConsentService.getStudentConsentStatus(
      studentId
    );

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("Get consent status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Revoke parent consent
router.post(
  "/consent/revoke/:studentId",
  requireAuth,
  validateRequest({
    consentType: (value) => {
      const validTypes = [
        "attendance_tracking",
        "email_notifications",
        "data_processing",
        "emergency_contact",
      ];
      if (!validTypes.includes(value)) {
        return `Consent type must be one of: ${validTypes.join(", ")}`;
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const { consentType } = req.body;
      const requestedBy = req.session.userId;

      await parentConsentService.revokeParentConsent(
        studentId,
        consentType,
        requestedBy
      );

      res.json({
        success: true,
        message: `Consent revoked for: ${consentType}`,
      });
    } catch (error) {
      console.error("Revoke consent error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Generate consent report
router.get("/consent/report/:studentId", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const report = await parentConsentService.generateConsentReport(studentId);

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Generate consent report error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Privacy Policy and Terms
router.get("/privacy-policy", (req, res) => {
  res.json({
    success: true,
    policy: {
      version: "1.0.0",
      effectiveDate: "2025-01-01",
      dataController: "CLIRDEC:PRESENCE System",
      dataProtectionOfficer: "dpo@clsu.edu.ph",
      dataCollected: [
        "Student personal information (name, student ID, email)",
        "Parent contact information",
        "Attendance records and timestamps",
        "RFID card identifiers",
        "IP addresses and device information",
        "Email communication records",
      ],
      legalBasis: [
        "Consent from parents/guardians",
        "Legitimate interest for educational purposes",
        "Legal obligation for attendance tracking",
      ],
      dataRetention:
        "7 years from last activity, or until consent is withdrawn",
      dataSharing:
        "Data is not shared with third parties except as required by law",
      gdprRights: [
        "Right to access your data",
        "Right to rectification",
        "Right to erasure ('right to be forgotten')",
        "Right to data portability",
        "Right to restrict processing",
        "Right to object to processing",
      ],
    },
  });
});

export default router;
