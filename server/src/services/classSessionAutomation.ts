import db from "../storage.js";
import { classSessions, iotDevices, schedules } from "../schema.js";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { getHolidayForDate } from "./academicCalendar.js";

type SessionAutomationResult = {
  action: "none" | "created" | "activated" | "already_active";
  reason?:
    | "holiday"
    | "device_not_found"
    | "device_not_supported"
    | "classroom_not_assigned"
    | "no_matching_schedule"
    | "session_not_activatable";
  holidayName?: string;
  sessionId?: number;
  scheduleId?: number;
  classroomId?: number;
};

const getDayBounds = (date: Date) => {
  const startOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const endOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  );

  return { startOfDay, endOfDay };
};

export const ensureScheduledSessionActivatedForDevice = async ({
  deviceId,
  classroomId,
  now = new Date(),
}: {
  deviceId: string;
  classroomId?: number | null;
  now?: Date;
}): Promise<SessionAutomationResult> => {
  const [device] = await db
    .select({
      deviceId: iotDevices.deviceId,
      classroomId: iotDevices.classroomId,
      deviceType: iotDevices.deviceType,
      isActive: iotDevices.isActive,
    })
    .from(iotDevices)
    .where(eq(iotDevices.deviceId, deviceId))
    .limit(1);

  if (!device || !device.isActive) {
    return { action: "none", reason: "device_not_found" };
  }

  if (device.deviceType !== "esp32_s3") {
    return { action: "none", reason: "device_not_supported" };
  }

  const resolvedClassroomId = classroomId ?? device.classroomId;
  if (!resolvedClassroomId) {
    return { action: "none", reason: "classroom_not_assigned" };
  }

  const holiday = await getHolidayForDate(now);
  if (holiday) {
    return {
      action: "none",
      reason: "holiday",
      holidayName: holiday.name,
      classroomId: resolvedClassroomId,
    };
  }

  const { startOfDay, endOfDay } = getDayBounds(now);
  const currentTime = now.toTimeString().slice(0, 8);
  const dayOfWeek = now.getDay();

  const [matchingSchedule] = await db
    .select({
      id: schedules.id,
      classroomId: schedules.classroomId,
    })
    .from(schedules)
    .where(
      and(
        eq(schedules.classroomId, resolvedClassroomId),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.isActive, true),
        lte(schedules.startTime, currentTime),
        gte(schedules.endTime, currentTime),
      ),
    )
    .orderBy(asc(schedules.startTime))
    .limit(1);

  if (!matchingSchedule) {
    return {
      action: "none",
      reason: "no_matching_schedule",
      classroomId: resolvedClassroomId,
    };
  }

  const [existingSession] = await db
    .select({
      id: classSessions.id,
      status: classSessions.status,
      scheduleId: classSessions.scheduleId,
    })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.scheduleId, matchingSchedule.id),
        gte(classSessions.date, startOfDay),
        lte(classSessions.date, endOfDay),
      ),
    )
    .limit(1);

  if (existingSession?.status === "active") {
    return {
      action: "already_active",
      sessionId: existingSession.id,
      scheduleId: matchingSchedule.id,
      classroomId: resolvedClassroomId,
    };
  }

  if (existingSession) {
    if (existingSession.status !== "scheduled") {
      return {
        action: "none",
        reason: "session_not_activatable",
        sessionId: existingSession.id,
        scheduleId: matchingSchedule.id,
        classroomId: resolvedClassroomId,
      };
    }

    const [activatedSession] = await db
      .update(classSessions)
      .set({ status: "active" })
      .where(eq(classSessions.id, existingSession.id))
      .returning({
        id: classSessions.id,
        scheduleId: classSessions.scheduleId,
      });

    return {
      action: "activated",
      sessionId: activatedSession.id,
      scheduleId: activatedSession.scheduleId,
      classroomId: resolvedClassroomId,
    };
  }

  const [createdSession] = await db
    .insert(classSessions)
    .values({
      scheduleId: matchingSchedule.id,
      date: now,
      status: "active",
    })
    .returning({
      id: classSessions.id,
      scheduleId: classSessions.scheduleId,
    });

  return {
    action: "created",
    sessionId: createdSession.id,
    scheduleId: createdSession.scheduleId,
    classroomId: resolvedClassroomId,
  };
};
