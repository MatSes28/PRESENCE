import db from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
} from "../schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { sendToDevice } from "./websocket.js";
import { cacheService } from "./cacheService.js";
import { isEmergencyStopActive } from "./rfidEmergencyStop.js";

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
  private validationWindow = 30000; // 30 seconds in milliseconds (increased for better validation)
  private attendanceCooldown = 60000; // 1 minute cooldown between attendance records for same student/session
  private recentRFIDScans = new Map<
    string,
    { rfidUid: string; timestamp: Date; deviceId: string }[]
  >();
  private recentAttendance = new Map<string, Date>(); // Fallback (single-instance) cooldown state

  private rfidScanTtlSeconds = 60; // keep scans slightly longer than validationWindow

  private async acquireAttendanceCooldownGate(
    attendanceKey: string,
    now: Date,
  ): Promise<boolean> {
    // Cross-instance correctness: use Redis NX key when available.
    if (cacheService.available()) {
      return cacheService.acquireAttendanceCooldown({
        key: attendanceKey,
        ttlSeconds: Math.ceil(this.attendanceCooldown / 1000),
      });
    }

    // Single-instance fallback.
    const lastAttendance = this.recentAttendance.get(attendanceKey);
    if (
      lastAttendance &&
      now.getTime() - lastAttendance.getTime() < this.attendanceCooldown
    ) {
      return false;
    }
    this.recentAttendance.set(attendanceKey, now);
    return true;
  }

  async processRFIDScan(scan: RFIDScan): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    student?: any;
    session?: any;
  }> {
    try {
      if (
        !scan?.rfidUid ||
        typeof scan.rfidUid !== "string" ||
        scan.rfidUid.trim().length === 0
      ) {
        return { success: false, message: "Invalid RFID UID" };
      }

      if (await isEmergencyStopActive()) {
        return {
          success: false,
          message: "RFID processing paused (emergency stop active).",
        };
      }

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
        // Create discrepancy record for RFID scan outside class time
        await this.createGeneralDiscrepancyRecord({
          type: "out_of_class_time",
          studentId: studentData.id,
          rfidUid: scan.rfidUid,
          deviceId: scan.deviceId,
          timestamp: now,
          message: `RFID scan outside class hours: ${scan.rfidUid}`,
        });
        return { success: false, message: "No active class session" };
      }

      // Anti-passback validation
      const attendanceKey = `${studentData.id}-${currentSession.id}`;

      // Check if student has already entered but not exited
      const existingRecordForPassback = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, studentData.id),
            eq(attendanceRecords.classSessionId, currentSession.id),
          ),
        )
        .limit(1);

      if (
        existingRecordForPassback.length &&
        existingRecordForPassback[0].entryTime &&
        !existingRecordForPassback[0].exitTime
      ) {
        console.log(
          `Anti-passback violation: Student ${studentData.id} already entered without exiting`,
        );
        return {
          success: false,
          message: "Anti-passback violation: Already entered without exiting",
        };
      }

      // Cross-instance cooldown gate (prevents duplicates when multiple instances receive the same scan)
      const acquired = await this.acquireAttendanceCooldownGate(
        attendanceKey,
        now,
      );
      if (!acquired) {
        console.log(
          `Duplicate attendance attempt within cooldown period for student ${studentData.id}`,
        );
        return {
          success: false,
          message: "Attendance already recorded recently",
        };
      }

      // Only store scans that are eligible to count as a presence proof signal.
      // This avoids using unknown/invalid/rejected RFID scans to validate sensor triggers.
      this.storeRecentRFIDScan(scan);
      // Cross-instance correlation: persist eligible scans to Redis (if available).
      await this.storeRecentRFIDScanRedis(scan);

      // Check if student already has a record for this session
      const existingRecord = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, studentData.id),
            eq(attendanceRecords.classSessionId, currentSession.id),
          ),
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
        message: "RFID scan processed",
        student: studentData,
        session: currentSession,
      };
    } catch (error) {
      console.error("Error processing RFID scan:", error);
      const msg = (error as any)?.message || String(error);
      const lower = msg.toLowerCase();
      const userMessage =
        lower.includes("database") ||
        lower.includes("connection") ||
        lower.includes("timeout")
          ? "Database error"
          : "Internal error";
      return { success: false, message: userMessage, error: msg };
    }
  }

  async processSensorTrigger(trigger: SensorTrigger): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    student?: any;
    session?: any;
    triggerType?: "entry" | "exit";
  }> {
    try {
      if (trigger.sensorType !== "entry" && trigger.sensorType !== "exit") {
        return { success: false, message: "Invalid sensor type" };
      }

      // Use trigger timestamp (device) if valid, otherwise fall back to server time.
      const now = new Date();
      const triggerTime = new Date(trigger.timestamp);
      const effectiveTime = Number.isFinite(triggerTime.getTime())
        ? triggerTime
        : now;

      // Find active class session
      const currentSession = await this.findActiveClassSession(effectiveTime);

      if (!currentSession) {
        console.log("No active class session for sensor trigger");
        return { success: false, message: "No active class session" };
      }

      // Enhanced sensor validation logic
      // Check for minimum distance threshold to filter out false triggers
      const MIN_DISTANCE_CM = 5;
      const MAX_DISTANCE_CM = 100;
      if (
        trigger.distance < MIN_DISTANCE_CM ||
        trigger.distance > MAX_DISTANCE_CM
      ) {
        console.log(`Invalid sensor distance: ${trigger.distance}cm`);
        return { success: false, message: "Invalid distance" };
      }

      // Look for recent RFID scans within validation window (device-bound)
      const recentScans = await this.findRecentRFIDScans(
        trigger.deviceId,
        effectiveTime,
      );

      if (recentScans.length === 0) {
        console.log(
          "Sensor trigger without recent RFID scan - potential ghost attendance",
        );
        // Create discrepancy record
        await this.createDiscrepancyRecord(trigger, currentSession.id);
        return {
          success: false,
          message: "Sensor trigger without RFID validation",
        };
      }

      // Validate the most recent scan (the newest scan within the window).
      const recentScan = recentScans[recentScans.length - 1];
      const correlationWindowMs = 5000; // 5s: tighter linkage between RFID and proximity
      const ageMs = effectiveTime.getTime() - recentScan.timestamp.getTime();
      if (ageMs < 0 || ageMs > correlationWindowMs) {
        console.log(
          `RFID-to-sensor correlation failed (age=${ageMs}ms). Potential replay/ghost.`,
        );
        await this.createDiscrepancyRecord(trigger, currentSession.id);
        return {
          success: false,
          message: "Sensor trigger without timely RFID correlation",
        };
      }
      const student = await db
        .select()
        .from(students)
        .where(eq(students.rfidUid, recentScan.rfidUid))
        .limit(1);

      if (!student.length) {
        return { success: false, message: "Student not found" };
      }

      // Anti-passback validation for sensor triggers
      const attendanceKey = `${student[0].id}-${currentSession.id}`;
      const existingRecord = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.studentId, student[0].id),
            eq(attendanceRecords.classSessionId, currentSession.id),
          ),
        )
        .limit(1);

      if (existingRecord.length) {
        if (
          trigger.sensorType === "entry" &&
          existingRecord[0].entryTime &&
          !existingRecord[0].exitTime
        ) {
          console.log(
            `Anti-passback violation: Student ${student[0].id} already entered without exiting`,
          );
          return {
            success: false,
            message: "Anti-passback violation: Already entered without exiting",
          };
        }

        if (trigger.sensorType === "exit" && !existingRecord[0].entryTime) {
          console.log(
            `Invalid exit: Student ${student[0].id} has no entry record`,
          );
          return {
            success: false,
            message: "Invalid exit: No entry record found",
          };
        }
      }

      if (existingRecord.length) {
        await this.updateAttendanceRecord(
          existingRecord[0],
          "sensor",
          now,
          trigger.sensorType,
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
        message: "Sensor trigger processed",
        student: student[0],
        session: currentSession,
        triggerType: trigger.sensorType,
      };
    } catch (error) {
      console.error("Error processing sensor trigger:", error);
      return {
        success: false,
        message: "Internal error",
        error: (error as any)?.message || String(error),
      };
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
              currentTime.getDate(),
            ),
          ),
          lte(
            classSessions.date,
            new Date(
              currentTime.getFullYear(),
              currentTime.getMonth(),
              currentTime.getDate() + 1,
            ),
          ),
        ),
      );

    // Return the first active session
    return activeSchedules.length > 0 ? activeSchedules[0].session : null;
  }

  private storeRecentRFIDScan(scan: RFIDScan) {
    const timestamp = new Date(scan.timestamp);
    const scanData = {
      rfidUid: scan.rfidUid,
      timestamp,
      deviceId: scan.deviceId,
    };

    // Get existing scans for this device
    const deviceScans = this.recentRFIDScans.get(scan.deviceId) || [];

    // Add new scan
    deviceScans.push(scanData);

    // Keep only recent scans (within validation window)
    const cutoffTime = new Date(timestamp.getTime() - this.validationWindow);
    const recentScans = deviceScans.filter(
      (scan) => scan.timestamp > cutoffTime,
    );

    // Limit to last 10 scans per device to prevent memory issues
    if (recentScans.length > 10) {
      recentScans.splice(0, recentScans.length - 10);
    }

    this.recentRFIDScans.set(scan.deviceId, recentScans);

    console.log(
      `Stored RFID scan: ${scan.rfidUid} from device ${scan.deviceId}`,
    );
  }

  private async storeRecentRFIDScanRedis(scan: RFIDScan): Promise<void> {
    // Best-effort; local in-memory fallback is still used for single-instance.
    if (!cacheService.available()) return;

    const ts = new Date(scan.timestamp);
    const tsMs = Number.isFinite(ts.getTime()) ? ts.getTime() : Date.now();
    const cutoffMs = tsMs - this.validationWindow;

    await cacheService.addRecentRfidScan({
      deviceId: scan.deviceId,
      rfidUid: scan.rfidUid,
      timestampMs: tsMs,
      ttlSeconds: this.rfidScanTtlSeconds,
    });
    await cacheService.trimRecentRfidScans({
      deviceId: scan.deviceId,
      minTimestampMs: cutoffMs,
    });
  }

  private async findRecentRFIDScans(deviceId: string, currentTime: Date) {
    const cutoffTime = new Date(currentTime.getTime() - this.validationWindow);

    // Prefer Redis for cross-instance correctness.
    if (cacheService.available()) {
      const redisScans = await cacheService.getRecentRfidScans({
        deviceId,
        minTimestampMs: cutoffTime.getTime(),
      });
      return redisScans
        .map((s) => ({
          rfidUid: s.rfidUid,
          timestamp: new Date(s.timestampMs),
          deviceId: s.deviceId,
        }))
        .filter((scan) => scan.timestamp > cutoffTime);
    }

    // Fallback for single-instance.
    const deviceScans = this.recentRFIDScans.get(deviceId) || [];
    return deviceScans.filter((scan) => scan.timestamp > cutoffTime);
  }

  private async createAttendanceRecord(
    record: Partial<typeof attendanceRecords.$inferInsert>,
  ) {
    const isValid = (record.rfidDetected && record.sensorDetected) || false;
    const [newRecord] = await db
      .insert(attendanceRecords)
      .values({
        studentId: record.studentId!,
        classSessionId: record.classSessionId!,
        entryTime: record.entryTime || null,
        exitTime: record.exitTime || null,
        status: isValid ? "present" : "absent",
        rfidDetected: record.rfidDetected || false,
        sensorDetected: record.sensorDetected || false,
        isValid,
        discrepancyFlag: !isValid,
        notes: record.notes || null,
      })
      .returning();

    console.log(`Created attendance record: ${newRecord.id}`);

    // Invalidate cache for this session
    await cacheService.invalidateAttendance(newRecord.classSessionId);

    return newRecord;
  }

  private async updateAttendanceRecord(
    existingRecord: typeof attendanceRecords.$inferSelect,
    detectionType: "rfid" | "sensor",
    timestamp: Date,
    sensorType?: "entry" | "exit",
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

    // Invalidate cache for this session
    await cacheService.invalidateAttendance(existingRecord.classSessionId);
  }

  private async createDiscrepancyRecord(
    trigger: SensorTrigger,
    sessionId: number,
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

  private async createGeneralDiscrepancyRecord(discrepancy: {
    type: string;
    studentId?: number;
    rfidUid?: string;
    deviceId: string;
    timestamp: Date;
    message: string;
    sessionId?: number;
  }) {
    // Find session if not provided
    let sessionId = discrepancy.sessionId;
    if (!sessionId) {
      const now = new Date();
      const currentSession = await this.findActiveClassSession(now);
      sessionId = currentSession?.id || 0;
    }

    // Create a record flagged as discrepancy
    await db.insert(attendanceRecords).values({
      studentId: discrepancy.studentId || 0,
      classSessionId: sessionId,
      sensorDetected: false,
      rfidDetected: !!discrepancy.rfidUid,
      isValid: false,
      discrepancyFlag: true,
      notes: `${discrepancy.type}: ${discrepancy.message}`,
    });

    console.log(`Created general discrepancy record: ${discrepancy.type}`);
  }

  async validateAttendanceRecord(
    recordId: number,
  ): Promise<{ success: boolean; message: string }> {
    // Manual validation of suspicious records
    const existing = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, recordId))
      .limit(1);

    if (!existing.length) {
      return { success: false, message: "Attendance record not found" };
    }

    await db
      .update(attendanceRecords)
      .set({
        isValid: true,
        discrepancyFlag: false,
        notes: "Manually validated",
      })
      .where(eq(attendanceRecords.id, recordId));

    return { success: true, message: "Attendance record validated" };
  }

  async getAttendanceStats(sessionId: number) {
    // Try cache first (shared key with cacheService helpers)
    const cached = await cacheService.getAttendanceStats(sessionId);
    if (cached) return cached;

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
      // Back-compat fields used by some UIs/tests
      totalStudents: new Set(records.map((r) => r.studentId)).size,
      presentCount: records.filter((r) => r.status === "present").length,
      absentCount: records.filter((r) => r.status === "absent").length,
      attendanceRate:
        records.length > 0
          ? Math.round(
              (records.filter((r) => r.status === "present").length /
                records.length) *
                10000,
            ) / 100
          : 0,
    };

    // Cache for 2 minutes
    await cacheService.setAttendanceStats(sessionId, stats, 120);
    return stats;
  }

  // Clean up old RFID scans and attendance records periodically
  cleanupOldData() {
    const now = new Date();
    const rfidCutoffTime = new Date(now.getTime() - this.validationWindow * 2); // Keep 2x validation window
    const attendanceCutoffTime = new Date(
      now.getTime() - this.attendanceCooldown * 2,
    ); // Keep 2x cooldown window

    // Clean up old RFID scans
    for (const [deviceId, scans] of this.recentRFIDScans) {
      const recentScans = scans.filter(
        (scan) => scan.timestamp > rfidCutoffTime,
      );
      if (recentScans.length === 0) {
        this.recentRFIDScans.delete(deviceId);
      } else {
        this.recentRFIDScans.set(deviceId, recentScans);
      }
    }

    // Clean up old attendance tracking
    for (const [key, timestamp] of this.recentAttendance) {
      if (timestamp < attendanceCutoffTime) {
        this.recentAttendance.delete(key);
      }
    }

    console.log(
      `Cleaned up old data: ${this.recentRFIDScans.size} RFID devices, ${this.recentAttendance.size} attendance records`,
    );
  }

  // Get RFID scan statistics
  getRFIDScanStats() {
    const stats = {
      totalDevices: this.recentRFIDScans.size,
      totalScans: Array.from(this.recentRFIDScans.values()).reduce(
        (sum, scans) => sum + scans.length,
        0,
      ),
      devicesWithScans: Array.from(this.recentRFIDScans.entries()).map(
        ([deviceId, scans]) => ({
          deviceId,
          scanCount: scans.length,
          latestScan: scans[scans.length - 1]?.timestamp,
        }),
      ),
    };

    return stats;
  }

  // Get attendance validation statistics
  getAttendanceValidationStats() {
    const stats = {
      validationWindowSeconds: this.validationWindow / 1000,
      attendanceCooldownMinutes: this.attendanceCooldown / (1000 * 60),
      activeAttendanceTracking: this.recentAttendance.size,
      activeRFIDTracking: this.recentRFIDScans.size,
      recentAttendanceRecords: Array.from(this.recentAttendance.entries()).map(
        ([key, timestamp]) => ({
          key,
          lastAttendance: timestamp,
          minutesAgo: Math.round(
            (Date.now() - timestamp.getTime()) / (1000 * 60),
          ),
        }),
      ),
    };

    return stats;
  }
}

export const attendanceMonitor = new AttendanceMonitor();
