import { Router } from "express";
import db from "../storage.js";
import { academicHolidays } from "../schema.js";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  getPhilippinesGoogleHolidays,
  philippinesHolidayEmbedUrl,
} from "../services/googleHolidayFeed.js";

const router = Router();

router.get("/philippines", requireAuth, async (req, res) => {
  try {
    const parsedYear =
      typeof req.query.year === "string" && /^\d{4}$/.test(req.query.year)
        ? Number(req.query.year)
        : undefined;

    const holidays = await getPhilippinesGoogleHolidays(parsedYear);

    res.json({
      success: true,
      data: holidays,
      sourceUrl: philippinesHolidayEmbedUrl,
    });
  } catch (error) {
    console.error("Get Philippines holidays error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load Philippines holidays",
    });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { year } = req.query;
    const filters = [];

    if (typeof year === "string" && /^\d{4}$/.test(year)) {
      filters.push(gte(academicHolidays.holidayDate, `${year}-01-01`));
      filters.push(lte(academicHolidays.holidayDate, `${year}-12-31`));
    }

    const holidays = await db
      .select()
      .from(academicHolidays)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(academicHolidays.holidayDate), asc(academicHolidays.name));

    res.json({
      success: true,
      data: holidays,
    });
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { holidayDate, name, description, recursAnnually } = req.body;

    if (!holidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(holidayDate))) {
      return res.status(400).json({
        success: false,
        message: "Holiday date must be in YYYY-MM-DD format",
      });
    }

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Holiday name is required",
      });
    }

    const existingHoliday = await db
      .select({ id: academicHolidays.id })
      .from(academicHolidays)
      .where(eq(academicHolidays.holidayDate, String(holidayDate)))
      .limit(1);

    if (existingHoliday.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A holiday already exists for that date",
      });
    }

    const [createdHoliday] = await db
      .insert(academicHolidays)
      .values({
        holidayDate: String(holidayDate),
        name: String(name).trim(),
        description:
          typeof description === "string" && description.trim() !== ""
            ? description.trim()
            : null,
        recursAnnually: Boolean(recursAnnually),
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Holiday saved successfully",
      data: createdHoliday,
    });
  } catch (error: any) {
    console.error("Create holiday error:", error);

    if (
      error?.code === "23505" ||
      String(error?.message || "").includes("UNIQUE constraint failed")
    ) {
      return res.status(409).json({
        success: false,
        message: "A holiday already exists for that date",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const holidayId = Number(req.params.id);

    if (!Number.isFinite(holidayId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid holiday ID",
      });
    }

    const [deletedHoliday] = await db
      .delete(academicHolidays)
      .where(eq(academicHolidays.id, holidayId))
      .returning();

    if (!deletedHoliday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    res.json({
      success: true,
      message: "Holiday deleted successfully",
      data: deletedHoliday,
    });
  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
