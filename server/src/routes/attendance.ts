import { Router } from "express";
import db from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
  classrooms,
  subjects,
  users,
} from "../schema.js";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { attendanceMonitor } from "../services/attendanceMonitor.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { handleRouteError } from "../middleware/errorLogging.js";

const router = Router();

// Get attendance records with filters (faculty see only their sessions' records)
router.get("/", requireAuth, async (req, res) => {
  try {
    const {
      studentId,
      classSessionId,
      date,
      limit = 50,
      offset = 0,
    } = req.query;

    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    let whereConditions = [];

    if (userRole === "faculty") {
      const facultySessionIds = await db
        .select({ id: classSessions.id })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(eq(schedules.facultyId, userId!));
      const ids = facultySessionIds.map((r) => r.id);
      if (ids.length === 0) {
        return res.json({
          success: true,
          records: [],
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        });
      }
      whereConditions.push(inArray(attendanceRecords.classSessionId, ids));
    }

    if (studentId) {
      whereConditions.push(
        eq(attendanceRecords.studentId, parseInt(studentId as string))
      );
    }

    if (classSessionId) {
      whereConditions.push(
        eq(attendanceRecords.classSessionId, parseInt(classSessionId as string))
      );
    }

    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const sessions = await db
        .select()
        .from(classSessions)
        .where(
          and(
            gte(classSessions.date, startDate),
            lte(classSessions.date, endDate)
          )
        );

      if (sessions.length > 0) {
        whereConditions.push(
          inArray(
            attendanceRecords.classSessionId,
            sessions.map((s) => s.id)
          )
        );
      }
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const records = await db
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
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(whereClause)
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      records,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    await handleRouteError(error as Error, req, res, "get_attendance_records");
  }
});

// Get attendance statistics for a session (faculty only for their sessions)
router.get("/stats/:sessionId", requireAuth, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    if (userRole === "faculty") {
      const sessionCheck = await db
        .select({ facultyId: schedules.facultyId })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(eq(classSessions.id, sessionId))
        .limit(1);

      if (
        sessionCheck.length === 0 ||
        sessionCheck[0].facultyId !== userId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You do not have access to this session's attendance",
        });
      }
    }

    const stats = await attendanceMonitor.getAttendanceStats(sessionId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    await handleRouteError(error as Error, req, res, "get_attendance_stats");
  }
});

// Manual attendance entry (transactional; enforces one record per student per session)
router.post("/manual", requireAuth, async (req, res) => {
  try {
    const { studentId, classSessionId, entryTime, exitTime, notes } = req.body;

    if (!studentId || !classSessionId) {
      return res.status(400).json({
        success: false,
        message: "Student ID and Class Session ID are required",
      });
    }

    const newRecord = await db.transaction(async (tx) => {
      const existingRecord = await tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, studentId),
            eq(attendanceRecords.classSessionId, classSessionId)
          )
        )
        .limit(1);

      if (existingRecord.length > 0) {
        return null;
      }

      const [inserted] = await tx
        .insert(attendanceRecords)
        .values({
          studentId,
          classSessionId,
          entryTime: entryTime ? new Date(entryTime) : null,
          exitTime: exitTime ? new Date(exitTime) : null,
          status: "present",
          rfidDetected: false,
          sensorDetected: false,
          isValid: true,
          discrepancyFlag: false,
          notes: notes || "Manually entered",
        })
        .returning();

      return inserted;
    });

    if (!newRecord) {
      return res.status(409).json({
        success: false,
        message:
          "Attendance record already exists for this student and session",
      });
    }

    res.status(201).json({
      success: true,
      message: "Attendance record created successfully",
      record: newRecord,
    });
  } catch (error: any) {
    const code = error?.code ?? error?.cause?.code;
    if (code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Attendance record already exists for this student and session",
      });
    }
    await handleRouteError(error as Error, req, res, "manual_attendance_entry");
  }
});

