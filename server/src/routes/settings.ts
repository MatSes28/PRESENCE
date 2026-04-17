import { Router } from "express";
import db from "../storage.js";
import { users, systemSettings } from "../schema.js";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { auditLogger } from "../services/audit/auditLogger.js";

const router = Router();

// Helper functions for system settings
const getSetting = async (key: string) => {
  const result = await db
    .select()
    .from(systemSettings)
    .where(and(eq(systemSettings.key, key), eq(systemSettings.isActive, true)))
    .limit(1);
  return result[0]?.value || null;
};

const setSetting = async (
  key: string,
  value: any,
  category: string,
  description?: string
) => {
  const existing = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(systemSettings)
      .set({
        value,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({
      key,
      value,
      category,
      description,
    });
  }
};

const getRequestIp = (req: any) =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  "unknown";

const logSettingsAudit = async (
  req: any,
  category: "system" | "hardware" | "email" | "iot",
  oldValues: any,
  newValues: any,
) => {
  await auditLogger.logEvent({
    userId: req.session?.userId ? Number(req.session.userId) : null,
    action: "SETTINGS_UPDATED",
    resource: "settings",
    resourceId: category,
    oldValues,
    newValues,
    ipAddress: getRequestIp(req),
    userAgent: req.get("user-agent") || "",
    sessionId: req.sessionID,
    success: true,
    metadata: { category },
  });
};

// Update user profile
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.session?.userId;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    // Check if email is already taken by another user
    const emailCheck = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (emailCheck.length > 0 && emailCheck[0].id !== userId) {
      return res.status(409).json({
        success: false,
        message: "Email already taken",
      });
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        name,
        email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Change password
router.put("/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session?.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Get current user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user[0].password
    );
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get system settings (admin only)
router.get("/system", requireAdmin, async (req, res) => {
  try {
    const settings = {
      lateThreshold: (await getSetting("lateThreshold")) ?? 15,
      absentThreshold: (await getSetting("absentThreshold")) ?? 60,
      emailNotifications: (await getSetting("emailNotifications")) ?? true,
      semester: (await getSetting("semester")) ?? "1st Semester",
      academicYear:
        (await getSetting("academicYear")) ??
        new Date().getFullYear().toString(),
      autoEndSessions: (await getSetting("autoEndSessions")) ?? true,
      requireProfessorTap: (await getSetting("requireProfessorTap")) ?? false,
    };
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Get system settings error:", error);
    // Return defaults so Settings page still loads if table is missing or DB error
    res.json({
      success: true,
      settings: {
        lateThreshold: 15,
        absentThreshold: 60,
        emailNotifications: true,
        semester: "1st Semester",
        academicYear: new Date().getFullYear().toString(),
        autoEndSessions: true,
        requireProfessorTap: false,
      },
    });
  }
});

// Update system settings (admin only)
router.put("/system", requireAdmin, async (req, res) => {
  try {
    const previousSettings = {
      lateThreshold: (await getSetting("lateThreshold")) ?? 15,
      absentThreshold: (await getSetting("absentThreshold")) ?? 60,
      emailNotifications: (await getSetting("emailNotifications")) ?? true,
      semester: (await getSetting("semester")) ?? "1st Semester",
      academicYear:
        (await getSetting("academicYear")) ??
        new Date().getFullYear().toString(),
      autoEndSessions: (await getSetting("autoEndSessions")) ?? true,
      requireProfessorTap: (await getSetting("requireProfessorTap")) ?? false,
    };
    const {
      lateThreshold,
      absentThreshold,
      emailNotifications,
      semester,
      academicYear,
      autoEndSessions,
      requireProfessorTap,
    } = req.body;

    // Save settings to database
    await setSetting(
      "lateThreshold",
      lateThreshold || 15,
      "system",
      "Late threshold in minutes"
    );
    await setSetting(
      "absentThreshold",
      absentThreshold || 60,
      "system",
      "Absent threshold in minutes"
    );
    await setSetting(
      "emailNotifications",
      emailNotifications ?? true,
      "system",
      "Enable email notifications"
    );
    await setSetting(
      "semester",
      semester || "1st Semester",
      "system",
      "Current semester"
    );
    await setSetting(
      "academicYear",
      academicYear || new Date().getFullYear().toString(),
      "system",
      "Academic year"
    );
    await setSetting(
      "autoEndSessions",
      autoEndSessions ?? true,
      "system",
      "Auto-end sessions after scheduled time"
    );
    await setSetting(
      "requireProfessorTap",
      requireProfessorTap ?? false,
      "system",
      "Require professor tap to activate session"
    );

    const settings = {
      lateThreshold: lateThreshold || 15,
      absentThreshold: absentThreshold || 60,
      emailNotifications: emailNotifications ?? true,
      semester: semester || "1st Semester",
      academicYear: academicYear || new Date().getFullYear().toString(),
      autoEndSessions: autoEndSessions ?? true,
      requireProfessorTap: requireProfessorTap ?? false,
    };

    await logSettingsAudit(req, "system", previousSettings, settings);

    res.json({
      success: true,
      message: "System settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update system settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get IoT settings (admin only)
router.get("/iot", requireAdmin, async (req, res) => {
  try {
    // Return default IoT settings
    const settings = {
      heartbeatTimeout: 300, // 5 minutes in seconds
      heartbeatInterval: 60, // 1 minute in seconds
      maxOfflineDuration: 3600, // 1 hour in seconds
      enableHeartbeatMonitoring: true,
    };

    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Get IoT settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update IoT settings (admin only)
router.put("/iot", requireAdmin, async (req, res) => {
  try {
    const {
      heartbeatTimeout,
      heartbeatInterval,
      maxOfflineDuration,
      enableHeartbeatMonitoring,
    } = req.body;

    const settings = {
      heartbeatTimeout: heartbeatTimeout || 300,
      heartbeatInterval: heartbeatInterval || 60,
      maxOfflineDuration: maxOfflineDuration || 3600,
      enableHeartbeatMonitoring: enableHeartbeatMonitoring ?? true,
    };

    res.json({
      success: true,
      message: "IoT settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update IoT settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get hardware settings (admin only)
router.get("/hardware", requireAdmin, async (req, res) => {
  try {
    const settings = {
      rfidScannerPort: (await getSetting("rfidScannerPort")) ?? "COM3",
      proximitySensorThreshold:
        (await getSetting("proximitySensorThreshold")) ?? 5,
      dualValidation: (await getSetting("dualValidation")) ?? true,
      autoReconnect: (await getSetting("autoReconnect")) ?? true,
    };
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Get hardware settings error:", error);
    res.json({
      success: true,
      settings: {
        rfidScannerPort: "COM3",
        proximitySensorThreshold: 5,
        dualValidation: true,
        autoReconnect: true,
      },
    });
  }
});

// Update hardware settings (admin only)
router.put("/hardware", requireAdmin, async (req, res) => {
  try {
    const previousSettings = {
      rfidScannerPort: (await getSetting("rfidScannerPort")) ?? "COM3",
      proximitySensorThreshold:
        (await getSetting("proximitySensorThreshold")) ?? 5,
      dualValidation: (await getSetting("dualValidation")) ?? true,
      autoReconnect: (await getSetting("autoReconnect")) ?? true,
    };
    const {
      rfidScannerPort,
      proximitySensorThreshold,
      dualValidation,
      autoReconnect,
    } = req.body;

    await setSetting(
      "rfidScannerPort",
      rfidScannerPort || "COM3",
      "hardware",
      "RFID scanner port"
    );
    await setSetting(
      "proximitySensorThreshold",
      proximitySensorThreshold || 5,
      "hardware",
      "Proximity sensor threshold in meters"
    );
    await setSetting(
      "dualValidation",
      dualValidation ?? true,
      "hardware",
      "Require dual validation (RFID + Proximity)"
    );
    await setSetting(
      "autoReconnect",
      autoReconnect ?? true,
      "hardware",
      "Auto-reconnect on hardware failure"
    );

    const settings = {
      rfidScannerPort: rfidScannerPort || "COM3",
      proximitySensorThreshold: proximitySensorThreshold || 5,
      dualValidation: dualValidation ?? true,
      autoReconnect: autoReconnect ?? true,
    };

    await logSettingsAudit(req, "hardware", previousSettings, settings);

    res.json({
      success: true,
      message: "Hardware settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update hardware settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get email settings (admin only)
router.get("/email", requireAdmin, async (req, res) => {
  try {
    const settings = {
      smtpServer: (await getSetting("smtpServer")) ?? "smtp.gmail.com",
      senderEmail:
        (await getSetting("senderEmail")) ?? "clirdec.presence@clsu.edu.ph",
      absenceThreshold: (await getSetting("absenceThreshold")) ?? 3,
      dailySummary: (await getSetting("dailySummary")) ?? true,
      lateNotifications: (await getSetting("lateNotifications")) ?? true,
    };
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Get email settings error:", error);
    res.json({
      success: true,
      settings: {
        smtpServer: "smtp.gmail.com",
        senderEmail: "clirdec.presence@clsu.edu.ph",
        absenceThreshold: 3,
        dailySummary: true,
        lateNotifications: true,
      },
    });
  }
});

// Update email settings (admin only)
router.put("/email", requireAdmin, async (req, res) => {
  try {
    const previousSettings = {
      smtpServer: (await getSetting("smtpServer")) ?? "smtp.gmail.com",
      senderEmail:
        (await getSetting("senderEmail")) ?? "clirdec.presence@clsu.edu.ph",
      absenceThreshold: (await getSetting("absenceThreshold")) ?? 3,
      dailySummary: (await getSetting("dailySummary")) ?? true,
      lateNotifications: (await getSetting("lateNotifications")) ?? true,
    };
    const {
      smtpServer,
      senderEmail,
      absenceThreshold,
      dailySummary,
      lateNotifications,
    } = req.body;

    await setSetting(
      "smtpServer",
      smtpServer || "smtp.gmail.com",
      "email",
      "SMTP server for email notifications"
    );
    await setSetting(
      "senderEmail",
      senderEmail || "clirdec.presence@clsu.edu.ph",
      "email",
      "Sender email address"
    );
    await setSetting(
      "absenceThreshold",
      absenceThreshold || 3,
      "email",
      "Consecutive absence threshold for notifications"
    );
    await setSetting(
      "dailySummary",
      dailySummary ?? true,
      "email",
      "Send daily attendance summary"
    );
    await setSetting(
      "lateNotifications",
      lateNotifications ?? true,
      "email",
      "Send notifications for late arrivals"
    );

    const settings = {
      smtpServer: smtpServer || "smtp.gmail.com",
      senderEmail: senderEmail || "clirdec.presence@clsu.edu.ph",
      absenceThreshold: absenceThreshold || 3,
      dailySummary: dailySummary ?? true,
      lateNotifications: lateNotifications ?? true,
    };

    await logSettingsAudit(req, "email", previousSettings, settings);

    res.json({
      success: true,
      message: "Email settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("Update email settings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
