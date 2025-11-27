import { Router } from "express";
import { db } from "../storage.js";
import { attendanceRecords, students, classSessions, schedules, classrooms, subjects, users, } from "../schema.js";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { attendanceMonitor } from "../services/attendanceMonitor.js";
import { requireAdmin } from "../middleware/auth.js";
const router = Router();
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
            whereConditions.push(eq(attendanceRecords.studentId, parseInt(studentId)));
        }
        if (classSessionId) {
            whereConditions.push(eq(attendanceRecords.classSessionId, parseInt(classSessionId)));
        }
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            const sessions = await db
                .select()
                .from(classSessions)
                .where(and(gte(classSessions.date, startDate), lte(classSessions.date, endDate)));
            if (sessions.length > 0) {
                whereConditions.push(sql `${attendanceRecords.classSessionId} IN (${sessions
                    .map((s) => s.id)
                    .join(",")})`);
            }
        }
        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
        const records = await db
            .select({
            record: attendanceRecords,
            student: {
                id: students.id,
                studentId: students.studentId,
                name: students.name,
                email: students.email,
            },
            session: {
                id: classSessions.id,
                date: classSessions.date,
                status: classSessions.status,
            },
        })
            .from(attendanceRecords)
            .innerJoin(students, eq(attendanceRecords.studentId, students.id))
            .innerJoin(classSessions, eq(attendanceRecords.classSessionId, classSessions.id))
            .where(whereClause)
            .orderBy(desc(attendanceRecords.createdAt))
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
        const stats = await attendanceMonitor.getAttendanceStats(sessionId);
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
router.post("/manual", requireAuth, async (req, res) => {
    try {
        const { studentId, classSessionId, entryTime, exitTime, notes } = req.body;
        if (!studentId || !classSessionId) {
            return res.status(400).json({
                success: false,
                message: "Student ID and Class Session ID are required",
            });
        }
        const existingRecord = await db
            .select()
            .from(attendanceRecords)
            .where(and(eq(attendanceRecords.studentId, studentId), eq(attendanceRecords.classSessionId, classSessionId)))
            .limit(1);
        if (existingRecord.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Attendance record already exists for this student and session",
            });
        }
        const [newRecord] = await db
            .insert(attendanceRecords)
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
    }
    catch (error) {
        console.error("Manual attendance entry error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { entryTime, exitTime, isValid, notes } = req.body;
        const [updatedRecord] = await db
            .update(attendanceRecords)
            .set({
            entryTime: entryTime ? new Date(entryTime) : undefined,
            exitTime: exitTime ? new Date(exitTime) : undefined,
            isValid,
            discrepancyFlag: !isValid,
            notes,
            updatedAt: new Date(),
        })
            .where(eq(attendanceRecords.id, recordId))
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
        const deletedRecord = await db
            .delete(attendanceRecords)
            .where(eq(attendanceRecords.id, recordId))
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
        const activeSessions = await db
            .select({
            session: classSessions,
            schedule: {
                id: schedules.id,
                subject: subjects.name,
                classroom: classrooms.name,
                faculty: users.name,
            },
        })
            .from(classSessions)
            .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
            .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
            .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
            .innerJoin(users, eq(schedules.facultyId, users.id))
            .where(and(eq(classSessions.status, "active"), gte(classSessions.date, new Date(now.getTime() - 2 * 60 * 60 * 1000)), lte(classSessions.date, new Date(now.getTime() + 2 * 60 * 60 * 1000))))
            .orderBy(classSessions.date);
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
        await attendanceMonitor.validateAttendanceRecord(recordId);
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
router.post("/simulate-rfid", requireAuth, async (req, res) => {
    try {
        const { rfidUid } = req.body;
        if (!rfidUid) {
            return res.status(400).json({
                success: false,
                message: "RFID UID is required",
            });
        }
        const result = await attendanceMonitor.processRFIDScan({
            deviceId: "simulator",
            rfidUid,
            timestamp: new Date().toISOString(),
        });
        if (result.success) {
            res.json({
                success: true,
                message: "RFID simulation successful",
                data: result,
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.message || "RFID simulation failed",
            });
        }
    }
    catch (error) {
        console.error("RFID simulation error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/simulate-rfid", requireAdmin, async (req, res) => {
    try {
        const { rfidUid } = req.body;
        if (!rfidUid) {
            return res.status(400).json({
                success: false,
                message: "RFID UID is required",
            });
        }
        const result = await attendanceMonitor.processRFIDScan({
            deviceId: "simulator",
            rfidUid,
            timestamp: new Date().toISOString(),
        });
        if (result.success) {
            res.json({
                success: true,
                message: "RFID simulation successful",
                data: result,
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.message || "RFID simulation failed",
            });
        }
    }
    catch (error) {
        console.error("Simulate RFID error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/simulate-sensor", requireAdmin, async (req, res) => {
    try {
        const { sensorType, distance = 50 } = req.body;
        if (!sensorType || !["entry", "exit"].includes(sensorType)) {
            return res.status(400).json({
                success: false,
                message: "Valid sensor type (entry/exit) is required",
            });
        }
        const result = await attendanceMonitor.processSensorTrigger({
            deviceId: "simulator",
            sensorType,
            distance,
            timestamp: new Date().toISOString(),
        });
        if (result.success) {
            res.json({
                success: true,
                message: "Sensor simulation successful",
                data: result,
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: result.message || "Sensor simulation failed",
            });
        }
    }
    catch (error) {
        console.error("Simulate sensor error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/:id/excuse", requireAdmin, async (req, res) => {
    try {
        const recordId = parseInt(req.params.id);
        const { reason } = req.body;
        const [updatedRecord] = await db
            .update(attendanceRecords)
            .set({
            status: "excused",
            notes: reason ? `Excused: ${reason}` : "Excused by administrator",
            updatedAt: new Date(),
        })
            .where(eq(attendanceRecords.id, recordId))
            .returning();
        if (!updatedRecord) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }
        res.json({
            success: true,
            message: "Attendance record excused successfully",
            record: updatedRecord,
        });
    }
    catch (error) {
        console.error("Excuse attendance error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/:studentId/contact", requireAdmin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId);
        const { message } = req.body;
        const student = await db
            .select()
            .from(students)
            .where(eq(students.id, studentId))
            .limit(1);
        if (!student.length) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }
        const studentData = student[0];
        console.log(`Contacting parent of ${studentData.name}: ${message}`);
        res.json({
            success: true,
            message: "Parent contacted successfully",
        });
    }
    catch (error) {
        console.error("Contact parent error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
export default router;
