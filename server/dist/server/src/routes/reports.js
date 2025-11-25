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
router.post("/generate", requireAuth, async (req, res) => {
    try {
        console.log("[REPORTS] Generate request:", req.body);
        const { type, format, startDate, endDate, classroomId, subjectId } = req.body;
        if (!type || !format) {
            console.log("[REPORTS] Missing type or format");
            return res.status(400).json({
                success: false,
                message: "Report type and format are required",
            });
        }
        let data;
        let filename;
        switch (type) {
            case "attendance":
                console.log("[REPORTS] Generating attendance report");
                data = await generateAttendanceReport(startDate, endDate, classroomId, subjectId);
                filename = `attendance-report-${new Date().toISOString().split("T")[0]}`;
                break;
            case "students":
                console.log("[REPORTS] Generating student report");
                data = await generateStudentReport(startDate, endDate);
                filename = `student-report-${new Date().toISOString().split("T")[0]}`;
                break;
            case "classroom":
                console.log("[REPORTS] Generating classroom report");
                data = await generateClassroomReport(startDate, endDate, classroomId);
                filename = `classroom-report-${new Date().toISOString().split("T")[0]}`;
                break;
            default:
                console.log("[REPORTS] Invalid report type:", type);
                return res.status(400).json({
                    success: false,
                    message: "Invalid report type",
                });
        }
        if (format === "csv") {
            const csvContent = convertToCSV(data);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
            res.send(csvContent);
        }
        else {
            res.json({
                success: true,
                data,
                message: "Report generated successfully",
            });
        }
    }
    catch (error) {
        console.error("Error generating report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate report",
        });
    }
});
router.get("/attendance/:sessionId", requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const records = await storage_js_1.db
            .select({
            record: schema_js_1.attendanceRecords,
            student: schema_js_1.students,
        })
            .from(schema_js_1.attendanceRecords)
            .innerJoin(schema_js_1.students, (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, schema_js_1.students.id))
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, parseInt(sessionId)))
            .orderBy(schema_js_1.attendanceRecords.createdAt);
        res.json({
            success: true,
            data: records,
        });
    }
    catch (error) {
        console.error("Error fetching attendance report:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance report",
        });
    }
});
router.get("/student/:studentId", async (req, res) => {
    try {
        const { studentId } = req.params;
        const { startDate, endDate } = req.query;
        let records;
        if (startDate && endDate) {
            records = await storage_js_1.db
                .select()
                .from(schema_js_1.attendanceRecords)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, parseInt(studentId)), (0, drizzle_orm_1.gte)(schema_js_1.attendanceRecords.createdAt, new Date(startDate)), (0, drizzle_orm_1.lte)(schema_js_1.attendanceRecords.createdAt, new Date(endDate))));
        }
        else {
            records = await storage_js_1.db
                .select()
                .from(schema_js_1.attendanceRecords)
                .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, parseInt(studentId)));
        }
        res.json(records);
    }
    catch (error) {
        console.error("Error fetching student report:", error);
        res.status(500).json({ error: "Failed to fetch student report" });
    }
});
router.get("/classroom/:classroomId", async (req, res) => {
    try {
        const { classroomId } = req.params;
        const { startDate, endDate } = req.query;
        let sessions;
        if (startDate && endDate) {
            sessions = await storage_js_1.db
                .select()
                .from(schema_js_1.classSessions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.classSessions.scheduleId, parseInt(classroomId)), (0, drizzle_orm_1.gte)(schema_js_1.classSessions.date, new Date(startDate)), (0, drizzle_orm_1.lte)(schema_js_1.classSessions.date, new Date(endDate))));
        }
        else {
            sessions = await storage_js_1.db
                .select()
                .from(schema_js_1.classSessions)
                .where((0, drizzle_orm_1.eq)(schema_js_1.classSessions.scheduleId, parseInt(classroomId)));
        }
        res.json(sessions);
    }
    catch (error) {
        console.error("Error fetching classroom report:", error);
        res.status(500).json({ error: "Failed to fetch classroom report" });
    }
});
async function generateAttendanceReport(startDate, endDate, classroomId, subjectId) {
    let whereConditions = [];
    if (startDate) {
        whereConditions.push((0, drizzle_orm_1.gte)(schema_js_1.attendanceRecords.createdAt, new Date(startDate)));
    }
    if (endDate) {
        whereConditions.push((0, drizzle_orm_1.lte)(schema_js_1.attendanceRecords.createdAt, new Date(endDate)));
    }
    const records = await storage_js_1.db
        .select({
        record: schema_js_1.attendanceRecords,
        student: schema_js_1.students,
        session: schema_js_1.classSessions,
        schedule: schema_js_1.schedules,
        subject: schema_js_1.subjects,
        classroom: schema_js_1.classrooms,
        faculty: schema_js_1.users,
    })
        .from(schema_js_1.attendanceRecords)
        .innerJoin(schema_js_1.students, (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, schema_js_1.students.id))
        .innerJoin(schema_js_1.classSessions, (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, schema_js_1.classSessions.id))
        .innerJoin(schema_js_1.schedules, (0, drizzle_orm_1.eq)(schema_js_1.classSessions.scheduleId, schema_js_1.schedules.id))
        .innerJoin(schema_js_1.subjects, (0, drizzle_orm_1.eq)(schema_js_1.schedules.subjectId, schema_js_1.subjects.id))
        .innerJoin(schema_js_1.classrooms, (0, drizzle_orm_1.eq)(schema_js_1.schedules.classroomId, schema_js_1.classrooms.id))
        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.schedules.facultyId, schema_js_1.users.id))
        .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.attendanceRecords.createdAt));
    return records;
}
async function generateStudentReport(startDate, endDate) {
    let whereConditions = [];
    if (startDate) {
        whereConditions.push((0, drizzle_orm_1.gte)(schema_js_1.attendanceRecords.createdAt, new Date(startDate)));
    }
    if (endDate) {
        whereConditions.push((0, drizzle_orm_1.lte)(schema_js_1.attendanceRecords.createdAt, new Date(endDate)));
    }
    const studentStats = await storage_js_1.db
        .select({
        student: schema_js_1.students,
        totalSessions: (0, drizzle_orm_1.count)(schema_js_1.attendanceRecords.id),
        presentCount: (0, drizzle_orm_1.sql) `count(case when ${schema_js_1.attendanceRecords.isValid} = true then 1 end)`,
        lateCount: (0, drizzle_orm_1.sql) `count(case when ${schema_js_1.attendanceRecords.isValid} = false and ${schema_js_1.attendanceRecords.rfidDetected} = true then 1 end)`,
        absentCount: (0, drizzle_orm_1.sql) `count(case when ${schema_js_1.attendanceRecords.isValid} = false and ${schema_js_1.attendanceRecords.rfidDetected} = false then 1 end)`,
    })
        .from(schema_js_1.students)
        .leftJoin(schema_js_1.attendanceRecords, (0, drizzle_orm_1.eq)(schema_js_1.students.id, schema_js_1.attendanceRecords.studentId))
        .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
        .groupBy(schema_js_1.students.id)
        .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.count)(schema_js_1.attendanceRecords.id)));
    return studentStats;
}
async function generateClassroomReport(startDate, endDate, classroomId) {
    let whereConditions = [];
    if (startDate) {
        whereConditions.push((0, drizzle_orm_1.gte)(schema_js_1.classSessions.date, new Date(startDate)));
    }
    if (endDate) {
        whereConditions.push((0, drizzle_orm_1.lte)(schema_js_1.classSessions.date, new Date(endDate)));
    }
    if (classroomId) {
        whereConditions.push((0, drizzle_orm_1.eq)(schema_js_1.schedules.classroomId, classroomId));
    }
    const classroomStats = await storage_js_1.db
        .select({
        classroom: schema_js_1.classrooms,
        subject: schema_js_1.subjects,
        faculty: schema_js_1.users,
        session: schema_js_1.classSessions,
        attendanceCount: (0, drizzle_orm_1.count)(schema_js_1.attendanceRecords.id),
        presentCount: (0, drizzle_orm_1.sql) `count(case when ${schema_js_1.attendanceRecords.isValid} = true then 1 end)`,
    })
        .from(schema_js_1.classSessions)
        .innerJoin(schema_js_1.schedules, (0, drizzle_orm_1.eq)(schema_js_1.classSessions.scheduleId, schema_js_1.schedules.id))
        .innerJoin(schema_js_1.classrooms, (0, drizzle_orm_1.eq)(schema_js_1.schedules.classroomId, schema_js_1.classrooms.id))
        .innerJoin(schema_js_1.subjects, (0, drizzle_orm_1.eq)(schema_js_1.schedules.subjectId, schema_js_1.subjects.id))
        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.schedules.facultyId, schema_js_1.users.id))
        .leftJoin(schema_js_1.attendanceRecords, (0, drizzle_orm_1.eq)(schema_js_1.classSessions.id, schema_js_1.attendanceRecords.classSessionId))
        .where(whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined)
        .groupBy(schema_js_1.classSessions.id, schema_js_1.classrooms.id, schema_js_1.subjects.id, schema_js_1.users.id)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.classSessions.date));
    return classroomStats;
}
function convertToCSV(data) {
    if (data.length === 0)
        return "";
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row)
        .map((value) => typeof value === "object" ? JSON.stringify(value) : String(value))
        .join(","));
    return [headers, ...rows].join("\n");
}
exports.default = router;
