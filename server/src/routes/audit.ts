import { Router } from "express";
import { db } from "../storage.js";
import { auditLogs, users } from "../schema.js";
import { eq, desc, and, gte, lte, lt, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Get all audit logs (admin only)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      userId,
      action,
      startDate,
      endDate,
    } = req.query;

    const conditions = [];

    if (userId) {
      conditions.push(eq(auditLogs.userId, parseInt(userId as string)));
    }

    if (action) {
      conditions.push(eq(auditLogs.action, action as string));
    }

    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, new Date(endDate as string)));
    }

    const auditEntries = await db
      .select({
        auditLog: auditLogs,
        user: users,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.timestamp))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      auditLogs: auditEntries,
    });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get audit logs for current user (faculty can see their own logs)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    const { limit = 20, offset = 0 } = req.query;

    const auditEntries = await db
      .select({
        auditLog: auditLogs,
        user: users,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      auditLogs: auditEntries,
    });
  } catch (error) {
    console.error("Get user audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get audit log statistics (admin only)
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let baseCondition = undefined;
    if (startDate && endDate) {
      baseCondition = and(
        gte(auditLogs.timestamp, new Date(startDate as string)),
        lte(auditLogs.timestamp, new Date(endDate as string))
      );
    } else if (startDate) {
      baseCondition = gte(auditLogs.timestamp, new Date(startDate as string));
    } else if (endDate) {
      baseCondition = lte(auditLogs.timestamp, new Date(endDate as string));
    }

    // Get action counts
    const actionStats = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(baseCondition)
      .groupBy(auditLogs.action);

    // Get user activity counts
    const userStats = await db
      .select({
        userId: auditLogs.userId,
        user: users,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(baseCondition)
      .groupBy(
        auditLogs.userId,
        users.id,
        users.email,
        users.firstName,
        users.lastName
      )
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    // Get recent activity
    const recentActivity = await db
      .select({
        auditLog: auditLogs,
        user: users,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(baseCondition)
      .orderBy(desc(auditLogs.timestamp))
      .limit(50);

    res.json({
      success: true,
      stats: {
        byAction: actionStats,
        byUser: userStats,
        recentActivity,
        totalLogs: actionStats.reduce((sum, stat) => sum + stat.count, 0),
      },
    });
  } catch (error) {
    console.error("Get audit stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Create audit log entry (internal use - called by other routes)
export const logAuditEvent = async (
  userId: number | null,
  action: string,
  details?: any
) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // Don't throw error to avoid breaking the main operation
  }
};

// Manual audit log creation (admin only)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { userId, action, details } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "Action is required",
      });
    }

    const [auditEntry] = await db
      .insert(auditLogs)
      .values({
        userId: userId || null,
        action,
        details,
        timestamp: new Date(),
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Audit log created successfully",
      auditLog: auditEntry,
    });
  } catch (error) {
    console.error("Create audit log error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Clean up old audit logs (admin only)
router.delete("/cleanup", requireAdmin, async (req, res) => {
  try {
    const { daysOld = 365 } = req.body; // Default to 1 year

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld as string));

    const deletedLogs = await db
      .delete(auditLogs)
      .where(lt(auditLogs.timestamp, cutoffDate))
      .returning();

    res.json({
      success: true,
      message: `Deleted ${deletedLogs.length} old audit logs`,
      deletedCount: deletedLogs.length,
    });
  } catch (error) {
    console.error("Cleanup audit logs error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
