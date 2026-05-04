import { Router } from "express";
import { eq, inArray, sql } from "drizzle-orm";
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

const isSkippableCleanupError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  return (
    message.includes("no such table") ||
    message.includes("does not exist") ||
    message.includes("column") && message.includes("does not exist") ||
    code === "42P01" || // postgres undefined_table
    code === "42703" || // postgres undefined_column
    code === "42883" || // postgres operator does not exist
    code === "42804" // postgres datatype mismatch
  );
};

const runOptionalCleanup = async (
  label: string,
  operation: () => Promise<void>,
) => {
  try {
    await operation();
  } catch (error) {
    if (isSkippableCleanupError(error)) {
      console.warn(`Skipping optional user cleanup step: ${label}`, {
        message: error instanceof Error ? error.message : String(error),
        code:
          error && typeof error === "object" && "code" in error
            ? (error as { code?: unknown }).code
            : undefined,
      });
      return;
    }

    throw error;
  }
};

const isSqliteRuntime =
  !!dbClient &&
  typeof dbClient.prepare === "function" &&
  typeof dbClient.exec === "function";

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const toSqlUserIdLiteral = (columnType: string, userId: number) => {
  const normalizedType = columnType.toLowerCase();
  if (
    normalizedType.includes("char") ||
    normalizedType.includes("text") ||
    normalizedType.includes("uuid")
  ) {
    return `'${String(userId).replace(/'/g, "''")}'`;
  }

  return String(userId);
};

const cleanupRemainingUserReferences = async (
  executor: typeof db,
  userId: number,
) => {
  if (isSqliteRuntime) {
    return;
  }

  const references = (await (executor as any).execute(sql.raw(`
    SELECT
      tc.table_name,
      kcu.column_name,
      cols.is_nullable,
      rc.delete_rule,
      cols.data_type
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
     AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.columns cols
      ON cols.table_schema = tc.table_schema
     AND cols.table_name = tc.table_name
     AND cols.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
  `))) as Array<{
    table_name: string;
    column_name: string;
    is_nullable: "YES" | "NO";
    delete_rule: string;
    data_type: string;
  }>;

  for (const reference of references) {
    const tableName = reference.table_name;
    const columnName = reference.column_name;
    const deleteRule = String(reference.delete_rule || "").toUpperCase();
    const isNullable = reference.is_nullable === "YES";
    const userIdLiteral = toSqlUserIdLiteral(reference.data_type, userId);

    // Already handled or safe to let the FK do the work.
    if (deleteRule === "CASCADE" || deleteRule === "SET NULL") {
      continue;
    }

    const qualifiedTable = `${quoteIdentifier("public")}.${quoteIdentifier(tableName)}`;
    const qualifiedColumn = quoteIdentifier(columnName);

    await runOptionalCleanup(`dynamic_fk_cleanup:${tableName}.${columnName}`, async () => {
      if (isNullable) {
        await (executor as any).execute(
          sql.raw(
            `UPDATE ${qualifiedTable} SET ${qualifiedColumn} = NULL WHERE ${qualifiedColumn} = ${userIdLiteral}`,
          ),
        );
      } else {
        await (executor as any).execute(
          sql.raw(
            `DELETE FROM ${qualifiedTable} WHERE ${qualifiedColumn} = ${userIdLiteral}`,
          ),
        );
      }
    });
  }
};

