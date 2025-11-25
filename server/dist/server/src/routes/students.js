import { Router } from "express";
import { db } from "../storage.js";
import { students, attendanceRecords, classSessions, enrollments, subjects, schedules, } from "../schema.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, } from "../middleware/auth.js";
const router = Router();
router.get("/", requireAuth, async (req, res) => {
    try {
        const userRole = req.session?.userRole;
        const userId = req.session?.userId;
        if (userRole === "faculty") {
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
            const allStudents = await db
                .select()
                .from(students)
                .where(inArray(students.id, studentIds))
                .orderBy(students.name);
            return res.json({
                success: true,
                students: allStudents,
            });
        }
        const allStudents = await db.select().from(students).orderBy(students.name);
        res.json({
            success: true,
            students: allStudents,
        });
    }
    catch (error) {
        console.error("Get students error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
    }
    catch (error) {
        console.error("Get student error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/", requireAdmin, async (req, res) => {
    try {
        const { studentId, name, email, year, section, rfidUid, parentEmail, parentName, } = req.body;
        if (!studentId || !name || !parentEmail) {
            return res.status(400).json({
                success: false,
                message: "Student ID, name, and parent email are required",
            });
        }
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
            year,
            section,
            rfidUid,
            parentEmail,
            parentName,
        })
            .returning();
        res.status(201).json({
            success: true,
            message: "Student created successfully",
            student: newStudent,
        });
    }
    catch (error) {
        console.error("Create student error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.put("/:id", requireAdmin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { name, email, year, section, rfidUid, parentEmail, parentName } = req.body;
        if (rfidUid) {
            const existingRFID = await db
                .select()
                .from(students)
                .where(and(eq(students.rfidUid, rfidUid), sql `${students.id} != ${studentId}`))
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
            year,
            section,
            rfidUid,
            parentEmail,
            parentName,
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
    }
    catch (error) {
        console.error("Update student error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const attendanceCount = await db
            .select({ count: sql `count(*)` })
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
    }
    catch (error) {
        console.error("Delete student error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
            .innerJoin(classSessions, eq(attendanceRecords.classSessionId, classSessions.id))
            .where(eq(attendanceRecords.studentId, studentId))
            .orderBy(desc(attendanceRecords.createdAt))
            .limit(parseInt(limit))
            .offset(parseInt(offset));
        res.json({
            success: true,
            attendance: attendanceHistory,
        });
    }
    catch (error) {
        console.error("Get student attendance error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
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
    }
    catch (error) {
        console.error("Assign RFID error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
export default router;
