import { Router } from "express";
import { db } from "../storage.js";
import { subjects } from "../schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Get all subjects
router.get("/", requireAuth, async (req, res) => {
  try {
    const allSubjects = await db
      .select()
      .from(subjects)
      .orderBy(desc(subjects.createdAt));

    res.json({
      success: true,
      data: allSubjects,
    });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subjects",
    });
  }
});

// Get subject by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, parseInt(id)))
      .limit(1);

    if (subject.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    res.json({
      success: true,
      data: subject[0],
    });
  } catch (error) {
    console.error("Error fetching subject:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subject",
    });
  }
});

// Create new subject
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, code, description, credits } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Name and code are required",
      });
    }

    // Check if subject code already exists
    const existingSubject = await db
      .select()
      .from(subjects)
      .where(eq(subjects.code, code))
      .limit(1);

    if (existingSubject.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Subject code already exists",
      });
    }

    const newSubject = await db
      .insert(subjects)
      .values({
        name,
        code,
        description,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: newSubject[0],
    });
  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subject",
    });
  }
});

// Update subject
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, credits } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Name and code are required",
      });
    }

    // Check if code is already taken by another subject
    const existingSubject = await db
      .select()
      .from(subjects)
      .where(eq(subjects.code, code))
      .limit(1);

    if (existingSubject.length > 0 && existingSubject[0].id !== parseInt(id)) {
      return res.status(409).json({
        success: false,
        message: "Subject code already exists",
      });
    }

    const updatedSubject = await db
      .update(subjects)
      .set({
        name,
        code,
        description,
      })
      .where(eq(subjects.id, parseInt(id)))
      .returning();

    if (updatedSubject.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    res.json({
      success: true,
      message: "Subject updated successfully",
      data: updatedSubject[0],
    });
  } catch (error) {
    console.error("Error updating subject:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update subject",
    });
  }
});

// Delete subject
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSubject = await db
      .delete(subjects)
      .where(eq(subjects.id, parseInt(id)))
      .returning();

    if (deletedSubject.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    res.json({
      success: true,
      message: "Subject deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subject:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete subject",
    });
  }
});

export default router;
