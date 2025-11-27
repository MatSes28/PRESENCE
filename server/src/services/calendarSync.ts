import { db } from "../storage.js";
import {
  schedules,
  subjects,
  users,
  classrooms,
  classSessions,
} from "../schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location: string;
  attendees?: string[];
  calendarId: string;
  externalId?: string;
  lastSynced?: Date;
}

interface CalendarConfig {
  provider: "google" | "outlook";
  calendarId: string;
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
}

interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

class CalendarSyncService {
  private configs = new Map<string, CalendarConfig>();

  // Configure calendar integration
  setCalendarConfig(userId: string, config: CalendarConfig): void {
    this.configs.set(userId, config);
  }

  getCalendarConfig(userId: string): CalendarConfig | undefined {
    return this.configs.get(userId);
  }

  // Sync schedules to external calendar
  async syncSchedulesToCalendar(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SyncResult> {
    const config = this.getCalendarConfig(userId);
    if (!config) {
      throw new Error("Calendar configuration not found");
    }

    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Get schedules for the user
      const schedulesData = await this.getUserSchedules(
        userId,
        startDate,
        endDate
      );

      // Convert schedules to calendar events
      const calendarEvents = await this.convertSchedulesToEvents(schedulesData);

      // Sync with external calendar
      const syncResult = await this.syncWithExternalCalendar(
        config,
        calendarEvents
      );

      result.created = syncResult.created;
      result.updated = syncResult.updated;
      result.deleted = syncResult.deleted;
    } catch (error) {
      result.errors.push(`Sync failed: ${error.message}`);
    }

    return result;
  }

  // Sync from external calendar to schedules
  async syncCalendarToSchedules(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SyncResult> {
    const config = this.getCalendarConfig(userId);
    if (!config) {
      throw new Error("Calendar configuration not found");
    }

    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Get events from external calendar
      const externalEvents = await this.getExternalCalendarEvents(
        config,
        startDate,
        endDate
      );

      // Convert calendar events to schedules
      const schedulesData = await this.convertEventsToSchedules(
        externalEvents,
        userId
      );

      // Save/update schedules in database
      for (const schedule of schedulesData) {
        try {
          if (schedule.id) {
            // Update existing
            await db
              .update(schedules)
              .set(schedule)
              .where(eq(schedules.id, schedule.id));
            result.updated++;
          } else {
            // Create new
            await db.insert(schedules).values(schedule);
            result.created++;
          }
        } catch (error) {
          result.errors.push(`Failed to save schedule: ${error.message}`);
        }
      }
    } catch (error) {
      result.errors.push(`Sync failed: ${error.message}`);
    }

    return result;
  }

  // Get user's schedules for calendar sync
  private async getUserSchedules(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return await db
      .select({
        schedule: schedules,
        subject: subjects,
        classroom: classrooms,
        faculty: users,
      })
      .from(schedules)
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(classrooms, eq(schedules.classroomId, classrooms.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
      .where(
        and(
          eq(schedules.facultyId, parseInt(userId)),
          gte(schedules.createdAt, startDate),
          lte(schedules.createdAt, endDate)
        )
      );
  }

  // Convert schedules to calendar events
  private async convertSchedulesToEvents(
    schedulesData: any[]
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];

    for (const item of schedulesData) {
      const { schedule, subject, classroom, faculty } = item;

      // Get upcoming sessions for this schedule
      const sessions = await db
        .select()
        .from(classSessions)
        .where(
          and(
            eq(classSessions.scheduleId, schedule.id),
            gte(classSessions.date, new Date())
          )
        )
        .limit(10); // Next 10 sessions

      for (const session of sessions) {
        const eventDate = new Date(session.date);
        const [startHour, startMinute] = schedule.startTime
          .split(":")
          .map(Number);
        const [endHour, endMinute] = schedule.endTime.split(":").map(Number);

        const startTime = new Date(eventDate);
        startTime.setHours(startHour, startMinute, 0, 0);

        const endTime = new Date(eventDate);
        endTime.setHours(endHour, endMinute, 0, 0);

        events.push({
          id: `session_${session.id}`,
          title: `${subject.name} - ${classroom.name}`,
          description: `Class session with ${faculty.firstName} ${faculty.lastName}`,
          startTime,
          endTime,
          location: classroom.location || classroom.name,
          attendees: [], // Could include enrolled students
          calendarId: schedule.facultyId.toString(),
          externalId: session.id.toString(),
        });
      }
    }

    return events;
  }

  // Sync events with external calendar
  private async syncWithExternalCalendar(
    config: CalendarConfig,
    events: CalendarEvent[]
  ): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    if (config.provider === "google") {
      return await this.syncWithGoogleCalendar(config, events);
    } else if (config.provider === "outlook") {
      return await this.syncWithOutlookCalendar(config, events);
    }

    result.errors.push("Unsupported calendar provider");
    return result;
  }