const getForeignKeyConstraintTarget = async (
  executor: typeof db,
  constraintName: string,
) => {
  const escapedConstraintName = constraintName.replace(/'/g, "''");
  const rows = (await (executor as any).execute(
    sql.raw(`
      SELECT
        child_ns.nspname AS schema_name,
        child_tbl.relname AS table_name,
        child_att.attname AS column_name,
        NOT child_att.attnotnull AS is_nullable,
        format_type(child_att.atttypid, child_att.atttypmod) AS data_type
      FROM pg_constraint con
      JOIN pg_class child_tbl
        ON child_tbl.oid = con.conrelid
      JOIN pg_namespace child_ns
        ON child_ns.oid = child_tbl.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
        ON TRUE
      JOIN pg_attribute child_att
        ON child_att.attrelid = con.conrelid
       AND child_att.attnum = cols.attnum
      WHERE con.contype = 'f'
        AND con.conname = '${escapedConstraintName}'
        AND con.confrelid = 'public.users'::regclass
      ORDER BY cols.ord
    `),
  )) as Array<{
    schema_name: string;
    table_name: string;
    column_name: string;
    is_nullable: boolean;
    data_type: string;
  }>;

  if (rows.length !== 1) {
    return null;
  }

  return rows[0];
};

const deleteUserWithConstraintRecovery = async (
  executor: typeof db,
  userId: number,
) => {
  const MAX_DELETE_RETRIES = 10;

  for (let attempt = 0; attempt < MAX_DELETE_RETRIES; attempt += 1) {
    try {
      await executor.delete(users).where(eq(users.id, userId));
      return;
    } catch (error: any) {
      if (error?.code !== "23503" || !error?.constraint || isSqliteRuntime) {
        throw error;
      }

      const target = await getForeignKeyConstraintTarget(
        executor,
        String(error.constraint),
      );

      if (!target) {
        throw error;
      }

      const qualifiedTable = `${quoteIdentifier(target.schema_name)}.${quoteIdentifier(target.table_name)}`;
      const qualifiedColumn = quoteIdentifier(target.column_name);
      const userIdLiteral = toSqlUserIdLiteral(target.data_type, userId);

      console.warn("Recovering from user delete FK constraint", {
        constraint: error.constraint,
        table: target.table_name,
        column: target.column_name,
        nullable: target.is_nullable,
      });

      if (target.is_nullable) {
        await (executor as any).execute(
          sql.raw(
            `UPDATE ${qualifiedTable} SET ${qualifiedColumn} = NULL WHERE ${qualifiedColumn} = ${userIdLiteral}`,
          ),
        );
      } else {
        await (executor as any).execute(
          sql.raw(
            `DELETE FROM ${qualifiedTable} WHERE ${qualifiedColumn} = ${userIdLiteral}`,
          ),
        );
      }
    }
  }

  throw new Error("Failed to delete user after foreign key recovery attempts");
};

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

  await runOptionalCleanup("subject_sessions", async () => {
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

  await runOptionalCleanup("computer_maintenance", async () => {
    await executor
      .delete(computerMaintenance)
      .where(eq(computerMaintenance.performedBy, userId));
  });
  await runOptionalCleanup("push_notifications", async () => {
    await executor
      .delete(pushNotifications)
      .where(eq(pushNotifications.userId, userId));
  });
  await runOptionalCleanup("user_sessions", async () => {
    await executor.delete(userSessions).where(eq(userSessions.userId, userId));
  });
  await runOptionalCleanup("push_subscriptions", async () => {
    await executor
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  });

  await runOptionalCleanup("error_logs.user_id", async () => {
    await executor
      .update(errorLogs)
      .set({ userId: null })
      .where(eq(errorLogs.userId, userId));
  });
  await runOptionalCleanup("error_logs.resolved_by", async () => {
    await executor
      .update(errorLogs)
      .set({ resolvedBy: null })
      .where(eq(errorLogs.resolvedBy, userId));
  });
  await runOptionalCleanup("parent_consent_requests", async () => {
    await executor
      .update(parentConsentRequests)
      .set({ requestedBy: null })
      .where(eq(parentConsentRequests.requestedBy, userId));
  });
  await runOptionalCleanup("data_subject_requests.reviewed_by", async () => {
    await executor
      .update(dataSubjectRequests)
      .set({ reviewedBy: null })
      .where(eq(dataSubjectRequests.reviewedBy, userId));
  });

  await runOptionalCleanup("data_subject_requests.requested_by", async () => {
    await executor
      .delete(dataSubjectRequests)
      .where(eq(dataSubjectRequests.requestedBy, userId));
  });
  await runOptionalCleanup("legal_holds", async () => {
    await executor.delete(legalHolds).where(eq(legalHolds.createdBy, userId));
  });

  await runOptionalCleanup("audit_logs.user_id", async () => {
    await executor
      .update(auditLogs)
      .set({ userId: null })
      .where(eq(auditLogs.userId, userId));
  });
  await runOptionalCleanup("audit_logs_archive", async () => {
    await executor
      .update(auditLogsArchive)
      .set({ userId: null })
      .where(eq(auditLogsArchive.userId, userId));
  });
  await runOptionalCleanup("report_history", async () => {
    await executor
      .update(reportHistory)
      .set({ generatedBy: null })
      .where(eq(reportHistory.generatedBy, userId));
  });
  await runOptionalCleanup("report_presets", async () => {
    await executor
      .update(reportPresets)
      .set({ createdBy: null })
      .where(eq(reportPresets.createdBy, userId));
  });
  await runOptionalCleanup("report_schedules", async () => {
    await executor
      .update(reportSchedules)
      .set({ createdBy: null })
      .where(eq(reportSchedules.createdBy, userId));
  });

  await cleanupRemainingUserReferences(executor, userId);
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
      await deleteUserWithConstraintRecovery(db, userId);
    } else {
      await db.transaction(async (tx) => {
        await deleteUserAssociations(tx as typeof db, userId);
        await deleteUserWithConstraintRecovery(tx as typeof db, userId);
      });
    }

    res.json({ success: true, message: "User deleted permanently" });
  } catch (error: any) {
    console.error("Error deleting user:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      table: error?.table,
      constraint: error?.constraint,
      column: error?.column,
      where: error?.where,
      stack: error?.stack,
    });

    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

export default router;
