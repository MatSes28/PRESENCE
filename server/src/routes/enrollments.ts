import { Router } from "express";
import { db } from "../storage.js";
import {
  enrollments,
  students,
  subjects,
  schedules,
  users,
} from "../schema.js";
import { eq, and, inArray } from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
  requireAdminOrFaculty,
} from "../middleware/auth.js";

const router = Router();

// Get all enrollments (with role-based filtering)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    if (userRole === "faculty") {
      // Faculty can only see enrollments for their subjects
      const facultySubjects = await db
        .select({ id: subjects.id })
        .from(subjects)
        .innerJoin(schedules, eq(subjects.id, schedules.subjectId))
        .where(eq(schedules.facultyId, userId));

      const subjectIds = facultySubjects.map((s) => s.id);

      if (subjectIds.length === 0) {
        return res.json({
          success: true,
          enrollments: [],
        });
      }

      const enrollmentsData = await db
        .select({
          enrollment: enrollments,
          student: students,
          subject: subjects,
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .innerJoin(subjects, eq(enrollments.subjectId, subjects.id))
        .where(inArray(enrollments.subjectId, subjectIds));

      return res.json({
        success: true,
        enrollments: enrollmentsData,
      });
    }

    // Admin sees all enrollments
    const enrollmentsData = await db
      .select({
        enrollment: enrollments,
        student: students,
        subject: subjects,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(subjects, eq(enrollments.subjectId, subjects.id));

    res.json({
      success: true,
      enrollments: enrollmentsData,
    });
  } catch (error) {
    console.error("Get enrollments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get enrollments for a specific subject
router.get("/subject/:subjectId", requireAuth, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.subjectId);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    // Check if faculty has access to this subject
    if (userRole === "faculty") {
      const subjectCheck = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.subjectId, subjectId),
            eq(schedules.facultyId, userId)
          )
        )
        .limit(1);

      if (subjectCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this subject",
        });
      }
    }

    const enrollmentsData = await db
      .select({
        enrollment: enrollments,
        student: students,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(eq(enrollments.subjectId, subjectId));

    res.json({
      success: true,
      enrollments: enrollmentsData,
    });
  } catch (error) {
    console.error("Get subject enrollments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get enrollments for a specific student
router.get("/student/:studentId", requireAuth, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    // Check if faculty has access to this student
    if (userRole === "faculty") {
      const studentCheck = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .innerJoin(subjects, eq(enrollments.subjectId, subjects.id))
        .innerJoin(schedules, eq(subjects.id, schedules.subjectId))
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(schedules.facultyId, userId)
          )
        )
        .limit(1);

      if (studentCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this student",
        });
      }
    }

    const enrollmentsData = await db
      .select({
        enrollment: enrollments,
        subject: subjects,
      })
      .from(enrollments)
      .innerJoin(subjects, eq(enrollments.subjectId, subjects.id))
      .where(eq(enrollments.studentId, studentId));

    res.json({
      success: true,
      enrollments: enrollmentsData,
    });
  } catch (error) {
    console.error("Get student enrollments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Create enrollment (admin only)
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { studentId, subjectId, semester, academicYear } = req.body;

    if (!studentId || !subjectId || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message:
          "Student ID, subject ID, semester, and academic year are required",
      });
    }

    // Check if student exists
    const studentCheck = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (studentCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check if subject exists
    const subjectCheck = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, subjectId))
      .limit(1);

    if (subjectCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    // Check if enrollment already exists
    const existingEnrollment = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.subjectId, subjectId),
          eq(enrollments.semester, semester),
          eq(enrollments.academicYear, academicYear)
        )
      )
      .limit(1);

    if (existingEnrollment.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Student is already enrolled in this subject for the specified semester",
      });
    }

    const [newEnrollment] = await db
      .insert(enrollments)
      .values({
        studentId,
        subjectId,
        semester,
        academicYear,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Enrollment created successfully",
      enrollment: newEnrollment,
    });
  } catch (error) {
    console.error("Create enrollment error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update enrollment (admin only)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id);
    const { semester, academicYear, isActive } = req.body;

    const [updatedEnrollment] = await db
      .update(enrollments)
      .set({
        semester,
        academicYear,
        isActive,
      })
      .where(eq(enrollments.id, enrollmentId))
      .returning();

    if (!updatedEnrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    res.json({
      success: true,
      message: "Enrollment updated successfully",
      enrollment: updatedEnrollment,
    });
  } catch (error) {
    console.error("Update enrollment error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Delete enrollment (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.id);

    const deletedEnrollment = await db
      .delete(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .returning();

    if (deletedEnrollment.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    res.json({
      success: true,
      message: "Enrollment deleted successfully",
    });
  } catch (error) {
    console.error("Delete enrollment error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Bulk enroll students in a subject (admin only)
router.post("/bulk", requireAdmin, async (req, res) => {
  try {
    const { studentIds, subjectId, semester, academicYear } = req.body;

    if (
      !studentIds ||
      !Array.isArray(studentIds) ||
      !subjectId ||
      !semester ||
      !academicYear
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Student IDs array, subject ID, semester, and academic year are required",
      });
    }

    // Check if subject exists
    const subjectCheck = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, subjectId))
      .limit(1);

    if (subjectCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const enrollmentsData = studentIds.map((studentId) => ({
      studentId,
      subjectId,
      semester,
      academicYear,
    }));

    const newEnrollments = await db
      .insert(enrollments)
      .values(enrollmentsData)
      .returning();

    res.status(201).json({
      success: true,
      message: `${newEnrollments.length} students enrolled successfully`,
      enrollments: newEnrollments,
    });
  } catch (error) {
    console.error("Bulk enrollment error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