  // Google Calendar integration
  private async syncWithGoogleCalendar(
    config: CalendarConfig,
    events: CalendarEvent[]
  ): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // In a real implementation, you would:
      // 1. Use Google Calendar API
      // 2. Authenticate with OAuth2
      // 3. Create/update/delete events

      // For now, simulate the sync
      for (const event of events) {
        try {
          // Simulate API call
          console.log(`Syncing event to Google Calendar: ${event.title}`);

          // Check if event exists
          const exists = await this.checkGoogleEventExists(
            config,
            event.externalId
          );

          if (exists) {
            await this.updateGoogleEvent(config, event);
            result.updated++;
          } else {
            await this.createGoogleEvent(config, event);
            result.created++;
          }
        } catch (error) {
          result.errors.push(
            `Failed to sync event ${event.id}: ${error.message}`
          );
        }
      }
    } catch (error) {
      result.errors.push(`Google Calendar sync failed: ${error.message}`);
    }

    return result;
  }

  // Outlook Calendar integration
  private async syncWithOutlookCalendar(
    config: CalendarConfig,
    events: CalendarEvent[]
  ): Promise<SyncResult> {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // In a real implementation, you would:
      // 1. Use Microsoft Graph API
      // 2. Authenticate with OAuth2
      // 3. Create/update/delete events

      // For now, simulate the sync
      for (const event of events) {
        try {
          console.log(`Syncing event to Outlook Calendar: ${event.title}`);

          const exists = await this.checkOutlookEventExists(
            config,
            event.externalId
          );

          if (exists) {
            await this.updateOutlookEvent(config, event);
            result.updated++;
          } else {
            await this.createOutlookEvent(config, event);
            result.created++;
          }
        } catch (error) {
          result.errors.push(
            `Failed to sync event ${event.id}: ${error.message}`
          );
        }
      }
    } catch (error) {
      result.errors.push(`Outlook Calendar sync failed: ${error.message}`);
    }

    return result;
  }

  // Get events from external calendar
  private async getExternalCalendarEvents(
    config: CalendarConfig,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    if (config.provider === "google") {
      return await this.getGoogleCalendarEvents(config, startDate, endDate);
    } else if (config.provider === "outlook") {
      return await this.getOutlookCalendarEvents(config, startDate, endDate);
    }

    return [];
  }

  // Convert calendar events to schedules
  private async convertEventsToSchedules(
    events: any[],
    userId: string
  ): Promise<any[]> {
    const schedules = [];

    for (const event of events) {
      // Only process events that look like class schedules
      if (this.isClassEvent(event)) {
        const schedule = {
          subjectId: await this.findOrCreateSubject(event.title),
          classroomId: await this.findOrCreateClassroom(event.location),
          facultyId: parseInt(userId),
          dayOfWeek: event.startTime.getDay(),
          startTime: event.startTime.toTimeString().slice(0, 5),
          endTime: event.endTime.toTimeString().slice(0, 5),
          semester: this.detectSemester(event.startTime),
          academicYear: event.startTime.getFullYear().toString(),
          externalCalendarId: event.id,
          lastSynced: new Date(),
        };

        schedules.push(schedule);
      }
    }

    return schedules;
  }

  // Helper methods for Google Calendar
  private async checkGoogleEventExists(
    config: CalendarConfig,
    externalId?: string
  ): Promise<boolean> {
    // Simulate API call
    return Math.random() > 0.5;
  }

  private async createGoogleEvent(
    config: CalendarConfig,
    event: CalendarEvent
  ): Promise<void> {
    // Simulate API call
    console.log(`Creating Google Calendar event: ${event.title}`);
  }

  private async updateGoogleEvent(
    config: CalendarConfig,
    event: CalendarEvent
  ): Promise<void> {
    // Simulate API call
    console.log(`Updating Google Calendar event: ${event.title}`);
  }

  private async getGoogleCalendarEvents(
    config: CalendarConfig,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Simulate API call
    return [];
  }

  // Helper methods for Outlook Calendar
  private async checkOutlookEventExists(
    config: CalendarConfig,
    externalId?: string
  ): Promise<boolean> {
    // Simulate API call
    return Math.random() > 0.5;
  }

  private async createOutlookEvent(
    config: CalendarConfig,
    event: CalendarEvent
  ): Promise<void> {
    // Simulate API call
    console.log(`Creating Outlook Calendar event: ${event.title}`);
  }

  private async updateOutlookEvent(
    config: CalendarConfig,
    event: CalendarEvent
  ): Promise<void> {
    // Simulate API call
    console.log(`Updating Outlook Calendar event: ${event.title}`);
  }

  private async getOutlookCalendarEvents(
    config: CalendarConfig,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Simulate API call
    return [];
  }

  // Utility methods
  private isClassEvent(event: any): boolean {
    // Simple heuristic to identify class events
    const title = event.title?.toLowerCase() || "";
    const description = event.description?.toLowerCase() || "";

    return (
      title.includes("class") ||
      title.includes("lecture") ||
      title.includes("lab") ||
      description.includes("class") ||
      description.includes("lecture") ||
      description.includes("lab")
    );
  }

  private async findOrCreateSubject(title: string): Promise<number> {
    // Try to extract subject name from title
    const subjectName = title.split(" - ")[0]?.trim();

    // Look for existing subject
    const existing = await db
      .select()
      .from(subjects)
      .where(eq(subjects.name, subjectName))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Create new subject
    const [newSubject] = await db
      .insert(subjects)
      .values({
        name: subjectName,
        code: subjectName.substring(0, 3).toUpperCase(),
        description: `Auto-created from calendar sync`,
      })
      .returning();

    return newSubject.id;
  }

  private async findOrCreateClassroom(location: string): Promise<number> {
    // Look for existing classroom
    const existing = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.name, location))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Create new classroom
    const [newClassroom] = await db
      .insert(classrooms)
      .values({
        name: location,
        location: location,
        capacity: 30, // Default capacity
      })
      .returning();

    return newClassroom.id;
  }

  private detectSemester(date: Date): string {
    const month = date.getMonth();
    // Simple semester detection
    return month >= 6 ? "2nd Semester" : "1st Semester";
  }

  // Get OAuth authorization URL
  getAuthorizationUrl(
    provider: "google" | "outlook",
    redirectUri: string
  ): string {
    const scopes = [
      "https://www.googleapis.com/auth/calendar.events", // Google
      "https://graph.microsoft.com/Calendars.ReadWrite", // Outlook
    ];

    if (provider === "google") {
      const clientId = process.env.GOOGLE_CLIENT_ID || "";
      return (
        `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes[0])}&` +
        `response_type=code&` +
        `access_type=offline`
      );
    } else {
      const clientId = process.env.OUTLOOK_CLIENT_ID || "";
      return (
        `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes[1])}&` +
        `response_type=code`
      );
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(
    provider: "google" | "outlook",
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    // In a real implementation, exchange code for tokens
    // For now, return mock tokens
    return {
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
    };
  }
}

export const calendarSyncService = new CalendarSyncService();
