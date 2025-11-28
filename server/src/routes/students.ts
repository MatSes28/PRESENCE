import { Router } from "express";
import { db } from "../storage.js";
import {
  students,
  attendanceRecords,
  classSessions,
  enrollments,
  subjects,
  schedules,
  users,
} from "../schema.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
  requireAdminOrFaculty,
} from "../middleware/auth.js";
import {
  sanitizeInput,
  validateRequest,
  validationRules,
} from "../middleware/validation.js";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { encryptionService } from "../services/encryptionService.js";

const router = Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Get all students (with role-based filtering)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    if (userRole === "faculty") {
      // Faculty can only see students enrolled in their subjects
      const facultySubjects = await db
        .select({ id: subjects.id })
        .from(subjects)
        .innerJoin(schedules, eq(subjects.id, schedules.subjectId))
        .where(eq(schedules.facultyId, userId));

      const subjectIds = facultySubjects.map((s) => s.id);

      if (subjectIds.length === 0) {
        return res.json({
          success: true,
          students: [],
        });
      }

      const enrolledStudentIds = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(inArray(enrollments.subjectId, subjectIds));

      const studentIds = [
        ...new Set(enrolledStudentIds.map((e) => e.studentId)),
      ];

      if (studentIds.length === 0) {
        return res.json({
          success: true,
          students: [],
        });
      }

      const encryptedStudents = await db
        .select()
        .from(students)
        .where(inArray(students.id, studentIds))
        .orderBy(students.name);

      // Decrypt sensitive data
      const decryptedStudents = encryptedStudents.map((student) => ({
        ...student,
        rfidUid: student.rfidUid
          ? encryptionService.decryptRFID(student.rfidUid)
          : null,
        parentEmail: student.parentEmail
          ? encryptionService.decryptParentData(
              student.parentEmail,
              student.parentName || ""
            ).email
          : null,
        parentName: student.parentName
          ? encryptionService.decryptParentData(
              student.parentEmail || "",
              student.parentName
            ).phone
          : null,
      }));

      return res.json({
        success: true,
        students: decryptedStudents,
      });
    }

    // Admin sees all students
    const encryptedStudents = await db
      .select()
      .from(students)
      .orderBy(students.name);

    // Decrypt sensitive data
    const decryptedStudents = encryptedStudents.map((student) => ({
      ...student,
      rfidUid: student.rfidUid
        ? encryptionService.decryptRFID(student.rfidUid)
        : null,
      parentEmail: student.parentEmail
        ? encryptionService.decryptParentData(
            student.parentEmail,
            student.parentName || ""
          ).email
        : null,
      parentName: student.parentName
        ? encryptionService.decryptParentData(
            student.parentEmail || "",
            student.parentName
          ).phone
        : null,
    }));

    res.json({
      success: true,
      students: decryptedStudents,
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

    const encryptedStudent = studentResult[0];

    // Decrypt sensitive data
    const decryptedStudent = {
      ...encryptedStudent,
      rfidUid: encryptedStudent.rfidUid
        ? encryptionService.decryptRFID(encryptedStudent.rfidUid)
        : null,
      parentEmail: encryptedStudent.parentEmail
        ? encryptionService.decryptParentData(
            encryptedStudent.parentEmail,
            encryptedStudent.parentName || ""
          ).email
        : null,
      parentName: encryptedStudent.parentName
        ? encryptionService.decryptParentData(
            encryptedStudent.parentEmail || "",
            encryptedStudent.parentName
          ).phone
        : null,
    };

    res.json({
      success: true,
      student: decryptedStudent,
    });
  } catch (error) {
    console.error("Get student error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Create new student (admin only) - Restricted to BSIT students from DIT under College of Engineering
router.post(
  "/",
  requireAdmin,
  sanitizeInput,
  validateRequest({
    studentId: validationRules.studentId,
    name: validationRules.name,
    email: (value) => {
      if (value && !validationRules.email(value)) return null;
      return validationRules.email(value);
    },
    rfidUid: validationRules.rfidUid,
    parentEmail: validationRules.email,
  }),
  async (req, res) => {
    try {
      const {
        studentId,
        name,
        email,
        year,
        section,
        rfidUid,
        parentEmail,
        parentName,
      } = req.body;

      if (!studentId || !name || !parentEmail) {
        return res.status(400).json({
          success: false,
          message: "Student ID, name, and parent email are required",
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

      // Encrypt sensitive data
      const encryptedRfid = rfidUid
        ? encryptionService.encryptRFID(rfidUid)
        : null;
      const encryptedParentData = encryptionService.encryptParentData(
        parentEmail,
        parentName || ""
      );

      const [newStudent] = await db
        .insert(students)
        .values({
          studentId,
          name,
          email,
          year,
          section,
          rfidUid: encryptedRfid,
          parentEmail: encryptedParentData.email,
          parentName: encryptedParentData.phone, // Using phone field for parentName since it's encrypted together
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
  }
);

// Update student (admin only)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const { name, email, year, section, rfidUid, parentEmail, parentName } =
      req.body;

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

    // Encrypt sensitive data
    const encryptedRfid = rfidUid
      ? encryptionService.encryptRFID(rfidUid)
      : undefined;
    const encryptedParentData = parentEmail
      ? encryptionService.encryptParentData(parentEmail, parentName || "")
      : undefined;

    const updateData: any = {
      name,
      email,
      year,
      section,
      updatedAt: new Date(),
    };

    if (encryptedRfid !== undefined) updateData.rfidUid = encryptedRfid;
    if (encryptedParentData) {
      updateData.parentEmail = encryptedParentData.email;
      updateData.parentName = encryptedParentData.phone;
    }

    const [updatedStudent] = await db
      .update(students)
      .set(updateData)
      .where(eq(students.id, studentId))
      .returning();

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Decrypt for response
    const decryptedStudent = {
      ...updatedStudent,
      rfidUid: updatedStudent.rfidUid
        ? encryptionService.decryptRFID(updatedStudent.rfidUid)
        : null,
      parentEmail: updatedStudent.parentEmail
        ? encryptionService.decryptParentData(
            updatedStudent.parentEmail,
            updatedStudent.parentName || ""
          ).email
        : null,
      parentName: updatedStudent.parentName
        ? encryptionService.decryptParentData(
            updatedStudent.parentEmail || "",
            updatedStudent.parentName
          ).phone
        : null,
    };

    res.json({
      success: true,
      message: "Student updated successfully",
      student: decryptedStudent,
    });
  } catch (error) {
    console.error("Update student error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Delete student (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
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

// Assign RFID to student (admin only)
router.post("/:id/assign-rfid", requireAdmin, async (req, res) => {
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

    const encryptedRfid = encryptionService.encryptRFID(rfidUid);

    const [updatedStudent] = await db
      .update(students)
      .set({
        rfidUid: encryptedRfid,
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

    // Decrypt for response
    const decryptedStudent = {
      ...updatedStudent,
      rfidUid: updatedStudent.rfidUid
        ? encryptionService.decryptRFID(updatedStudent.rfidUid)
        : null,
      parentEmail: updatedStudent.parentEmail
        ? encryptionService.decryptParentData(
            updatedStudent.parentEmail,
            updatedStudent.parentName || ""
          ).email
        : null,
      parentName: updatedStudent.parentName
        ? encryptionService.decryptParentData(
            updatedStudent.parentEmail || "",
            updatedStudent.parentName
          ).phone
        : null,
    };

    res.json({
      success: true,
      message: "RFID assigned successfully",
      student: decryptedStudent,
    });
  } catch (error) {
    console.error("Assign RFID error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// CSV Upload endpoint (admin only)
router.post(
  "/upload-csv",
  requireAdmin,
  upload.single("csv"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No CSV file provided",
        });
      }

      const results: any[] = [];
      const stream = Readable.from(req.file.buffer.toString());

      stream
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          try {
            let imported = 0;
            let errors = 0;

            for (const row of results) {
              try {
                // Validate required fields
                if (!row.studentId || !row.name || !row.parentEmail) {
                  errors++;
                  continue;
                }

                // Check if student ID already exists
                const existingStudent = await db
                  .select()
                  .from(students)
                  .where(eq(students.studentId, row.studentId))
                  .limit(1);

                if (existingStudent.length > 0) {
                  errors++;
                  continue;
                }

                // Check if RFID UID already exists (if provided)
                if (row.rfidUid) {
                  const existingRFID = await db
                    .select()
                    .from(students)
                    .where(eq(students.rfidUid, row.rfidUid))
                    .limit(1);

                  if (existingRFID.length > 0) {
                    errors++;
                    continue;
                  }
                }

                // Encrypt sensitive data
                const encryptedRfid = row.rfidUid
                  ? encryptionService.encryptRFID(row.rfidUid)
                  : null;
                const encryptedParentData = encryptionService.encryptParentData(
                  row.parentEmail,
                  row.parentName || ""
                );

                await db.insert(students).values({
                  studentId: row.studentId,
                  name: row.name,
                  email: row.email || null,
                  year: row.year || null,
                  section: row.section || null,
                  rfidUid: encryptedRfid,
                  parentEmail: encryptedParentData.email,
                  parentName: encryptedParentData.phone,
                });

                imported++;
              } catch (error) {
                console.error("Error importing row:", error, row);
                errors++;
              }
            }

            res.json({
              success: true,
              message: `Imported ${imported} students, ${errors} errors`,
              imported,
              errors,
            });
          } catch (error) {
            console.error("CSV processing error:", error);
            res.status(500).json({
              success: false,
              message: "Failed to process CSV data",
            });
          }
        })
        .on("error", (error) => {
          console.error("CSV parsing error:", error);
          res.status(500).json({
            success: false,
            message: "Failed to parse CSV file",
          });
        });
    } catch (error) {
      console.error("CSV upload error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

export default router;
