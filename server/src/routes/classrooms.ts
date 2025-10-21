import { Router } from "express";
import { db } from "../storage.js";
import { classrooms } from "../../../shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// Get all classrooms
router.get("/", async (req, res) => {
  try {
    const allClassrooms = await db.select().from(classrooms);
    res.json(allClassrooms);
  } catch (error) {
    console.error("Error fetching classrooms:", error);
    res.status(500).json({ error: "Failed to fetch classrooms" });
  }
});

// Get classroom by ID
router.get("/:id", async (req, res) => {
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

// Create new classroom
router.post("/", async (req, res) => {
  try {
    const { name, location, capacity } = req.body;
    const newClassroom = await db
      .insert(classrooms)
      .values({
        name,
        location,
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
router.put("/:id", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
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
