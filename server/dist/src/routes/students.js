"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    next();
};
router.get("/", requireAuth, async (req, res) => {
    try {
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
router.get("/:id", requireAuth, async (req, res) => {
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
router.post("/", requireAuth, async (req, res) => {
    try {
        const { studentId, name, email, rfidUid, parentEmail } = req.body;
        if (!studentId || !name) {
            return res.status(400).json({
                success: false,
                message: "Student ID and name are required",
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
            rfidUid,
            parentEmail,
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
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const { name, email, rfidUid, parentEmail } = req.body;
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
            rfidUid,
            parentEmail,
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
router.delete("/:id", requireAuth, async (req, res) => {
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
router.get("/:id/attendance", requireAuth, async (req, res) => {
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
//# sourceMappingURL=students.js.map