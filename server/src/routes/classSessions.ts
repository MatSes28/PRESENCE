import { Router } from "express";
import db from "../storage.js";
import {
  classSessions,
  schedules,
  subjects,
  classrooms,
  users,
} from "../schema.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Get all class sessions (faculty see only their own)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    const baseConditions = [];
    if (userRole === "faculty") {
      baseConditions.push(eq(schedules.facultyId, userId!));
    }

    const sessions = await db
      .select({
        session: classSessions,
        schedule: {
          id: schedules.id,
          subjectId: schedules.subjectId,
          subject: subjects.name,
          classroom: classrooms.name,
          faculty: users.name,
          dayOfWeek: schedules.dayOfWeek,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
        },
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(
        baseConditions.length > 0 ? and(...baseConditions) : undefined
      )
      .orderBy(desc(classSessions.date));

    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("Get class sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get session by ID (faculty can only access their own sessions)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    const session = await db
      .select({
        session: classSessions,
        schedule: {
          id: schedules.id,
          facultyId: schedules.facultyId,
          subject: subjects.name,
          classroom: classrooms.name,
          faculty: users.name,
          dayOfWeek: schedules.dayOfWeek,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
        },
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(eq(classSessions.id, sessionId))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Class session not found",
      });
    }

    if (userRole === "faculty" && session[0].schedule.facultyId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You do not have access to this class session",
      });
    }

    res.json({
      success: true,
      session: session[0],
    });
  } catch (error) {
    console.error("Get class session error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Auto-create sessions based on schedule (called by cron job or manually)
router.post("/auto-create", requireAuth, async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Find all schedules for this day
    const daySchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.dayOfWeek, dayOfWeek));

    const createdSessions = [];

    for (const schedule of daySchedules) {
      // Check if session already exists for this schedule and date
      const existingSession = await db
        .select()
        .from(classSessions)
        .where(
          and(
            eq(classSessions.scheduleId, schedule.id),
            gte(classSessions.date, new Date(targetDate.getTime())),
            lte(
              classSessions.date,
              new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
            )
          )
        )
        .limit(1);

      if (existingSession.length === 0) {
        // Create new session
        const [newSession] = await db
          .insert(classSessions)
          .values({
            scheduleId: schedule.id,
            date: targetDate,
            status: "scheduled", // Will be activated automatically at start time
          })
          .returning();

        createdSessions.push(newSession);
      }
    }

    res.json({
      success: true,
      message: `Created ${createdSessions.length} class sessions`,
      sessions: createdSessions,
    });
  } catch (error) {
    console.error("Auto-create sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Auto-activate sessions based on schedule time
router.post("/auto-activate", requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // Find sessions that should be active now
    const sessionsToActivate = await db
      .select({
        session: classSessions,
        schedule: schedules,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          eq(classSessions.status, "scheduled"),
          // Session date matches today
          gte(
            classSessions.date,
            new Date(now.getFullYear(), now.getMonth(), now.getDate())
          ),
          lte(
            classSessions.date,
            new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          ),
          // Current time is within session time window
          lte(schedules.startTime, now.toTimeString().slice(0, 8)),
          gte(schedules.endTime, now.toTimeString().slice(0, 8))
        )
      );

    const activatedSessions = [];

    for (const { session } of sessionsToActivate) {
      await db
        .update(classSessions)
        .set({ status: "active" })
        .where(eq(classSessions.id, session.id));

      activatedSessions.push(session);
    }

    res.json({
      success: true,
      message: `Activated ${activatedSessions.length} class sessions`,
      sessions: activatedSessions,
    });
  } catch (error) {
    console.error("Auto-activate sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Auto-end sessions when time expires
router.post("/auto-end", requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // Find active sessions that have ended
    const sessionsToEnd = await db
      .select({
        session: classSessions,
        schedule: schedules,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(
        and(
          eq(classSessions.status, "active"),
          // Current time is past end time
          lte(schedules.endTime, now.toTimeString().slice(0, 8))
        )
      );

    const endedSessions = [];

    for (const { session } of sessionsToEnd) {
      await db
        .update(classSessions)
        .set({ status: "completed" })
        .where(eq(classSessions.id, session.id));

      endedSessions.push(session);
    }

    res.json({
      success: true,
      message: `Ended ${endedSessions.length} class sessions`,
      sessions: endedSessions,
    });
  } catch (error) {
    console.error("Auto-end sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Manual session control (admin only - for emergencies)
router.put("/:id/status", requireAuth, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { status } = req.body;

    if (!["scheduled", "active", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Check if user is admin
    if (req.session?.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required for manual session control",
      });
    }

    const [updatedSession] = await db
      .update(classSessions)
      .set({ status })
      .where(eq(classSessions.id, sessionId))
      .returning();

    if (!updatedSession) {
      return res.status(404).json({
        success: false,
        message: "Class session not found",
      });
    }

    res.json({
      success: true,
      message: "Session status updated successfully",
      session: updatedSession,
    });
  } catch (error) {
    console.error("Update session status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
