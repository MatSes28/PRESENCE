"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const drizzle_orm_2 = require("drizzle-orm");
const multer_1 = __importDefault(require("multer"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    next();
};
router.get("/", async (req, res) => {
    try {
        const allSchedules = await storage_js_1.db
            .select({
            id: schema_js_1.schedules.id,
            subjectId: schema_js_1.schedules.subjectId,
            subjectName: schema_js_1.subjects.name,
            classroomId: schema_js_1.schedules.classroomId,
            classroomName: schema_js_1.classrooms.name,
            facultyId: schema_js_1.schedules.facultyId,
            facultyName: (0, drizzle_orm_2.sql) `CONCAT(${schema_js_1.users.firstName}, ' ', ${schema_js_1.users.lastName})`,
            dayOfWeek: schema_js_1.schedules.dayOfWeek,
            startTime: schema_js_1.schedules.startTime,
            endTime: schema_js_1.schedules.endTime,
            semester: schema_js_1.schedules.semester,
            academicYear: schema_js_1.schedules.academicYear,
            createdAt: schema_js_1.schedules.createdAt,
        })
            .from(schema_js_1.schedules)
            .innerJoin(schema_js_1.subjects, (0, drizzle_orm_1.eq)(schema_js_1.schedules.subjectId, schema_js_1.subjects.id))
            .innerJoin(schema_js_1.classrooms, (0, drizzle_orm_1.eq)(schema_js_1.schedules.classroomId, schema_js_1.classrooms.id))
            .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.schedules.facultyId, schema_js_1.users.id))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.schedules.createdAt));
        res.json({
            success: true,
            data: allSchedules,
        });
    }
    catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch schedules",
        });
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
router.post("/upload-csv", requireAuth, upload.single("csv"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No CSV file provided",
            });
        }
        const results = [];
        const stream = stream_1.Readable.from(req.file.buffer.toString());
        stream
            .pipe((0, csv_parser_1.default)())
            .on("data", (data) => results.push(data))
            .on("end", async () => {
            try {
                let imported = 0;
                let errors = 0;
                for (const row of results) {
                    try {
                        const subject = await storage_js_1.db
                            .select()
                            .from(schema_js_1.subjects)
                            .where((0, drizzle_orm_1.eq)(schema_js_1.subjects.code, row.subjectCode))
                            .limit(1);
                        const classroom = await storage_js_1.db
                            .select()
                            .from(schema_js_1.classrooms)
                            .where((0, drizzle_orm_1.eq)(schema_js_1.classrooms.name, row.classroomName))
                            .limit(1);
                        const faculty = await storage_js_1.db
                            .select()
                            .from(schema_js_1.users)
                            .where((0, drizzle_orm_1.eq)(schema_js_1.users.email, row.facultyEmail))
                            .limit(1);
                        if (subject.length === 0 ||
                            classroom.length === 0 ||
                            faculty.length === 0) {
                            errors++;
                            continue;
                        }
                        const dayMap = {
                            sunday: 0,
                            monday: 1,
                            tuesday: 2,
                            wednesday: 3,
                            thursday: 4,
                            friday: 5,
                            saturday: 6,
                        };
                        const dayOfWeek = dayMap[row.dayOfWeek?.toLowerCase()] ?? 1;
                        await storage_js_1.db.insert(schema_js_1.schedules).values({
                            subjectId: subject[0].id,
                            classroomId: classroom[0].id,
                            facultyId: faculty[0].id,
                            dayOfWeek,
                            startTime: row.startTime,
                            endTime: row.endTime,
                            semester: row.semester,
                            academicYear: row.academicYear,
                        });
                        imported++;
                    }
                    catch (error) {
                        console.error("Error importing row:", error, row);
                        errors++;
                    }
                }
                res.json({
                    success: true,
                    message: `Imported ${imported} schedules, ${errors} errors`,
                    imported,
                    errors,
                });
            }
            catch (error) {
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
    }
    catch (error) {
        console.error("CSV upload error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.default = router;
