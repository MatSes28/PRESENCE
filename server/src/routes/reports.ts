import { Router } from "express";
import { db } from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
  subjects,
  classrooms,
  users,
} from "../../../shared/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

const router = Router();

// Get attendance report for a class session
router.get("/attendance/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const records = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.classSessionId, parseInt(sessionId)));
    res.json(records);
  } catch (error) {
    console.error("Error fetching attendance report:", error);
    res.status(500).json({ error: "Failed to fetch attendance report" });
  }
});

// Get student attendance summary
router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    let query = db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, parseInt(studentId)));

    if (startDate && endDate) {
      query = query.where(
        and(
          gte(attendanceRecords.createdAt, new Date(startDate as string)),
          lte(attendanceRecords.createdAt, new Date(endDate as string))
        )
      );
    }

    const records = await query;
    res.json(records);
  } catch (error) {
    console.error("Error fetching student report:", error);
    res.status(500).json({ error: "Failed to fetch student report" });
  }
});

// Get classroom utilization report
router.get("/classroom/:classroomId", async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { startDate, endDate } = req.query;

    let query = db
      .select()
      .from(classSessions)
      .where(eq(classSessions.scheduleId, parseInt(classroomId)));

    if (startDate && endDate) {
      query = query.where(
        and(
          gte(classSessions.date, new Date(startDate as string)),
          lte(classSessions.date, new Date(endDate as string))
        )
      );
    }

    const sessions = await query;
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching classroom report:", error);
    res.status(500).json({ error: "Failed to fetch classroom report" });
  }
});

export default router;