// Update attendance record
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const { entryTime, exitTime, isValid, notes } = req.body;

    const [updatedRecord] = await db
      .update(attendanceRecords)
      .set({
        entryTime: entryTime ? new Date(entryTime) : undefined,
        exitTime: exitTime ? new Date(exitTime) : undefined,
        isValid,
        discrepancyFlag: !isValid,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, recordId))
      .returning();

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record updated successfully",
      record: updatedRecord,
    });
  } catch (error) {
    console.error("Update attendance record error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Delete attendance record
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);

    const deletedRecord = await db
      .delete(attendanceRecords)
      .where(eq(attendanceRecords.id, recordId))
      .returning();

    if (deletedRecord.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Delete attendance record error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get current active sessions
router.get("/sessions/active", requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // Find sessions that are currently active (within reasonable time window)
    const activeSessions = await db
      .select({
        session: classSessions,
        schedule: {
          id: schedules.id,
          subject: subjects.name,
          classroom: classrooms.name,
          faculty: users.name,
        },
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(
        and(
          eq(classSessions.status, "active"),
          gte(classSessions.date, new Date(now.getTime() - 2 * 60 * 60 * 1000)), // Within last 2 hours
          lte(classSessions.date, new Date(now.getTime() + 2 * 60 * 60 * 1000)) // Within next 2 hours
        )
      )
      .orderBy(classSessions.date);

    res.json({
      success: true,
      sessions: activeSessions,
    });
  } catch (error) {
    console.error("Get active sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Validate suspicious attendance record
router.post("/:id/validate", requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);

    await attendanceMonitor.validateAttendanceRecord(recordId);

    res.json({
      success: true,
      message: "Attendance record validated successfully",
    });
  } catch (error) {
    console.error("Validate attendance record error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Simulate RFID tap for testing
router.post("/simulate-rfid", requireAuth, async (req, res) => {
  try {
    const { rfidUid } = req.body;

    if (!rfidUid) {
      return res.status(400).json({
        success: false,
        message: "RFID UID is required",
      });
    }

    // Process the simulated RFID scan
    const result = await attendanceMonitor.processRFIDScan({
      deviceId: "simulator",
      rfidUid,
      timestamp: new Date().toISOString(),
    });

    if (result.success) {
      res.json({
        success: true,
        message: "RFID simulation successful",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "RFID simulation failed",
      });
    }
  } catch (error) {
    console.error("RFID simulation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Simulate sensor trigger for testing (faculty or admin)
router.post("/simulate-sensor", requireAuth, async (req, res) => {
  try {
    const { sensorType, distance = 50 } = req.body;

    if (!sensorType || !["entry", "exit"].includes(sensorType)) {
      return res.status(400).json({
        success: false,
        message: "Valid sensor type (entry/exit) is required",
      });
    }

    // Process the sensor trigger using the attendance monitor
    const result = await attendanceMonitor.processSensorTrigger({
      deviceId: "simulator",
      sensorType,
      distance,
      timestamp: new Date().toISOString(),
    });

    if (result.success) {
      res.json({
        success: true,
        message: "Sensor simulation successful",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "Sensor simulation failed",
      });
    }
  } catch (error) {
    console.error("Simulate sensor error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Excuse attendance record (faculty or admin)
router.post("/:id/excuse", requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const { reason } = req.body;

    const [updatedRecord] = await db
      .update(attendanceRecords)
      .set({
        status: "excused",
        notes: reason ? `Excused: ${reason}` : "Excused by administrator",
        updatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, recordId))
      .returning();

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record excused successfully",
      record: updatedRecord,
    });
  } catch (error) {
    console.error("Excuse attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Contact parent (faculty or admin)
router.post("/:studentId/contact", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const { message } = req.body;

    // Get student details
    const student = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student.length) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const studentData = student[0];

    // Here you would integrate with email service
    // For now, we'll just log it
    console.log(`Contacting parent of ${studentData.name}: ${message}`);

    // TODO: Integrate with email service to send actual notification

    res.json({
      success: true,
      message: "Parent contacted successfully",
    });
  } catch (error) {
    console.error("Contact parent error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
