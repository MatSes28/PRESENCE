import { Router } from "express";
import { db } from "../storage.js";
import { schedules, subjects, classrooms, users } from "../schema.js";
import { eq, desc, and, sql } from "drizzle-orm";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { scheduleManagerService } from "../services/scheduleManager.js";

const router = Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

// Get all schedules
router.get("/", async (req, res) => {
  try {
    const allSchedules = await db
      .select({
        id: schedules.id,
        subjectId: schedules.subjectId,
        subjectName: subjects.name,
        classroomId: schedules.classroomId,
        classroomName: classrooms.name,
        facultyId: schedules.facultyId,
        facultyName: users.name,
        dayOfWeek: schedules.dayOfWeek,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        semester: schedules.semester,
        academicYear: schedules.academicYear,
        createdAt: schedules.createdAt,
      })
      .from(schedules)
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .orderBy(desc(schedules.createdAt));

    res.json({
      success: true,
      data: allSchedules,
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedules",
    });
  }
});

// Get schedule by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, parseInt(id)));
    if (schedule.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(schedule[0]);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule" });
  }
});

// Create new schedule
router.post("/", async (req, res) => {
  try {
    const {
      subjectId,
      classroomId,
      facultyId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
      conflictResolutionPriority,
      allowRoomChange,
      allowTimeAdjustment,
    } = req.body;

    if (isRecurring) {
      // Create recurring schedule with automatic conflict resolution
      const scheduleId = await scheduleManagerService.createRecurringSchedule({
        subjectId,
        classroomId,
        facultyId,
        dayOfWeek,
        startTime,
        endTime,
        semester,
        academicYear,
        recurrencePattern,
        recurrenceEndDate: new Date(recurrenceEndDate),
        conflictResolutionPriority,
        allowRoomChange,
        allowTimeAdjustment,
      });

      const createdSchedule = await db
        .select()
        .from(schedules)
        .where(eq(schedules.id, scheduleId))
        .limit(1);

      res.status(201).json(createdSchedule[0]);
    } else {
      // Create regular schedule
      const newSchedule = await db
        .insert(schedules)
        .values({
          subjectId,
          classroomId,
          facultyId,
          dayOfWeek,
          startTime,
          endTime,
          semester,
          academicYear,
          isRecurring: false,
          conflictResolutionPriority: conflictResolutionPriority || 1,
          allowRoomChange: allowRoomChange || false,
          allowTimeAdjustment: allowTimeAdjustment || false,
        })
        .returning();
      res.status(201).json(newSchedule[0]);
    }
  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

// Update schedule
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subjectId,
      classroomId,
      facultyId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
    } = req.body;
    const updatedSchedule = await db
      .update(schedules)
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
      .where(eq(schedules.id, parseInt(id)))
      .returning();
    if (updatedSchedule.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(updatedSchedule[0]);
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

// Delete schedule
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSchedule = await db
      .delete(schedules)
      .where(eq(schedules.id, parseInt(id)))
      .returning();
    if (deletedSchedule.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

// CSV Upload endpoint
router.post(
  "/upload-csv",
  requireAuth,
  upload.single("csv"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No CSV file provided",
        });
      }

      const results: any[] = [];
      const stream = Readable.from(req.file.buffer.toString());

      stream
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          try {
            let imported = 0;
            let errors = 0;

            for (const row of results) {
              try {
                // Find subject by code
                const subject = await db
                  .select()
                  .from(subjects)
                  .where(eq(subjects.code, row.subjectCode))
                  .limit(1);

                // Find classroom by name
                const classroom = await db
                  .select()
                  .from(classrooms)
                  .where(eq(classrooms.name, row.classroomName))
                  .limit(1);

                // Find faculty by email
                const faculty = await db
                  .select()
                  .from(users)
                  .where(eq(users.email, row.facultyEmail))
                  .limit(1);

                if (
                  subject.length === 0 ||
                  classroom.length === 0 ||
                  faculty.length === 0
                ) {
                  errors++;
                  continue;
                }

                // Map day name to number
                const dayMap: { [key: string]: number } = {
                  sunday: 0,
                  monday: 1,
                  tuesday: 2,
                  wednesday: 3,
                  thursday: 4,
                  friday: 5,
                  saturday: 6,
                };
                const dayOfWeek = dayMap[row.dayOfWeek?.toLowerCase()] ?? 1;

                await db.insert(schedules).values({
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
              } catch (error) {
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
          } catch (error) {
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
    } catch (error) {
      console.error("CSV upload error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Check for schedule conflicts
router.post("/check-conflicts", requireAuth, async (req, res) => {
  try {
    const {
      subjectId,
      classroomId,
      facultyId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
      excludeId, // For updates, exclude the current schedule
    } = req.body;

    const conflicts = [];

    // Check classroom conflicts
    const classroomConflicts = await db
      .select({
        schedule: schedules,
        subjectName: subjects.name,
      })
      .from(schedules)
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(
        and(
          eq(schedules.classroomId, classroomId),
          eq(schedules.dayOfWeek, dayOfWeek),
          eq(schedules.semester, semester),
          eq(schedules.academicYear, academicYear),
          excludeId ? sql`${schedules.id} != ${excludeId}` : sql`1=1`
        )
      );

    // Check for time overlaps in classroom
    for (const conflict of classroomConflicts) {
      if (
        timeSlotsOverlap(
          startTime,
          endTime,
          conflict.schedule.startTime,
          conflict.schedule.endTime
        )
      ) {
        conflicts.push({
          type: "classroom",
          message: `Classroom conflict with ${conflict.subjectName} (${conflict.schedule.startTime}-${conflict.schedule.endTime})`,
          conflictingSchedule: conflict.schedule,
        });
      }
    }

    // Check faculty conflicts
    const facultyConflicts = await db
      .select({
        schedule: schedules,
        subjectName: subjects.name,
        classroomName: classrooms.name,
      })
      .from(schedules)
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .where(
        and(
          eq(schedules.facultyId, facultyId),
          eq(schedules.dayOfWeek, dayOfWeek),
          eq(schedules.semester, semester),
          eq(schedules.academicYear, academicYear),
          excludeId ? sql`${schedules.id} != ${excludeId}` : sql`1=1`
        )
      );

    // Check for time overlaps with faculty
    for (const conflict of facultyConflicts) {
      if (
        timeSlotsOverlap(
          startTime,
          endTime,
          conflict.schedule.startTime,
          conflict.schedule.endTime
        )
      ) {
        conflicts.push({
          type: "faculty",
          message: `Faculty conflict with ${conflict.subjectName} in ${conflict.classroomName} (${conflict.schedule.startTime}-${conflict.schedule.endTime})`,
          conflictingSchedule: conflict.schedule,
        });
      }
    }

    res.json({
      success: true,
      conflicts,
      hasConflicts: conflicts.length > 0,
    });
  } catch (error) {
    console.error("Check conflicts error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Helper function to check if two time slots overlap
function timeSlotsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
}

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default router;
