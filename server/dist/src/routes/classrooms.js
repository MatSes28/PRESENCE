"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../../../shared/schema.js");
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
        const { name, location, capacity } = req.body;
        const newClassroom = await storage_js_1.db
            .insert(schema_js_1.classrooms)
            .values({
            name,
            location,
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
//# sourceMappingURL=classrooms.js.map