import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import db from "../storage.js";
import {
  users,
  schedules,
  classSessions,
  attendanceRecords,
  computerAssignments,
  emailNotifications,
  subjectSessions,
  sessionAssignments,
  computerMaintenance,
  pushNotifications,
  userSessions,
  pushSubscriptions,
  errorLogs,
  parentConsentRequests,
  dataSubjectRequests,
  legalHolds,
  auditLogs,
  auditLogsArchive,
  reportHistory,
  reportPresets,
  reportSchedules,
} from "../schema.js";
import { requireAdmin } from "../middleware/auth.js";
import { dbClient } from "../storage.js";

const router = Router();

const toSafeUser = (user: any) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const isMissingTableError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return message.includes("no such table") || message.includes("does not exist");
};

const runIfTableExists = async (operation: () => Promise<void>) => {
  try {
    await operation();
  } catch (error) {
    if (isMissingTableError(error)) {
      return;
    }

    throw error;
  }
};

const isSqliteRuntime =
  !!dbClient &&
  typeof dbClient.prepare === "function" &&
  typeof dbClient.exec === "function";

const deleteUserAssociations = async (executor: typeof db, userId: number) => {
  const ownedSchedules = await executor
    .select({ id: schedules.id })
    .from(schedules)
    .where(eq(schedules.facultyId, userId));
  const scheduleIds = ownedSchedules.map((row) => row.id);

  if (scheduleIds.length > 0) {
    const ownedClassSessions = await executor
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(inArray(classSessions.scheduleId, scheduleIds));
    const classSessionIds = ownedClassSessions.map((row) => row.id);

    if (classSessionIds.length > 0) {
      await executor
        .delete(emailNotifications)
        .where(inArray(emailNotifications.classSessionId, classSessionIds));
      await executor
        .delete(computerAssignments)
        .where(inArray(computerAssignments.classSessionId, classSessionIds));
      await executor
        .delete(attendanceRecords)
        .where(inArray(attendanceRecords.classSessionId, classSessionIds));
      await executor
        .delete(classSessions)
        .where(inArray(classSessions.id, classSessionIds));
    }

    await executor.delete(schedules).where(inArray(schedules.id, scheduleIds));
  }

  await runIfTableExists(async () => {
    const ownedSubjectSessions = await executor
      .select({ id: subjectSessions.id })
      .from(subjectSessions)
      .where(eq(subjectSessions.facultyId, userId));
    const subjectSessionIds = ownedSubjectSessions.map((row) => row.id);

    if (subjectSessionIds.length > 0) {
      await executor
        .delete(sessionAssignments)
        .where(inArray(sessionAssignments.sessionId, subjectSessionIds));
      await executor
        .delete(subjectSessions)
        .where(inArray(subjectSessions.id, subjectSessionIds));
    }
  });

  await runIfTableExists(async () => {
    await executor
      .delete(computerMaintenance)
      .where(eq(computerMaintenance.performedBy, userId));
  });
  await runIfTableExists(async () => {
    await executor
      .delete(pushNotifications)
      .where(eq(pushNotifications.userId, userId));
  });
  await runIfTableExists(async () => {
    await executor.delete(userSessions).where(eq(userSessions.userId, userId));
  });
  await runIfTableExists(async () => {
    await executor
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  });

  await executor
    .update(errorLogs)
    .set({ userId: null })
    .where(eq(errorLogs.userId, userId));
  await executor
    .update(errorLogs)
    .set({ resolvedBy: null })
    .where(eq(errorLogs.resolvedBy, userId));
  await executor
    .update(parentConsentRequests)
    .set({ requestedBy: null })
    .where(eq(parentConsentRequests.requestedBy, userId));
  await executor
    .update(dataSubjectRequests)
    .set({ reviewedBy: null })
    .where(eq(dataSubjectRequests.reviewedBy, userId));

  await executor
    .delete(dataSubjectRequests)
    .where(eq(dataSubjectRequests.requestedBy, userId));
  await executor.delete(legalHolds).where(eq(legalHolds.createdBy, userId));

  await executor
    .update(auditLogs)
    .set({ userId: null })
    .where(eq(auditLogs.userId, userId));
  await executor
    .update(auditLogsArchive)
    .set({ userId: null })
    .where(eq(auditLogsArchive.userId, userId));
  await executor
    .update(reportHistory)
    .set({ generatedBy: null })
    .where(eq(reportHistory.generatedBy, userId));
  await executor
    .update(reportPresets)
    .set({ createdBy: null })
    .where(eq(reportPresets.createdBy, userId));
  await executor
    .update(reportSchedules)
    .set({ createdBy: null })
    .where(eq(reportSchedules.createdBy, userId));
};

// GET /api/users - Get all users (admin only)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json({ success: true, data: allUsers.map(toSafeUser) });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// GET /api/users/:id - Get user by ID (admin only)
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: toSafeUser(user[0]) });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
});

// POST /api/users - Create new user (admin only)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { email, name, role, password, facultyId, department, gender } =
      req.body;

    if (!email || !name || !role || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (!["admin", "faculty"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.default.hash(password, 12);

    const newUser = await db
      .insert(users)
      .values({
        email,
        name,
        role,
        password: hashedPassword,
        facultyId,
        department,
        gender,
      })
      .returning();

    // Remove password from response
    res.status(201).json({ success: true, data: toSafeUser(newUser[0]) });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

// PUT /api/users/:id - Update user (admin only)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { email, name, role, facultyId, department, gender } = req.body;

    if (!email || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, name, and role are required",
      });
    }

    if (!["admin", "faculty"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (existingUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if email is already taken by another user
    const emailCheck = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (emailCheck.length > 0 && emailCheck[0].id !== userId) {
      return res
        .status(409)
        .json({ success: false, message: "Email already taken" });
    }

    const updatedUser = await db
      .update(users)
      .set({
        email,
        name,
        role,
        facultyId,
        department,
        gender,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Remove password from response
    res.json({ success: true, data: toSafeUser(updatedUser[0]) });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting the current user
    if (req.session?.userId === userId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot delete your own account" });
    }

    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (existingUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (isSqliteRuntime) {
      await deleteUserAssociations(db, userId);
      await db.delete(users).where(eq(users.id, userId));
    } else {
      await db.transaction(async (tx) => {
        await deleteUserAssociations(tx as typeof db, userId);
        await tx.delete(users).where(eq(users.id, userId));
      });
    }

    res.json({ success: true, message: "User deleted permanently" });
  } catch (error: any) {
    console.error("Error deleting user:", error);

    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

export default router;
