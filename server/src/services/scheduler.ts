import cron from "node-cron";
import { db } from "../storage.js";
import { classSessions, schedules } from "../schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

class SessionScheduler {
  private isRunning = false;

  start() {
    if (this.isRunning) {
      console.log("Session scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting session scheduler...");

    // Run every day at 6 AM to create sessions for the day
    cron.schedule("0 6 * * *", async () => {
      console.log("Running daily session creation...");
      await this.createSessionsForToday();
    });

    // Run every 5 minutes to activate sessions
    cron.schedule("*/5 * * * *", async () => {
      console.log("Checking for sessions to activate...");
      await this.activateCurrentSessions();
    });

    // Run every 5 minutes to end completed sessions
    cron.schedule("*/5 * * * *", async () => {
      console.log("Checking for sessions to end...");
      await this.endCompletedSessions();
    });

    // Run initial checks on startup
    setTimeout(() => {
      this.createSessionsForToday();
      this.activateCurrentSessions();
      this.endCompletedSessions();
    }, 5000); // Wait 5 seconds after startup
  }

  stop() {
    this.isRunning = false;
    console.log("Session scheduler stopped");
  }

  private async createSessionsForToday() {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

      console.log(
        `Creating sessions for ${today.toDateString()} (day ${dayOfWeek})`
      );

      // Find all active schedules for this day
      const daySchedules = await db
        .select()
        .from(schedules)
        .where(
          and(eq(schedules.dayOfWeek, dayOfWeek), eq(schedules.isActive, true))
        );

      console.log(`Found ${daySchedules.length} schedules for today`);

      let createdCount = 0;

      for (const schedule of daySchedules) {
        // Check if session already exists for this schedule and date
        const existingSession = await db
          .select()
          .from(classSessions)
          .where(
            and(
              eq(classSessions.scheduleId, schedule.id),
              gte(
                classSessions.date,
                new Date(today.getFullYear(), today.getMonth(), today.getDate())
              ),
              lte(
                classSessions.date,
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate() + 1
                )
              )
            )
          )
          .limit(1);

        if (existingSession.length === 0) {
          // Create new session
          await db.insert(classSessions).values({
            scheduleId: schedule.id,
            date: today,
            status: "scheduled",
          });

          createdCount++;
          console.log(`Created session for schedule ${schedule.id}`);
        }
      }

      console.log(
        `Session creation complete: ${createdCount} sessions created`
      );
    } catch (error) {
      console.error("Error creating sessions for today:", error);
    }
  }

  private async activateCurrentSessions() {
    try {
      const now = new Date();

      // Find sessions that should be active now
      const sessionsToActivate = await db
        .select({
          session: classSessions,
          schedule: schedules,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(
          and(
            eq(classSessions.status, "scheduled"),
            eq(schedules.isActive, true),
            // Session date matches today
            gte(
              classSessions.date,
              new Date(now.getFullYear(), now.getMonth(), now.getDate())
            ),
            lte(
              classSessions.date,
              new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
            ),
            // Current time is within session time window
            lte(schedules.startTime, now.toTimeString().slice(0, 8)),
            gte(schedules.endTime, now.toTimeString().slice(0, 8))
          )
        );

      console.log(`Found ${sessionsToActivate.length} sessions to activate`);

      for (const { session } of sessionsToActivate) {
        await db
          .update(classSessions)
          .set({ status: "active" })
          .where(eq(classSessions.id, session.id));

        console.log(`Activated session ${session.id}`);
      }
    } catch (error) {
      console.error("Error activating current sessions:", error);
    }
  }

  private async endCompletedSessions() {
    try {
      const now = new Date();

      // Find active sessions that have ended
      const sessionsToEnd = await db
        .select({
          session: classSessions,
          schedule: schedules,
        })
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(
          and(
            eq(classSessions.status, "active"),
            // Current time is past end time
            lte(schedules.endTime, now.toTimeString().slice(0, 8))
          )
        );

      console.log(`Found ${sessionsToEnd.length} sessions to end`);

      for (const { session } of sessionsToEnd) {
        await db
          .update(classSessions)
          .set({ status: "completed" })
          .where(eq(classSessions.id, session.id));

        console.log(`Ended session ${session.id}`);
      }
    } catch (error) {
      console.error("Error ending completed sessions:", error);
    }
  }

  // Manual trigger methods for testing/admin purposes
  async createSessionsForDate(date: Date) {
    const originalDate = new Date();
    // Temporarily override today's date for testing
    const dayOfWeek = date.getDay();

    console.log(
      `Manually creating sessions for ${date.toDateString()} (day ${dayOfWeek})`
    );

    // Similar logic as createSessionsForToday but with custom date
    try {
      const daySchedules = await db
        .select()
        .from(schedules)
        .where(
          and(eq(schedules.dayOfWeek, dayOfWeek), eq(schedules.isActive, true))
        );

      let createdCount = 0;

      for (const schedule of daySchedules) {
        const existingSession = await db
          .select()
          .from(classSessions)
          .where(
            and(
              eq(classSessions.scheduleId, schedule.id),
              gte(
                classSessions.date,
                new Date(date.getFullYear(), date.getMonth(), date.getDate())
              ),
              lte(
                classSessions.date,
                new Date(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate() + 1
                )
              )
            )
          )
          .limit(1);

        if (existingSession.length === 0) {
          await db.insert(classSessions).values({
            scheduleId: schedule.id,
            date: date,
            status: "scheduled",
          });

          createdCount++;
        }
      }

      return createdCount;
    } catch (error) {
      console.error("Error creating sessions for date:", error);
      throw error;
    }
  }
}

export const sessionScheduler = new SessionScheduler();
