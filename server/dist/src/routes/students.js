"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get("/", auth_js_1.requireAuth, async (req, res) => {
    try {
        const userRole = req.session?.userRole;
        const userId = req.session?.userId;
        if (userRole === "faculty") {
            const facultySubjects = await storage_js_1.db
                .select({ id: schema_js_1.subjects.id })
                .from(schema_js_1.subjects)
                .innerJoin(schema_js_1.schedules, (0, drizzle_orm_1.eq)(schema_js_1.subjects.id, schema_js_1.schedules.subjectId))
                .where((0, drizzle_orm_1.eq)(schema_js_1.schedules.facultyId, userId));
            const subjectIds = facultySubjects.map((s) => s.id);
            if (subjectIds.length === 0) {
                return res.json({
                    success: true,
                    students: [],
                });
            }
            const enrolledStudentIds = await storage_js_1.db
                .select({ studentId: schema_js_1.enrollments.studentId })
                .from(schema_js_1.enrollments)
                .where((0, drizzle_orm_1.inArray)(schema_js_1.enrollments.subjectId, subjectIds));
            const studentIds = [
                ...new Set(enrolledStudentIds.map((e) => e.studentId)),
            ];
            if (studentIds.length === 0) {
                return res.json({
                    success: true,
                    students: [],
                });
            }
            const allStudents = await storage_js_1.db
                .select()
                .from(schema_js_1.students)
                .where((0, drizzle_orm_1.inArray)(schema_js_1.students.id, studentIds))
                .orderBy(schema_js_1.students.name);
            return res.json({
                success: true,
                students: allStudents,
            });
        }
        const allStudents = await storage_js_1.db.select().from(schema_js_1.students).orderBy(schema_js_1.students.name);
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
router.get("/:id", auth_js_1.requireAuth, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const studentResult = await storage_js_1.db
            .select()
            .from(schema_js_1.students)
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, studentId))
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
router.post("/", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const { studentId, name, email, year, section, rfidUid, parentEmail, parentName, } = req.body;
        if (!studentId || !name || !parentEmail) {
            return res.status(400).json({
                success: false,
                message: "Student ID, name, and parent email are required",
            });
        }
        const existingStudent = await storage_js_1.db
            .select()
            .from(schema_js_1.students)
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.studentId, studentId))
            .limit(1);
        if (existingStudent.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Student ID already exists",
            });
        }
        if (rfidUid) {
            const existingRFID = await storage_js_1.db
                .select()
                .from(schema_js_1.students)
                .where((0, drizzle_orm_1.eq)(schema_js_1.students.rfidUid, rfidUid))
                .limit(1);
            if (existingRFID.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "RFID UID already exists",
                });
            }
        }
        const [newStudent] = await storage_js_1.db
            .insert(schema_js_1.students)
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
router.put("/:id", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { name, email, year, section, rfidUid, parentEmail, parentName } = req.body;
        if (rfidUid) {
            const existingRFID = await storage_js_1.db
                .select()
                .from(schema_js_1.students)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.students.rfidUid, rfidUid), (0, drizzle_orm_1.sql) `${schema_js_1.students.id} != ${studentId}`))
                .limit(1);
            if (existingRFID.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "RFID UID already exists for another student",
                });
            }
        }
        const [updatedStudent] = await storage_js_1.db
            .update(schema_js_1.students)
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
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, studentId))
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
router.delete("/:id", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const attendanceCount = await storage_js_1.db
            .select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_js_1.attendanceRecords)
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, studentId));
        if (attendanceCount[0].count > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete student with attendance records",
            });
        }
        const deletedStudent = await storage_js_1.db
            .delete(schema_js_1.students)
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, studentId))
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
router.get("/:id/attendance", auth_js_1.requireAuth, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { limit = 50, offset = 0 } = req.query;
        const attendanceHistory = await storage_js_1.db
            .select({
            record: schema_js_1.attendanceRecords,
            session: schema_js_1.classSessions,
        })
            .from(schema_js_1.attendanceRecords)
            .innerJoin(schema_js_1.classSessions, (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, schema_js_1.classSessions.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, studentId))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.attendanceRecords.createdAt))
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
router.post("/:id/assign-rfid", auth_js_1.requireAdmin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { rfidUid } = req.body;
        if (!rfidUid) {
            return res.status(400).json({
                success: false,
                message: "RFID UID is required",
            });
        }
        const existingRFID = await storage_js_1.db
            .select()
            .from(schema_js_1.students)
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.rfidUid, rfidUid))
            .limit(1);
        if (existingRFID.length > 0) {
            return res.status(409).json({
                success: false,
                message: "RFID UID already assigned to another student",
            });
        }
        const [updatedStudent] = await storage_js_1.db
            .update(schema_js_1.students)
            .set({
            rfidUid,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.students.id, studentId))
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
exports.default = router;
