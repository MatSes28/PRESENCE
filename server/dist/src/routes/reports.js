"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../../../shared/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get("/attendance/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const records = await storage_js_1.db
            .select()
            .from(schema_js_1.attendanceRecords)
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, parseInt(sessionId)));
        res.json(records);
    }
    catch (error) {
        console.error("Error fetching attendance report:", error);
        res.status(500).json({ error: "Failed to fetch attendance report" });
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
exports.default = router;
