import { Router } from "express";
import { db } from "../storage.js";
import { classrooms } from "../schema.js";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Get all classrooms
router.get("/", requireAuth, async (req, res) => {
  try {
    const allClassrooms = await db.select().from(classrooms);
    res.json({
      success: true,
      data: allClassrooms,
    });
  } catch (error) {
    console.error("Error fetching classrooms:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch classrooms",
    });
  }
});

// Get classroom by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const classroom = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, parseInt(id)));
    if (classroom.length === 0) {
      return res.status(404).json({ error: "Classroom not found" });
    }
    res.json(classroom[0]);
  } catch (error) {
    console.error("Error fetching classroom:", error);
    res.status(500).json({ error: "Failed to fetch classroom" });
  }
});

// Create new classroom - Restricted to CLIRDEC Building only
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, type, capacity } = req.body;

    // Validate classroom type (must be lecture or laboratory)
    if (!["lecture", "laboratory"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Classroom type must be 'lecture' or 'laboratory'",
      });
    }

    // Check total classroom count (limit to 4)
    const existingClassrooms = await db.select().from(classrooms);
    if (existingClassrooms.length >= 4) {
      return res.status(400).json({
        success: false,
        message: "Maximum of 4 classrooms allowed (2 lecture, 2 lab rooms)",
      });
    }

    // Count lecture vs lab rooms
    const lectureCount = existingClassrooms.filter(
      (c) => c.type === "lecture"
    ).length;
    const labCount = existingClassrooms.filter(
      (c) => c.type === "laboratory"
    ).length;

    if (type === "lecture" && lectureCount >= 2) {
      return res.status(400).json({
        success: false,
        message: "Maximum of 2 lecture rooms allowed",
      });
    }

    if (type === "laboratory" && labCount >= 2) {
      return res.status(400).json({
        success: false,
        message: "Maximum of 2 laboratory rooms allowed",
      });
    }

    const newClassroom = await db
      .insert(classrooms)
      .values({
        name,
        location: "CLIRDEC Building", // Always CLIRDEC Building
        type,
        capacity,
      })
      .returning();
    res.status(201).json(newClassroom[0]);
  } catch (error) {
    console.error("Error creating classroom:", error);
    res.status(500).json({ error: "Failed to create classroom" });
  }
});

// Update classroom
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, capacity } = req.body;
    const updatedClassroom = await db
      .update(classrooms)
      .set({ name, location, capacity })
      .where(eq(classrooms.id, parseInt(id)))
      .returning();
    if (updatedClassroom.length === 0) {
      return res.status(404).json({ error: "Classroom not found" });
    }
    res.json(updatedClassroom[0]);
  } catch (error) {
    console.error("Error updating classroom:", error);
    res.status(500).json({ error: "Failed to update classroom" });
  }
});

// Delete classroom
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedClassroom = await db
      .delete(classrooms)
      .where(eq(classrooms.id, parseInt(id)))
      .returning();
    if (deletedClassroom.length === 0) {
      return res.status(404).json({ error: "Classroom not found" });
    }
    res.json({ message: "Classroom deleted successfully" });
  } catch (error) {
    console.error("Error deleting classroom:", error);
    res.status(500).json({ error: "Failed to delete classroom" });
  }
});

export default router;
