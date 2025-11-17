import { Router } from "express";
import { db } from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
  subjects,
  classrooms,
  users,
} from "../schema.js";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";

const router = Router();

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

// Generate comprehensive attendance report
router.post("/generate", requireAuth, async (req, res) => {
  try {
    console.log("[REPORTS] Generate request:", req.body);
    const { type, format, startDate, endDate, classroomId, subjectId } =
      req.body;

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
        data = await generateAttendanceReport(
          startDate,
          endDate,
          classroomId,
          subjectId
        );
        filename = `attendance-report-${
          new Date().toISOString().split("T")[0]
        }`;
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
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.csv"`
      );
      res.send(csvContent);
    } else {
      // For now, return JSON. In production, you'd generate PDF
      res.json({
        success: true,
        data,
        message: "Report generated successfully",
      });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
});

// Get attendance report for a class session
router.get("/attendance/:sessionId", requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const records = await db
      .select({
        record: attendanceRecords,
        student: students,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .where(eq(attendanceRecords.classSessionId, parseInt(sessionId)))
      .orderBy(attendanceRecords.createdAt);

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching attendance report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance report",
    });
  }
});

// Get student attendance summary
router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    let records;
    if (startDate && endDate) {
      records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, parseInt(studentId)),
            gte(attendanceRecords.createdAt, new Date(startDate as string)),
            lte(attendanceRecords.createdAt, new Date(endDate as string))
          )
        );
    } else {
      records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.studentId, parseInt(studentId)));
    }
    res.json(records);
  } catch (error) {
    console.error("Error fetching student report:", error);
    res.status(500).json({ error: "Failed to fetch student report" });
  }
});

// Get classroom utilization report
router.get("/classroom/:classroomId", async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { startDate, endDate } = req.query;

    let sessions;
    if (startDate && endDate) {
      sessions = await db
        .select()
        .from(classSessions)
        .where(
          and(
            eq(classSessions.scheduleId, parseInt(classroomId)),
            gte(classSessions.date, new Date(startDate as string)),
            lte(classSessions.date, new Date(endDate as string))
          )
        );
    } else {
      sessions = await db
        .select()
        .from(classSessions)
        .where(eq(classSessions.scheduleId, parseInt(classroomId)));
    }
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching classroom report:", error);
    res.status(500).json({ error: "Failed to fetch classroom report" });
  }
});

// Helper functions for report generation
async function generateAttendanceReport(
  startDate?: string,
  endDate?: string,
  classroomId?: number,
  subjectId?: number
) {
  let whereConditions = [];

  if (startDate) {
    whereConditions.push(gte(attendanceRecords.createdAt, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(attendanceRecords.createdAt, new Date(endDate)));
  }

  const records = await db
    .select({
      record: attendanceRecords,
      student: students,
      session: classSessions,
      schedule: schedules,
      subject: subjects,
      classroom: classrooms,
      faculty: users,
    })
    .from(attendanceRecords)
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .innerJoin(
      classSessions,
      eq(attendanceRecords.classSessionId, classSessions.id)
    )
    .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
    .innerJoin(users, eq(schedules.facultyId, users.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(attendanceRecords.createdAt));

  return records;
}

async function generateStudentReport(startDate?: string, endDate?: string) {
  let whereConditions = [];

  if (startDate) {
    whereConditions.push(gte(attendanceRecords.createdAt, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(attendanceRecords.createdAt, new Date(endDate)));
  }

  const studentStats = await db
    .select({
      student: students,
      totalSessions: count(attendanceRecords.id),
      presentCount: sql<number>`count(case when ${attendanceRecords.isValid} = true then 1 end)`,
      lateCount: sql<number>`count(case when ${attendanceRecords.isValid} = false and ${attendanceRecords.rfidDetected} = true then 1 end)`,
      absentCount: sql<number>`count(case when ${attendanceRecords.isValid} = false and ${attendanceRecords.rfidDetected} = false then 1 end)`,
    })
    .from(students)
    .leftJoin(attendanceRecords, eq(students.id, attendanceRecords.studentId))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(students.id)
    .orderBy(desc(count(attendanceRecords.id)));

  return studentStats;
}

async function generateClassroomReport(
  startDate?: string,
  endDate?: string,
  classroomId?: number
) {
  let whereConditions = [];

  if (startDate) {
    whereConditions.push(gte(classSessions.date, new Date(startDate)));
  }
  if (endDate) {
    whereConditions.push(lte(classSessions.date, new Date(endDate)));
  }
  if (classroomId) {
    whereConditions.push(eq(schedules.classroomId, classroomId));
  }

  const classroomStats = await db
    .select({
      classroom: classrooms,
      subject: subjects,
      faculty: users,
      session: classSessions,
      attendanceCount: count(attendanceRecords.id),
      presentCount: sql<number>`count(case when ${attendanceRecords.isValid} = true then 1 end)`,
    })
    .from(classSessions)
    .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
    .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
    .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
    .innerJoin(users, eq(schedules.facultyId, users.id))
    .leftJoin(
      attendanceRecords,
      eq(classSessions.id, attendanceRecords.classSessionId)
    )
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(classSessions.id, classrooms.id, subjects.id, users.id)
    .orderBy(desc(classSessions.date));

  return classroomStats;
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((value) =>
        typeof value === "object" ? JSON.stringify(value) : String(value)
      )
      .join(",")
  );

  return [headers, ...rows].join("\n");
}

export default router;
