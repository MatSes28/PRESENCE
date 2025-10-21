"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../../../shared/schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const allSchedules = await storage_js_1.db.select().from(schema_js_1.schedules);
        res.json(allSchedules);
    }
    catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({ error: "Failed to fetch schedules" });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const schedule = await storage_js_1.db
            .select()
            .from(schema_js_1.schedules)
            .where((0, drizzle_orm_1.eq)(schema_js_1.schedules.id, parseInt(id)));
        if (schedule.length === 0) {
            return res.status(404).json({ error: "Schedule not found" });
        }
        res.json(schedule[0]);
    }
    catch (error) {
        console.error("Error fetching schedule:", error);
        res.status(500).json({ error: "Failed to fetch schedule" });
    }
});
router.post("/", async (req, res) => {
    try {
        const { subjectId, classroomId, facultyId, dayOfWeek, startTime, endTime, semester, academicYear, } = req.body;
        const newSchedule = await storage_js_1.db
            .insert(schema_js_1.schedules)
            .values({
            subjectId,
            classroomId,
            facultyId,
            dayOfWeek,
            startTime,
            endTime,
            semester,
            academicYear,
        })
            .returning();
        res.status(201).json(newSchedule[0]);
    }
    catch (error) {
        console.error("Error creating schedule:", error);
        res.status(500).json({ error: "Failed to create schedule" });
    }
});
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { subjectId, classroomId, facultyId, dayOfWeek, startTime, endTime, semester, academicYear, } = req.body;
        const updatedSchedule = await storage_js_1.db
            .update(schema_js_1.schedules)
            .set({
            subjectId,
            classroomId,
            facultyId,
            dayOfWeek,
            startTime,
            endTime,
            semester,
            academicYear,
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.schedules.id, parseInt(id)))
            .returning();
        if (updatedSchedule.length === 0) {
            return res.status(404).json({ error: "Schedule not found" });
        }
        res.json(updatedSchedule[0]);
    }
    catch (error) {
        console.error("Error updating schedule:", error);
        res.status(500).json({ error: "Failed to update schedule" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedSchedule = await storage_js_1.db
            .delete(schema_js_1.schedules)
            .where((0, drizzle_orm_1.eq)(schema_js_1.schedules.id, parseInt(id)))
            .returning();
        if (deletedSchedule.length === 0) {
            return res.status(404).json({ error: "Schedule not found" });
        }
        res.json({ message: "Schedule deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting schedule:", error);
        res.status(500).json({ error: "Failed to delete schedule" });
    }
});
exports.default = router;
//# sourceMappingURL=schedules.js.map