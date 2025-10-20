import { Router } from "express";
import { db } from "../storage.js";
import { students, attendanceRecords, classSessions } from "../schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

// Get all students
router.get("/", requireAuth, async (req, res) => {
  try {
    const allStudents = await db.select().from(students).orderBy(students.name);

    res.json({
      success: true,
      students: allStudents,
    });
  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get student by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    const studentResult = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (studentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      student: studentResult[0],
    });
  } catch (error) {
    console.error("Get student error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Create new student
router.post("/", requireAuth, async (req, res) => {
  try {
    const { studentId, name, email, rfidUid, parentEmail } = req.body;

    if (!studentId || !name) {
      return res.status(400).json({
        success: false,
        message: "Student ID and name are required",
      });
    }

    // Check if student ID already exists
    const existingStudent = await db
      .select()
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1);

    if (existingStudent.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Student ID already exists",
      });
    }

    // Check if RFID UID already exists (if provided)
    if (rfidUid) {
      const existingRFID = await db
        .select()
        .from(students)
        .where(eq(students.rfidUid, rfidUid))
        .limit(1);

      if (existingRFID.length > 0) {
        return res.status(409).json({
          success: false,
          message: "RFID UID already exists",
        });
      }
    }

    const [newStudent] = await db
      .insert(students)
      .values({
        studentId,
        name,
        email,
        rfidUid,
        parentEmail,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student: newStudent,
    });
  } catch (error) {
    console.error("Create student error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update student
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { name, email, rfidUid, parentEmail } = req.body;

    // Check if RFID UID conflicts with other students
    if (rfidUid) {
      const existingRFID = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.rfidUid, rfidUid),
            sql`${students.id} != ${studentId}`
          )
        )
        .limit(1);

      if (existingRFID.length > 0) {
        return res.status(409).json({
          success: false,
          message: "RFID UID already exists for another student",
        });
      }
    }

    const [updatedStudent] = await db
      .update(students)
      .set({
        name,
        email,
        rfidUid,
        parentEmail,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId))
      .returning();

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Update student error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Delete student
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    // Check if student has attendance records
    const attendanceCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, studentId));

    if (attendanceCount[0].count > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete student with attendance records",
      });
    }

    const deletedStudent = await db
      .delete(students)
      .where(eq(students.id, studentId))
      .returning();

    if (deletedStudent.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get student attendance history
router.get("/:id/attendance", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { limit = 50, offset = 0 } = req.query;

    const attendanceHistory = await db
      .select({
        record: attendanceRecords,
        session: classSessions,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(eq(attendanceRecords.studentId, studentId))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      success: true,
      attendance: attendanceHistory,
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Assign RFID to student
router.post("/:id/assign-rfid", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { rfidUid } = req.body;

    if (!rfidUid) {
      return res.status(400).json({
        success: false,
        message: "RFID UID is required",
      });
    }

    // Check if RFID UID is already assigned
    const existingRFID = await db
      .select()
      .from(students)
      .where(eq(students.rfidUid, rfidUid))
      .limit(1);

    if (existingRFID.length > 0) {
      return res.status(409).json({
        success: false,
        message: "RFID UID already assigned to another student",
      });
    }

    const [updatedStudent] = await db
      .update(students)
      .set({
        rfidUid,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId))
      .returning();

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      message: "RFID assigned successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Assign RFID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
