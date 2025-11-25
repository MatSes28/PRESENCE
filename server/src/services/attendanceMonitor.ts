import { db } from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
} from "../schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { sendToDevice } from "./websocket.js";

interface RFIDScan {
  deviceId: string;
  rfidUid: string;
  timestamp: string;
}

interface SensorTrigger {
  deviceId: string;
  sensorType: "entry" | "exit";
  distance: number;
  timestamp: string;
}

interface AttendanceRecord {
  studentId: number;
  classSessionId: number;
  entryTime?: Date;
  exitTime?: Date;
  rfidDetected: boolean;
  sensorDetected: boolean;
}

class AttendanceMonitor {
  private activeSessions = new Map<number, AttendanceRecord>();
  private validationWindow = 7000; // 7 seconds in milliseconds

  async processRFIDScan(scan: RFIDScan) {
    try {
      // Find student by RFID UID
      const student = await db
        .select()
        .from(students)
        .where(eq(students.rfidUid, scan.rfidUid))
        .limit(1);

      if (!student.length) {
        console.log(`Unknown RFID UID: ${scan.rfidUid}`);
        return { success: false, message: "Unknown RFID card" };
      }

      const studentData = student[0];

      // Find active class session for current time
      const now = new Date();
      const currentSession = await this.findActiveClassSession(now);

      if (!currentSession) {
        console.log(`No active class session for student ${studentData.id}`);
        return { success: false, message: "No active class session" };
      }

      // Check if student already has a record for this session
      const existingRecord = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, studentData.id),
            eq(attendanceRecords.classSessionId, currentSession.id)
          )
        )
        .limit(1);

      if (existingRecord.length) {
        // Update existing record
        await this.updateAttendanceRecord(existingRecord[0], "rfid", now);
      } else {
        // Create new record
        await this.createAttendanceRecord({
          studentId: studentData.id,
          classSessionId: currentSession.id,
          rfidDetected: true,
          sensorDetected: false,
        });
      }

      return {
        success: true,
        student: studentData,
        session: currentSession,
      };
    } catch (error) {
      console.error("Error processing RFID scan:", error);
      return { success: false, message: "Internal error" };
    }
  }

  async processSensorTrigger(trigger: SensorTrigger) {
    try {
      // Find active class session
      const now = new Date();
      const currentSession = await this.findActiveClassSession(now);

      if (!currentSession) {
        console.log("No active class session for sensor trigger");
        return { success: false, message: "No active class session" };
      }

      // Look for recent RFID scans within validation window
      const recentScans = await this.findRecentRFIDScans(trigger.deviceId, now);

      if (recentScans.length === 0) {
        console.log(
          "Sensor trigger without recent RFID scan - potential ghost attendance"
        );
        // Create discrepancy record
        await this.createDiscrepancyRecord(trigger, currentSession.id);
        return {
          success: false,
          message: "Sensor trigger without RFID validation",
        };
      }

      // Validate the most recent scan
      const recentScan = recentScans[0];
      const student = await db
        .select()
        .from(students)
        .where(eq(students.rfidUid, recentScan.rfidUid))
        .limit(1);

      if (!student.length) {
        return { success: false, message: "Student not found" };
      }

      // Update or create attendance record
      const existingRecord = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, student[0].id),
            eq(attendanceRecords.classSessionId, currentSession.id)
          )
        )
        .limit(1);

      if (existingRecord.length) {
        await this.updateAttendanceRecord(
          existingRecord[0],
          "sensor",
          now,
          trigger.sensorType
        );
      } else {
        await this.createAttendanceRecord({
          studentId: student[0].id,
          classSessionId: currentSession.id,
          rfidDetected: false,
          sensorDetected: true,
          [trigger.sensorType === "entry" ? "entryTime" : "exitTime"]: now,
        });
      }

      return {
        success: true,
        student: student[0],
        session: currentSession,
        triggerType: trigger.sensorType,
      };
    } catch (error) {
      console.error("Error processing sensor trigger:", error);
      return { success: false, message: "Internal error" };
    }
  }

  private async findActiveClassSession(currentTime: Date) {
    // Find class sessions that are currently active based on schedule
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTimeStr = currentTime.toTimeString().slice(0, 8); // HH:MM:SS format

    // Find schedules for today that are currently active
    const activeSchedules = await db
      .select({
        schedule: schedules,
        session: classSessions,
      })
      .from(schedules)
      .innerJoin(classSessions, eq(schedules.id, classSessions.scheduleId))
      .where(
        and(
          eq(schedules.dayOfWeek, dayOfWeek),
          eq(classSessions.status, "active"),
          lte(schedules.startTime, currentTimeStr),
          gte(schedules.endTime, currentTimeStr),
          // Session date matches today
          gte(
            classSessions.date,
            new Date(
              currentTime.getFullYear(),
              currentTime.getMonth(),
              currentTime.getDate()
            )
          ),
          lte(
            classSessions.date,
            new Date(
              currentTime.getFullYear(),
              currentTime.getMonth(),
              currentTime.getDate() + 1
            )
          )
        )
      );

    // Return the first active session
    return activeSchedules.length > 0 ? activeSchedules[0].session : null;
  }

  private async findRecentRFIDScans(deviceId: string, currentTime: Date) {
    // This would typically query a cache or recent scans table
    // For now, return empty array - implement based on your caching strategy
    return [];
  }

  private async createAttendanceRecord(
    record: Partial<typeof attendanceRecords.$inferInsert>
  ) {
    const [newRecord] = await db
      .insert(attendanceRecords)
      .values({
        studentId: record.studentId!,
        classSessionId: record.classSessionId!,
        entryTime: record.entryTime || null,
        exitTime: record.exitTime || null,
        rfidDetected: record.rfidDetected || false,
        sensorDetected: record.sensorDetected || false,
        isValid: (record.rfidDetected && record.sensorDetected) || false,
        discrepancyFlag:
          !(record.rfidDetected && record.sensorDetected) || false,
        notes: record.notes || null,
      })
      .returning();

    console.log(`Created attendance record: ${newRecord.id}`);
    return newRecord;
  }

  private async updateAttendanceRecord(
    existingRecord: typeof attendanceRecords.$inferSelect,
    detectionType: "rfid" | "sensor",
    timestamp: Date,
    sensorType?: "entry" | "exit"
  ) {
    const updateData: Partial<typeof attendanceRecords.$inferInsert> = {};

    if (detectionType === "rfid") {
      updateData.rfidDetected = true;
    } else if (detectionType === "sensor") {
      updateData.sensorDetected = true;
      if (sensorType === "entry") {
        updateData.entryTime = timestamp;
      } else if (sensorType === "exit") {
        updateData.exitTime = timestamp;
      }
    }

    updateData.isValid =
      (existingRecord.rfidDetected || updateData.rfidDetected) &&
      (existingRecord.sensorDetected || updateData.sensorDetected);
    updateData.discrepancyFlag = !updateData.isValid;

    await db
      .update(attendanceRecords)
      .set(updateData)
      .where(eq(attendanceRecords.id, existingRecord.id));

    console.log(`Updated attendance record: ${existingRecord.id}`);
  }

  private async createDiscrepancyRecord(
    trigger: SensorTrigger,
    sessionId: number
  ) {
    // Create a record flagged as discrepancy
    await db.insert(attendanceRecords).values({
      studentId: 0, // Unknown student
      classSessionId: sessionId,
      sensorDetected: true,
      rfidDetected: false,
      isValid: false,
      discrepancyFlag: true,
      notes: `Sensor trigger without RFID validation: ${trigger.sensorType} sensor, distance: ${trigger.distance}cm`,
    });

    console.log(`Created discrepancy record for sensor trigger`);
  }

  async validateAttendanceRecord(recordId: number) {
    // Manual validation of suspicious records
    await db
      .update(attendanceRecords)
      .set({
        isValid: true,
        discrepancyFlag: false,
        notes: "Manually validated",
      })
      .where(eq(attendanceRecords.id, recordId));
  }

  async getAttendanceStats(sessionId: number) {
    const records = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.classSessionId, sessionId));

    const stats = {
      totalRecords: records.length,
      validRecords: records.filter((r) => r.isValid).length,
      discrepancies: records.filter((r) => r.discrepancyFlag).length,
      rfidOnly: records.filter((r) => r.rfidDetected && !r.sensorDetected)
        .length,
      sensorOnly: records.filter((r) => r.sensorDetected && !r.rfidDetected)
        .length,
    };

    return stats;
  }
}

export const attendanceMonitor = new AttendanceMonitor();
