import db from "../storage.js";
import {
  schedules,
  classSessions,
  subjects,
  classrooms,
  users,
} from "../schema.js";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

interface RecurringScheduleOptions {
  subjectId: number;
  classroomId: number;
  facultyId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  semester: string;
  academicYear: string;
  recurrencePattern: "weekly" | "biweekly" | "monthly";
  recurrenceEndDate: Date;
  conflictResolutionPriority?: number;
  allowRoomChange?: boolean;
  allowTimeAdjustment?: boolean;
}

interface ConflictResolutionResult {
  resolved: boolean;
  suggestions: Array<{
    type: "room_change" | "time_adjustment" | "faculty_change";
    description: string;
    scheduleId?: number;
    newClassroomId?: number;
    newStartTime?: string;
    newEndTime?: string;
  }>;
  conflicts: Array<{
    type: "classroom" | "faculty";
    message: string;
    conflictingSchedule: any;
  }>;
}

class ScheduleManagerService {
  async createRecurringSchedule(
    options: RecurringScheduleOptions
  ): Promise<number> {
    // First, check for conflicts with the base schedule
    const conflicts = await this.checkScheduleConflicts({
      subjectId: options.subjectId,
      classroomId: options.classroomId,
      facultyId: options.facultyId,
      dayOfWeek: options.dayOfWeek,
      startTime: options.startTime,
      endTime: options.endTime,
      semester: options.semester,
      academicYear: options.academicYear,
    });

    if (conflicts.hasConflicts) {
      // Try to resolve conflicts automatically
      const resolution = await this.resolveConflictsAutomatically({
        ...options,
        conflicts: conflicts.conflicts,
      });

      if (!resolution.resolved) {
        throw new Error(
          "Cannot create recurring schedule due to unresolvable conflicts"
        );
      }

      // Apply the best resolution
      if (resolution.suggestions.length > 0) {
        const bestSuggestion = resolution.suggestions[0];
        if (
          bestSuggestion.type === "room_change" &&
          bestSuggestion.newClassroomId
        ) {
          options.classroomId = bestSuggestion.newClassroomId;
        } else if (
          bestSuggestion.type === "time_adjustment" &&
          bestSuggestion.newStartTime
        ) {
          options.startTime = bestSuggestion.newStartTime;
          options.endTime = bestSuggestion.newEndTime!;
        }
      }
    }

    // Create the recurring schedule
    const [newSchedule] = await db
      .insert(schedules)
      .values({
        subjectId: options.subjectId,
        classroomId: options.classroomId,
        facultyId: options.facultyId,
        dayOfWeek: options.dayOfWeek,
        startTime: options.startTime,
        endTime: options.endTime,
        semester: options.semester,
        academicYear: options.academicYear,
        isRecurring: true,
        recurrencePattern: options.recurrencePattern,
        recurrenceEndDate: options.recurrenceEndDate,
        recurrenceExceptions: [],
        conflictResolutionPriority: options.conflictResolutionPriority || 1,
        allowRoomChange: options.allowRoomChange || false,
        allowTimeAdjustment: options.allowTimeAdjustment || false,
      })
      .returning();

    // Generate class sessions for the recurring schedule
    await this.generateClassSessionsForRecurringSchedule(newSchedule.id);

    return newSchedule.id;
  }

