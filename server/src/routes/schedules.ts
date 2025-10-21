import { Router } from "express";
import { db } from "../storage.js";
import {
  schedules,
  subjects,
  classrooms,
  users,
} from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// Get all schedules
router.get("/", async (req, res) => {
  try {
    const allSchedules = await db.select().from(schedules);
    res.json(allSchedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

// Get schedule by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, parseInt(id)));
    if (schedule.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(schedule[0]);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

// Create new schedule
router.post("/", async (req, res) => {
  try {
    const {
      subjectId,
      classroomId,
      facultyId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
    } = req.body;
    const newSchedule = await db
      .insert(schedules)
      .values({
        subjectId,
        classroomId,
        facultyId,
        dayOfWeek,
        startTime,
        endTime,
        semester,
        academicYear,
      })
      .returning();
    res.status(201).json(newSchedule[0]);
  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

// Update schedule
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subjectId,
      classroomId,
      facultyId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
    } = req.body;
    const updatedSchedule = await db
      .update(schedules)
      .set({
        subjectId,
        classroomId,
        facultyId,
        dayOfWeek,
        startTime,
        endTime,
        semester,
        academicYear,
      })
      .where(eq(schedules.id, parseInt(id)))
      .returning();
    if (updatedSchedule.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(updatedSchedule[0]);
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

// Delete schedule
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSchedule = await db
      .delete(schedules)
      .where(eq(schedules.id, parseInt(id)))
      .returning();
    if (deletedSchedule.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

export default router;
