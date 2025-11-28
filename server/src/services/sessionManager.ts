import { db } from "../storage.js";
import {
  classSessions,
  schedules,
  subjects,
  enrollments,
  subjectSessions,
  sessionAssignments,
} from "../schema.js";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { cacheService } from "./cacheService.js";

interface SessionTemplate {
  subjectId: number;
  classroomId: number;
  facultyId: number;
  sessionDate: Date;
  layoutConfig?: any;
  notes?: string;
}

interface BulkSessionOperation {
  sessionIds: number[];
  action: "update" | "delete" | "assign_faculty";
  updates?: any;
  facultyId?: number;
}

class SessionManager {
  // Template Management using subjectSessions
  async createSessionTemplate(template: SessionTemplate): Promise<any> {
    const [newSession] = await db
      .insert(subjectSessions)
      .values({
        subjectId: template.subjectId,
        classroomId: template.classroomId,
        facultyId: template.facultyId,
        sessionDate: template.sessionDate,
        layoutConfig: template.layoutConfig,
        status: "active",
        notes: template.notes,
      })
      .returning();

    // Invalidate cache
    await cacheService.invalidateSchedules(template.facultyId);

    return newSession;
  }

  async getSessionTemplates(facultyId?: number): Promise<any[]> {
    const cacheKey = facultyId
      ? `session_templates:faculty:${facultyId}`
      : "session_templates:all";

    // Try cache first
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    let templates;
    if (facultyId) {
      templates = await db
        .select()
        .from(subjectSessions)
        .where(eq(subjectSessions.facultyId, facultyId))
        .orderBy(desc(subjectSessions.createdAt));
    } else {
      templates = await db
        .select()
        .from(subjectSessions)
        .orderBy(desc(subjectSessions.createdAt));
    }

    // Cache for 10 minutes
    await cacheService.set(cacheKey, templates, { ttl: 600 });
    return templates;
  }

  // Bulk Session Management
  async bulkUpdateSessions(operations: BulkSessionOperation[]): Promise<any> {
    const results = [];

    for (const operation of operations) {
      switch (operation.action) {
        case "update":
          const updated = await db
            .update(classSessions)
            .set(operation.updates)
            .where(inArray(classSessions.id, operation.sessionIds))
            .returning();
          results.push({ action: "update", data: updated });
          break;

        case "delete":
          await db
            .delete(classSessions)
            .where(inArray(classSessions.id, operation.sessionIds));
          results.push({
            action: "delete",
            count: operation.sessionIds.length,
          });
          break;

        case "assign_faculty":
          if (operation.facultyId) {
            // Update schedules for these sessions
            const sessionSchedules = await db
              .select({
                scheduleId: classSessions.scheduleId,
              })
              .from(classSessions)
              .where(inArray(classSessions.id, operation.sessionIds));

            const scheduleIds = [
              ...new Set(sessionSchedules.map((s) => s.scheduleId)),
            ];

            const updatedSchedules = await db
              .update(schedules)
              .set({ facultyId: operation.facultyId })
              .where(inArray(schedules.id, scheduleIds))
              .returning();

            results.push({ action: "assign_faculty", data: updatedSchedules });
          }
          break;
      }
    }

    return results;
  }

  // Recurring Session Creation
  async createRecurringSessions(
    subjectId: number,
    classroomId: number,
    facultyId: number,
    startDate: Date,
    endDate: Date,
    dayOfWeek: number,
    startTime: string,
    endTime: string
  ): Promise<any[]> {
    const sessions = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Check if it's the correct day of week
      if (currentDate.getDay() === dayOfWeek) {
        // Skip weekends if specified
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Check if session already exists
        const existingSchedule = await db
          .select()
          .from(schedules)
          .where(
            and(
              eq(schedules.subjectId, subjectId),
              eq(schedules.classroomId, classroomId),
              eq(schedules.facultyId, facultyId),
              eq(schedules.dayOfWeek, dayOfWeek),
              eq(schedules.startTime, startTime),
              eq(schedules.endTime, endTime)
            )
          )
          .limit(1);

        let scheduleId: number;

        if (existingSchedule.length > 0) {
          scheduleId = existingSchedule[0].id;
        } else {
          // Create schedule
          const [newSchedule] = await db
            .insert(schedules)
            .values({
              subjectId,
              classroomId,
              facultyId,
              dayOfWeek,
              startTime,
              endTime,
              semester: this.getCurrentSemester(),
              academicYear: this.getCurrentAcademicYear(),
            })
            .returning();

          scheduleId = newSchedule.id;
        }

        // Check if class session already exists for this date
        const existingSession = await db
          .select()
          .from(classSessions)
          .where(
            and(
              eq(classSessions.scheduleId, scheduleId),
              eq(classSessions.date, currentDate)
            )
          )
          .limit(1);

        if (existingSession.length === 0) {
          // Create class session
          const [newSession] = await db
            .insert(classSessions)
            .values({
              scheduleId,
              date: new Date(currentDate),
              status: "scheduled",
            })
            .returning();

          sessions.push(newSession);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return sessions;
  }

  // Analytics and Reporting
  async getSessionAnalytics(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const cacheKey = `session_analytics:${facultyId || "all"}:${
      startDate?.toISOString() || "none"
    }:${endDate?.toISOString() || "none"}`;

    // Try cache first
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];

    if (facultyId) {
      conditions.push(eq(schedules.facultyId, facultyId));
    }

    if (startDate) {
      conditions.push(gte(classSessions.date, startDate));
    }

    if (endDate) {
      conditions.push(lte(classSessions.date, endDate));
    }

    const sessions = await db
      .select({
        session: classSessions,
        schedule: schedules,
        subject: subjects,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const analytics = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(
        (s) => s.session.status === "completed"
      ).length,
      upcomingSessions: sessions.filter((s) => s.session.status === "scheduled")
        .length,
      cancelledSessions: sessions.filter(
        (s) => s.session.status === "cancelled"
      ).length,
      sessionsBySubject: this.groupBySubject(sessions),
      sessionsByMonth: this.groupByMonth(sessions),
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, analytics, { ttl: 300 });
    return analytics;
  }

  private getCurrentSemester(): string {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 || month <= 5 ? "2nd Semester" : "1st Semester";
  }

  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  private groupBySubject(sessions: any[]): Record<string, number> {
    return sessions.reduce((acc, session) => {
      const subjectName = session.subject.name;
      acc[subjectName] = (acc[subjectName] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByMonth(sessions: any[]): Record<string, number> {
    return sessions.reduce((acc, session) => {
      const month = session.session.date.toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
  }
}

export const sessionManager = new SessionManager();
