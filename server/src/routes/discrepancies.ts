import { Router } from "express";
import db from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
  subjects,
  classrooms,
  users,
} from "../schema.js";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
  requireAdminOrFaculty,
} from "../middleware/auth.js";
import { auditService } from "../services/auditService.js";

const router = Router();

// All discrepancy workflows require authentication.
router.use(requireAuth);

function parseDateOrUndefined(v: unknown): Date | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

/**
 * GET /api/discrepancies
 * List discrepancy attendance records.
 */
router.get("/", requireAdminOrFaculty, async (req: any, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? "50")));
    const offset = Math.max(0, parseInt(req.query.offset ?? "0"));

    const startDate = parseDateOrUndefined(req.query.startDate);
    const endDate = parseDateOrUndefined(req.query.endDate);
    const status =
      typeof req.query.status === "string" ? req.query.status : "open";

    const conditions: any[] = [];

    // Only discrepancy-flagged records
    if (status === "open") {
      conditions.push(eq(attendanceRecords.discrepancyFlag, true));
    } else if (status === "resolved") {
      conditions.push(eq(attendanceRecords.discrepancyFlag, false));
    } else {
      // all
      conditions.push(sql`1=1`);
    }

    // Time range based on record createdAt (server truth)
    if (startDate) conditions.push(gte(attendanceRecords.createdAt, startDate));
    if (endDate) conditions.push(lte(attendanceRecords.createdAt, endDate));

    // Governance:
    // - admins can see all
    // - faculty can only see records for sessions they own
    const isFaculty = req.session?.userRole === "faculty";
    if (isFaculty) {
      const facultyId = req.session?.userId;
      conditions.push(eq(schedules.facultyId, facultyId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select({
        record: attendanceRecords,
        student: {
          id: students.id,
          studentId: students.studentId,
          name: students.name,
          email: students.email,
        },
        session: {
          id: classSessions.id,
          date: classSessions.date,
          status: classSessions.status,
        },
        schedule: {
          id: schedules.id,
          dayOfWeek: schedules.dayOfWeek,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
          semester: schedules.semester,
          academicYear: schedules.academicYear,
        },
        subject: {
          id: subjects.id,
          code: subjects.code,
          name: subjects.name,
        },
        classroom: {
          id: classrooms.id,
          name: classrooms.name,
          location: classrooms.location,
        },
        faculty: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(attendanceRecords)
      .leftJoin(students, eq(attendanceRecords.studentId, students.id))
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(whereClause)
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      data: rows,
      pagination: { limit, offset },
    });
  } catch (error: any) {
    console.error("List discrepancies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load discrepancies",
      error: error?.message || String(error),
    });
  }
});

/**
 * GET /api/discrepancies/:recordId/evidence
 * Returns evidence signals to help resolve discrepancies:
 * - nearest RFID_SCAN audit event (metadata includes deviceId, rfidUid, studentId)
 * - nearest SENSOR_TRIGGER for the same device in the same window
 */
router.get(
  "/:recordId/evidence",
  requireAdminOrFaculty,
  async (req: any, res) => {
    try {
      const recordId = parseInt(req.params.recordId);
      if (!Number.isFinite(recordId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid recordId" });
      }

      const recordRows = await db
        .select({
          record: attendanceRecords,
          student: students,
          session: classSessions,
          schedule: schedules,
        })
        .from(attendanceRecords)
        .leftJoin(students, eq(attendanceRecords.studentId, students.id))
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(eq(attendanceRecords.id, recordId))
        .limit(1);

      if (!recordRows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Attendance record not found" });
      }

      const row = recordRows[0] as any;
      const record = row.record;
      const student = row.student || null;

      // Governance: faculty can only access their own sessions.
      const isFaculty = req.session?.userRole === "faculty";
      if (isFaculty && row.schedule?.facultyId !== req.session?.userId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const center = (record.entryTime ||
        record.createdAt ||
        new Date()) as Date;
      const startDate = new Date(new Date(center).getTime() - 2 * 60 * 1000);
      const endDate = new Date(new Date(center).getTime() + 2 * 60 * 1000);

      const rfidEvents = await auditService.queryEvents({
        action: "RFID_SCAN",
        startDate,
        endDate,
        limit: 500,
        offset: 0,
      });

      const rfidCandidates = student
        ? rfidEvents.filter((e: any) => e?.metadata?.studentId === student.id)
        : rfidEvents;

      const nearestRfid =
        rfidCandidates
          .slice()
          .sort(
            (a: any, b: any) =>
              Math.abs(
                new Date(a.timestamp).getTime() - new Date(center).getTime(),
              ) -
              Math.abs(
                new Date(b.timestamp).getTime() - new Date(center).getTime(),
              ),
          )[0] || null;
      const deviceId = nearestRfid?.metadata?.deviceId as string | undefined;

      let sensorEvents: any[] = [];
      if (deviceId) {
        const allSensor = await auditService.queryEvents({
          action: "SENSOR_TRIGGER",
          startDate,
          endDate,
          limit: 500,
          offset: 0,
        });
        sensorEvents = allSensor.filter(
          (e: any) => e?.metadata?.deviceId === deviceId,
        );
      }

      res.json({
        success: true,
        data: {
          record,
          student,
          window: { startDate, endDate },
          nearestRfid,
          sensorEvents,
          deviceId: deviceId || null,
        },
      });
    } catch (error: any) {
      console.error("Discrepancy evidence error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load evidence",
        error: error?.message || String(error),
      });
    }
  },
);

/**
 * POST /api/discrepancies/bulk-resolve
 * Bulk resolve discrepancy records.
 */
router.post("/bulk-resolve", requireAdmin, async (req: any, res) => {
  try {
    const { recordIds, resolution, reason } = req.body as {
      recordIds: number[];
      resolution: "validate" | "excuse";
      reason?: string;
    };

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "recordIds is required" });
    }

    const ids = recordIds
      .map((n) => parseInt(String(n)))
      .filter((n) => Number.isFinite(n));
    if (ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No valid recordIds" });
    }

    if (resolution === "validate") {
      await db
        .update(attendanceRecords)
        .set({
          isValid: true,
          discrepancyFlag: false,
          notes: reason
            ? `Manually validated: ${reason}`
            : "Manually validated",
          updatedAt: new Date(),
        })
        .where(sql`${attendanceRecords.id} IN (${ids.join(",")})`);
    } else if (resolution === "excuse") {
      await db
        .update(attendanceRecords)
        .set({
          status: "excused",
          discrepancyFlag: false,
          notes: reason ? `Excused: ${reason}` : "Excused",
          updatedAt: new Date(),
        })
        .where(sql`${attendanceRecords.id} IN (${ids.join(",")})`);
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid resolution" });
    }

    // Best-effort audit
    await auditService.logEvent({
      userId: req.session?.userId ?? null,
      action: "DISCREPANCY_BULK_RESOLVE",
      resource: "attendance_record",
      resourceId: ids.join(","),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
      sessionId: req.sessionID,
      success: true,
      metadata: { resolution, count: ids.length },
    } as any);

    res.json({
      success: true,
      message: `Resolved ${ids.length} records`,
    });
  } catch (error: any) {
    console.error("Bulk resolve error:", error);
    res.status(500).json({ success: false, message: "Bulk resolve failed" });
  }
});

export default router;
