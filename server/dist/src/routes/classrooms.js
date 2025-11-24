"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    try {
        const allClassrooms = await storage_js_1.db.select().from(schema_js_1.classrooms);
        res.json(allClassrooms);
    }
    catch (error) {
        console.error("Error fetching classrooms:", error);
        res.status(500).json({ error: "Failed to fetch classrooms" });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const classroom = await storage_js_1.db
            .select()
            .from(schema_js_1.classrooms)
            .where((0, drizzle_orm_1.eq)(schema_js_1.classrooms.id, parseInt(id)));
        if (classroom.length === 0) {
            return res.status(404).json({ error: "Classroom not found" });
        }
        res.json(classroom[0]);
    }
    catch (error) {
        console.error("Error fetching classroom:", error);
        res.status(500).json({ error: "Failed to fetch classroom" });
    }
});
router.post("/", async (req, res) => {
    try {
        const { name, type, capacity } = req.body;
        if (!["lecture", "laboratory"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Classroom type must be 'lecture' or 'laboratory'",
            });
        }
        const existingClassrooms = await storage_js_1.db.select().from(schema_js_1.classrooms);
        if (existingClassrooms.length >= 4) {
            return res.status(400).json({
                success: false,
                message: "Maximum of 4 classrooms allowed (2 lecture, 2 lab rooms)",
            });
        }
        const lectureCount = existingClassrooms.filter((c) => c.type === "lecture").length;
        const labCount = existingClassrooms.filter((c) => c.type === "laboratory").length;
        if (type === "lecture" && lectureCount >= 2) {
            return res.status(400).json({
                success: false,
                message: "Maximum of 2 lecture rooms allowed",
            });
        }
        if (type === "laboratory" && labCount >= 2) {
            return res.status(400).json({
                success: false,
                message: "Maximum of 2 laboratory rooms allowed",
            });
        }
        const newClassroom = await storage_js_1.db
            .insert(schema_js_1.classrooms)
            .values({
            name,
            location: "CLIRDEC Building",
            type,
            capacity,
        })
            .returning();
        res.status(201).json(newClassroom[0]);
    }
    catch (error) {
        console.error("Error creating classroom:", error);
        res.status(500).json({ error: "Failed to create classroom" });
    }
});
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, capacity } = req.body;
        const updatedClassroom = await storage_js_1.db
            .update(schema_js_1.classrooms)
            .set({ name, location, capacity })
            .where((0, drizzle_orm_1.eq)(schema_js_1.classrooms.id, parseInt(id)))
            .returning();
        if (updatedClassroom.length === 0) {
            return res.status(404).json({ error: "Classroom not found" });
        }
        res.json(updatedClassroom[0]);
    }
    catch (error) {
        console.error("Error updating classroom:", error);
        res.status(500).json({ error: "Failed to update classroom" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedClassroom = await storage_js_1.db
            .delete(schema_js_1.classrooms)
            .where((0, drizzle_orm_1.eq)(schema_js_1.classrooms.id, parseInt(id)))
            .returning();
        if (deletedClassroom.length === 0) {
            return res.status(404).json({ error: "Classroom not found" });
        }
        res.json({ message: "Classroom deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting classroom:", error);
        res.status(500).json({ error: "Failed to delete classroom" });
    }
});
exports.default = router;
