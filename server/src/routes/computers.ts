import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../storage.js";
import { computers, computerAssignments } from "../schema.js";

const router = Router();

// GET /api/computers - Get all computers
router.get("/", async (req, res) => {
  try {
    const allComputers = await db.select().from(computers);
    res.json({ success: true, data: allComputers });
  } catch (error) {
    console.error("Error fetching computers:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch computers" });
  }
});

// GET /api/computers/:id - Get computer by ID
router.get("/:id", async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);
    const computer = await db
      .select()
      .from(computers)
      .where(eq(computers.id, computerId))
      .limit(1);

    if (computer.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Computer not found" });
    }

    res.json({ success: true, data: computer[0] });
  } catch (error) {
    console.error("Error fetching computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch computer" });
  }
});

// POST /api/computers - Create new computer
router.post("/", async (req, res) => {
  try {
    const { classroomId, name, ipAddress, macAddress } = req.body;

    if (!classroomId || !name) {
      return res.status(400).json({
        success: false,
        message: "Classroom ID and name are required",
      });
    }

    const newComputer = await db
      .insert(computers)
      .values({
        classroomId,
        name,
        ipAddress,
        macAddress,
        status: "available",
      })
      .returning();

    res.status(201).json({ success: true, data: newComputer[0] });
  } catch (error) {
    console.error("Error creating computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create computer" });
  }
});

// PUT /api/computers/:id - Update computer
router.put("/:id", async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);
    const { name, ipAddress, macAddress, status } = req.body;

    const updatedComputer = await db
      .update(computers)
      .set({
        name,
        ipAddress,
        macAddress,
        status,
        updatedAt: new Date(),
      })
      .where(eq(computers.id, computerId))
      .returning();

    if (updatedComputer.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Computer not found" });
    }

    res.json({ success: true, data: updatedComputer[0] });
  } catch (error) {
    console.error("Error updating computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update computer" });
  }
});

// DELETE /api/computers/:id - Delete computer
router.delete("/:id", async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);

    await db.delete(computers).where(eq(computers.id, computerId));

    res.json({ success: true, message: "Computer deleted successfully" });
  } catch (error) {
    console.error("Error deleting computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete computer" });
  }
});

// GET /api/computers/assignments - Get all computer assignments
router.get("/assignments", async (req, res) => {
  try {
    const assignments = await db.select().from(computerAssignments);
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch assignments" });
  }
});

// POST /api/computers/assign - Assign computer to student
router.post("/assign", async (req, res) => {
  try {
    const { computerId, studentId, classSessionId } = req.body;

    if (!computerId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Computer ID and Student ID are required",
      });
    }

    // Update computer status to in_use
    await db
      .update(computers)
      .set({
        status: "in_use",
        updatedAt: new Date(),
      })
      .where(eq(computers.id, computerId));

    // Create assignment record
    const assignment = await db
      .insert(computerAssignments)
      .values({
        computerId,
        studentId,
        classSessionId,
        assignedAt: new Date(),
      })
      .returning();

    res.status(201).json({ success: true, data: assignment[0] });
  } catch (error) {
    console.error("Error assigning computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to assign computer" });
  }
});

// POST /api/computers/release/:assignmentId - Release computer assignment
router.post("/release/:assignmentId", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    // Get assignment to find computer
    const assignment = await db
      .select()
      .from(computerAssignments)
      .where(eq(computerAssignments.id, assignmentId))
      .limit(1);

    if (assignment.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const computerId = assignment[0].computerId;

    // Update computer status to available
    await db
      .update(computers)
      .set({ status: "available", updatedAt: new Date() })
      .where(eq(computers.id, computerId));

    // Update assignment with release time
    await db
      .update(computerAssignments)
      .set({ releasedAt: new Date() })
      .where(eq(computerAssignments.id, assignmentId));

    res.json({ success: true, message: "Computer released successfully" });
  } catch (error) {
    console.error("Error releasing computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to release computer" });
  }
});

export default router;