  async generateClassSessionsForRecurringSchedule(
    scheduleId: number
  ): Promise<void> {
    const schedule = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId))
      .limit(1);

    if (!schedule.length || !schedule[0].isRecurring) {
      return;
    }

    const recurringSchedule = schedule[0];
    const sessions: any[] = [];
    const startDate = new Date();
    const endDate =
      recurringSchedule.recurrenceEndDate ||
      new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year default

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Check if this date matches the recurrence pattern
      if (currentDate.getDay() === recurringSchedule.dayOfWeek) {
        // Check if this date is in exceptions
        const exceptions =
          (recurringSchedule.recurrenceExceptions as string[]) || [];
        const dateStr = currentDate.toISOString().split("T")[0];

        if (!exceptions.includes(dateStr)) {
          // Check if session already exists
          const existingSession = await db
            .select()
            .from(classSessions)
            .where(
              and(
                eq(classSessions.scheduleId, scheduleId),
                sql`DATE(${classSessions.date}) = ${dateStr}`
              )
            )
            .limit(1);

          if (!existingSession.length) {
            sessions.push({
              scheduleId: scheduleId,
              date: currentDate,
              status: "scheduled",
            });
          }
        }
      }

      // Move to next occurrence based on pattern
      switch (recurringSchedule.recurrencePattern) {
        case "weekly":
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case "biweekly":
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    if (sessions.length > 0) {
      await db.insert(classSessions).values(sessions);
    }
  }

  async checkScheduleConflicts(options: {
    subjectId: number;
    classroomId: number;
    facultyId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    semester: string;
    academicYear: string;
    excludeId?: number;
  }): Promise<{ hasConflicts: boolean; conflicts: any[] }> {
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
          eq(schedules.classroomId, options.classroomId),
          eq(schedules.dayOfWeek, options.dayOfWeek),
          eq(schedules.semester, options.semester),
          eq(schedules.academicYear, options.academicYear),
          options.excludeId
            ? sql`${schedules.id} != ${options.excludeId}`
            : sql`1=1`
        )
      );

    // Check for time overlaps in classroom
    for (const conflict of classroomConflicts) {
      if (
        this.timeSlotsOverlap(
          options.startTime,
          options.endTime,
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
          eq(schedules.facultyId, options.facultyId),
          eq(schedules.dayOfWeek, options.dayOfWeek),
          eq(schedules.semester, options.semester),
          eq(schedules.academicYear, options.academicYear),
          options.excludeId
            ? sql`${schedules.id} != ${options.excludeId}`
            : sql`1=1`
        )
      );

    // Check for time overlaps with faculty
    for (const conflict of facultyConflicts) {
      if (
        this.timeSlotsOverlap(
          options.startTime,
          options.endTime,
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

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  async resolveConflictsAutomatically(options: {
    subjectId: number;
    classroomId: number;
    facultyId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    semester: string;
    academicYear: string;
    conflicts: any[];
    allowRoomChange?: boolean;
    allowTimeAdjustment?: boolean;
  }): Promise<ConflictResolutionResult> {
    const suggestions: ConflictResolutionResult["suggestions"] = [];

    // Try room change first if allowed
    if (options.allowRoomChange) {
      const availableRooms = await this.findAvailableRooms(
        options.dayOfWeek,
        options.startTime,
        options.endTime,
        options.semester,
        options.academicYear,
        options.classroomId
      );

      if (availableRooms.length > 0) {
        suggestions.push({
          type: "room_change",
          description: `Change to ${availableRooms[0].name} classroom`,
          newClassroomId: availableRooms[0].id,
        });
      }
    }

    // Try time adjustment if allowed
    if (options.allowTimeAdjustment) {
      const timeSuggestions = await this.findAvailableTimeSlots(
        options.classroomId,
        options.facultyId,
        options.dayOfWeek,
        options.startTime,
        options.endTime,
        options.semester,
        options.academicYear
      );

      for (const timeSlot of timeSuggestions.slice(0, 2)) {
        // Limit to 2 suggestions
        suggestions.push({
          type: "time_adjustment",
          description: `Adjust time to ${timeSlot.startTime}-${timeSlot.endTime}`,
          newStartTime: timeSlot.startTime,
          newEndTime: timeSlot.endTime,
        });
      }
    }

    return {
      resolved: suggestions.length > 0,
      suggestions,
      conflicts: options.conflicts,
    };
  }

  private async findAvailableRooms(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    semester: string,
    academicYear: string,
    excludeClassroomId: number
  ): Promise<any[]> {
    // Get all classrooms
    const allClassrooms = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.isActive, true));

    const availableRooms = [];

    for (const classroom of allClassrooms) {
      if (classroom.id === excludeClassroomId) continue;

      // Check if this classroom has conflicts at the given time
      const conflicts = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.classroomId, classroom.id),
            eq(schedules.dayOfWeek, dayOfWeek),
            eq(schedules.semester, semester),
            eq(schedules.academicYear, academicYear)
          )
        );

      let hasConflict = false;
      for (const conflict of conflicts) {
        if (
          this.timeSlotsOverlap(
            startTime,
            endTime,
            conflict.startTime,
            conflict.endTime
          )
        ) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        availableRooms.push(classroom);
      }
    }

    return availableRooms;
  }

  private async findAvailableTimeSlots(
    classroomId: number,
    facultyId: number,
    dayOfWeek: number,
    originalStart: string,
    originalEnd: string,
    semester: string,
    academicYear: string
  ): Promise<Array<{ startTime: string; endTime: string }>> {
    const availableSlots = [];
    const duration =
      this.timeToMinutes(originalEnd) - this.timeToMinutes(originalStart);

    // Try shifting by 30-minute increments (±2 hours)
    for (let offset = -120; offset <= 120; offset += 30) {
      if (offset === 0) continue; // Skip original time

      const newStartMinutes = this.timeToMinutes(originalStart) + offset;
      const newEndMinutes = newStartMinutes + duration;

      // Check if within reasonable hours (8 AM - 8 PM)
      if (newStartMinutes < 480 || newEndMinutes > 1200) continue;

      const newStartTime = this.minutesToTime(newStartMinutes);
      const newEndTime = this.minutesToTime(newEndMinutes);

      // Check for conflicts at new time
      const classroomConflicts = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.classroomId, classroomId),
            eq(schedules.dayOfWeek, dayOfWeek),
            eq(schedules.semester, semester),
            eq(schedules.academicYear, academicYear)
          )
        );

      const facultyConflicts = await db
        .select()
        .from(schedules)
        .where(
          and(
            eq(schedules.facultyId, facultyId),
            eq(schedules.dayOfWeek, dayOfWeek),
            eq(schedules.semester, semester),
            eq(schedules.academicYear, academicYear)
          )
        );

      let hasConflict = false;
      for (const conflict of [...classroomConflicts, ...facultyConflicts]) {
        if (
          this.timeSlotsOverlap(
            newStartTime,
            newEndTime,
            conflict.startTime,
            conflict.endTime
          )
        ) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        availableSlots.push({
          startTime: newStartTime,
          endTime: newEndTime,
        });
      }
    }

    return availableSlots.slice(0, 4); // Return up to 4 suggestions
  }

  private timeSlotsOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }

  async updateRecurringScheduleExceptions(
    scheduleId: number,
    exceptions: string[]
  ): Promise<void> {
    await db
      .update(schedules)
      .set({
        recurrenceExceptions: exceptions,
      })
      .where(eq(schedules.id, scheduleId));

    // Regenerate sessions to account for new exceptions
    await this.regenerateClassSessionsForSchedule(scheduleId);
  }

  private async regenerateClassSessionsForSchedule(
    scheduleId: number
  ): Promise<void> {
    // Delete existing future sessions
    await db
      .delete(classSessions)
      .where(
        and(
          eq(classSessions.scheduleId, scheduleId),
          gte(classSessions.date, new Date()),
          eq(classSessions.status, "scheduled")
        )
      );

    // Regenerate sessions
    await this.generateClassSessionsForRecurringSchedule(scheduleId);
  }
}

export const scheduleManagerService = new ScheduleManagerService();
