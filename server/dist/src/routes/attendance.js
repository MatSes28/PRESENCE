"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const attendanceMonitor_js_1 = require("../services/attendanceMonitor.js");
const errorHandler_js_1 = require("../utils/errorHandler.js");
const validation_js_1 = require("../middleware/validation.js");
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
        const { studentId, classSessionId, date, limit = 50, offset = 0, } = req.query;
        let whereConditions = [];
        if (studentId) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, parseInt(studentId)));
        }
        if (classSessionId) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, parseInt(classSessionId)));
        }
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            const sessions = await storage_js_1.db
                .select()
                .from(schema_js_1.classSessions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_js_1.classSessions.date, startDate), (0, drizzle_orm_1.lte)(schema_js_1.classSessions.date, endDate)));
            if (sessions.length > 0) {
                whereConditions.push((0, drizzle_orm_1.sql) `${schema_js_1.attendanceRecords.classSessionId} IN (${sessions
                    .map((s) => s.id)
                    .join(",")})`);
            }
        }
        const whereClause = whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined;
        const records = await storage_js_1.db
            .select({
            record: schema_js_1.attendanceRecords,
            student: {
                id: schema_js_1.students.id,
                studentId: schema_js_1.students.studentId,
                name: schema_js_1.students.name,
                email: schema_js_1.students.email,
            },
            session: {
                id: schema_js_1.classSessions.id,
                date: schema_js_1.classSessions.date,
                status: schema_js_1.classSessions.status,
            },
        })
            .from(schema_js_1.attendanceRecords)
            .innerJoin(schema_js_1.students, (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, schema_js_1.students.id))
            .innerJoin(schema_js_1.classSessions, (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, schema_js_1.classSessions.id))
            .where(whereClause)
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.attendanceRecords.createdAt))
            .limit(parseInt(limit))
            .offset(parseInt(offset));
        res.json({
            success: true,
            records,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
            },
        });
    }
    catch (error) {
        console.error("Get attendance records error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.get("/stats/:sessionId", requireAuth, async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const stats = await attendanceMonitor_js_1.attendanceMonitor.getAttendanceStats(sessionId);
        res.json({
            success: true,
            stats,
        });
    }
    catch (error) {
        console.error("Get attendance stats error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/manual", requireAuth, (0, validation_js_1.validateRequired)(["studentId", "classSessionId"]), (0, validation_js_1.validateNumeric)(["studentId", "classSessionId"]), (0, validation_js_1.validateDate)(["entryTime", "exitTime"]), (0, validation_js_1.sanitizeInput)(["notes"]), (0, errorHandler_js_1.wrapAsync)(async (req, res) => {
    const { studentId, classSessionId, entryTime, exitTime, notes } = req.body;
    const existingRecord = await storage_js_1.db
        .select()
        .from(schema_js_1.attendanceRecords)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, studentId), (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, classSessionId)))
        .limit(1);
    if (existingRecord.length > 0) {
        throw new errorHandler_js_1.AppError("Attendance record already exists for this student and session", 409);
    }
    const [newRecord] = await storage_js_1.db
        .insert(schema_js_1.attendanceRecords)
        .values({
        studentId,
        classSessionId,
        entryTime: entryTime ? new Date(entryTime) : null,
        exitTime: exitTime ? new Date(exitTime) : null,
        rfidDetected: false,
        sensorDetected: false,
        isValid: true,
        discrepancyFlag: false,
        notes: notes || "Manually entered",
    })
        .returning();
    res.status(201).json({
        success: true,
        message: "Attendance record created successfully",
        record: newRecord,
    });
}));
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { entryTime, exitTime, isValid, notes } = req.body;
        const [updatedRecord] = await storage_js_1.db
            .update(schema_js_1.attendanceRecords)
            .set({
            entryTime: entryTime ? new Date(entryTime) : undefined,
            exitTime: exitTime ? new Date(exitTime) : undefined,
            isValid,
            discrepancyFlag: !isValid,
            notes,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.id, recordId))
            .returning();
        if (!updatedRecord) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }
        res.json({
            success: true,
            message: "Attendance record updated successfully",
            record: updatedRecord,
        });
    }
    catch (error) {
        console.error("Update attendance record error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const deletedRecord = await storage_js_1.db
            .delete(schema_js_1.attendanceRecords)
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.id, recordId))
            .returning();
        if (deletedRecord.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }
        res.json({
            success: true,
            message: "Attendance record deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete attendance record error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.get("/sessions/active", requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const activeSessions = await storage_js_1.db
            .select({
            session: schema_js_1.classSessions,
            schedule: {
                id: schema_js_1.schedules.id,
                subject: schema_js_1.subjects.name,
                classroom: schema_js_1.classrooms.name,
                faculty: (0, drizzle_orm_1.sql) `CONCAT(${schema_js_1.users.firstName}, ' ', ${schema_js_1.users.lastName})`,
            },
        })
            .from(schema_js_1.classSessions)
            .innerJoin(schema_js_1.schedules, (0, drizzle_orm_1.eq)(schema_js_1.classSessions.scheduleId, schema_js_1.schedules.id))
            .innerJoin(schema_js_1.subjects, (0, drizzle_orm_1.eq)(schema_js_1.schedules.subjectId, schema_js_1.subjects.id))
            .innerJoin(schema_js_1.classrooms, (0, drizzle_orm_1.eq)(schema_js_1.schedules.classroomId, schema_js_1.classrooms.id))
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.schedules.facultyId, schema_js_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.classSessions.status, "active"), (0, drizzle_orm_1.gte)(schema_js_1.classSessions.date, new Date(now.getTime() - 2 * 60 * 60 * 1000)), (0, drizzle_orm_1.lte)(schema_js_1.classSessions.date, new Date(now.getTime() + 2 * 60 * 60 * 1000))))
            .orderBy(schema_js_1.classSessions.date);
        res.json({
            success: true,
            sessions: activeSessions,
        });
    }
    catch (error) {
        console.error("Get active sessions error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/:id/validate", requireAuth, async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        await attendanceMonitor_js_1.attendanceMonitor.validateAttendanceRecord(recordId);
        res.json({
            success: true,
            message: "Attendance record validated successfully",
        });
    }
    catch (error) {
        console.error("Validate attendance record error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.default = router;
