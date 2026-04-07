import db from "../storage.js";
import {
  attendanceRecords,
  students,
  classSessions,
  schedules,
  enrollments,
  iotDevices,
} from "../schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { sendToDevice } from "./websocket.js";
import { cacheService } from "./cacheService.js";
import { isEmergencyStopActive } from "./rfidEmergencyStop.js";
import { encryptionService } from "./encryptionService.js";

interface RFIDScan {
  deviceId: string;
  rfidUid: string;
  timestamp: string;
  classroomId?: number | null;
}

interface SensorTrigger {
  deviceId: string;
  sensorType: "entry" | "exit";
  distance: number;
  timestamp: string;
  classroomId?: number | null;
}

interface AttendanceRecord {
  studentId: number;
  classSessionId: number;
  entryTime?: Date;
  exitTime?: Date;
  rfidDetected: boolean;
  sensorDetected: boolean;
}

interface ActiveSessionMatch {
  session: typeof classSessions.$inferSelect;
  schedule: Pick<
    typeof schedules.$inferSelect,
    "id" | "subjectId" | "classroomId" | "facultyId"
  >;
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

  resetStateForTests(): void {
    this.activeSessions.clear();
    this.recentRFIDScans.clear();
    this.recentAttendance.clear();
  }

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

  private async findStudentByRfidUid(rfidUid: string) {
    const normalized = rfidUid.trim();
    const rfidUidHash = encryptionService.hashRFIDUidForLookup(normalized);

    try {
      const byHash = await db
        .select()
        .from(students)
        .where(eq(students.rfidUidHash, rfidUidHash))
        .limit(1);

      if (byHash.length) {
        return byHash[0];
      }
    } catch (error) {
      console.warn(
        "RFID hash lookup failed, falling back to legacy UID lookup:",
        (error as Error).message,
      );
    }

    const byPlainUid = await db
      .select()
      .from(students)
      .where(eq(students.rfidUid, normalized))
      .limit(1);

    return byPlainUid[0] ?? null;
  }

  private toPublicStudent(student: typeof students.$inferSelect) {
    return {
      id: student.id,
      studentId: student.studentId,
      name: student.name,
    };
  }

  private toPublicSession(match: ActiveSessionMatch) {
    return {
      ...match.session,
      classroomId: match.schedule.classroomId,
      facultyId: match.schedule.facultyId,
      subjectId: match.schedule.subjectId,
      scheduleId: match.schedule.id,
    };
  }

  private async resolveDeviceClassroomId(
    deviceId: string,
    classroomId?: number | null,
  ): Promise<number | null> {
    if (typeof classroomId === "number" && Number.isFinite(classroomId)) {
      return classroomId;
    }

    if (!deviceId || deviceId === "simulator") {
      return null;
    }

    const device = await db
      .select({ classroomId: iotDevices.classroomId })
      .from(iotDevices)
      .where(eq(iotDevices.deviceId, deviceId))
      .limit(1);

    return device[0]?.classroomId ?? null;
  }

  private async findActiveClassSessionMatch(
    currentTime: Date,
    options: { classroomId?: number | null; studentId?: number } = {},
  ): Promise<ActiveSessionMatch | null> {
    const dayOfWeek = currentTime.getDay();
    const currentTimeStr = currentTime.toTimeString().slice(0, 8);
    const startOfDay = new Date(
      currentTime.getFullYear(),
      currentTime.getMonth(),
      currentTime.getDate(),
    );
    const endOfDay = new Date(
      currentTime.getFullYear(),
      currentTime.getMonth(),
      currentTime.getDate() + 1,
    );

    const filters = [
      eq(schedules.dayOfWeek, dayOfWeek),
      eq(classSessions.status, "active"),
      lte(schedules.startTime, currentTimeStr),
      gte(schedules.endTime, currentTimeStr),
      gte(classSessions.date, startOfDay),
      lte(classSessions.date, endOfDay),
    ];

    if (options.classroomId) {
      filters.push(eq(schedules.classroomId, options.classroomId));
    }

    const baseQuery = db
      .select({
        session: classSessions,
        schedule: {
          id: schedules.id,
          subjectId: schedules.subjectId,
          classroomId: schedules.classroomId,
          facultyId: schedules.facultyId,
        },
      })
      .from(schedules)
      .innerJoin(classSessions, eq(schedules.id, classSessions.scheduleId));

    const matches = options.studentId
      ? await baseQuery
          .innerJoin(
            enrollments,
            and(
              eq(enrollments.subjectId, schedules.subjectId),
              eq(enrollments.studentId, options.studentId),
              eq(enrollments.isActive, true),
            ),
          )
          .where(and(...filters))
          .orderBy(classSessions.date)
          .limit(1)
      : await baseQuery
          .where(and(...filters))
          .orderBy(classSessions.date)
          .limit(1);

    return matches[0] ?? null;
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

      // Find student by RFID UID (tokenized lookup)
      const studentData = await this.findStudentByRfidUid(scan.rfidUid);

      if (!studentData) {
        console.log(`Unknown RFID UID: ${scan.rfidUid}`);
        return { success: false, message: "Unknown RFID card" };
      }

      const publicStudent = this.toPublicStudent(studentData);

      // Find active class session for current time
      const now = new Date();
      const classroomId = await this.resolveDeviceClassroomId(
        scan.deviceId,
        scan.classroomId,
      );
      const currentSessionMatch = await this.findActiveClassSessionMatch(now, {
        classroomId,
        studentId: studentData.id,
      });

      if (!currentSessionMatch) {
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

      const currentSession = currentSessionMatch.session;

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
      // Store the raw UID in short-lived correlation state (Redis/in-memory) only.
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
        student: publicStudent,
        session: this.toPublicSession(currentSessionMatch),
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

      // Production correctness: use *server receipt time* as the canonical time
      // for schedule matching + RFID↔sensor correlation.
      // Device timestamps are used for signature/replay checks in [`verifySignedDeviceEvent()`](server/src/services/websocket.ts:204).
      const now = new Date();
      const effectiveTime = now;

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

      const classroomId = await this.resolveDeviceClassroomId(
        trigger.deviceId,
        trigger.classroomId,
      );

      // Look for recent RFID scans within validation window (device-bound)
      const recentScans = await this.findRecentRFIDScans(
        trigger.deviceId,
        effectiveTime,
      );

      if (recentScans.length === 0) {
        const currentSessionMatch = await this.findActiveClassSessionMatch(
          effectiveTime,
          { classroomId },
        );

        if (!currentSessionMatch) {
          console.log("No active class session for sensor trigger");
          return { success: false, message: "No active class session" };
        }

        console.log(
          "Sensor trigger without recent RFID scan - potential ghost attendance",
        );
        // Create discrepancy record
        await this.createDiscrepancyRecord(trigger, currentSessionMatch.session.id);
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
        const currentSessionMatch = await this.findActiveClassSessionMatch(
          effectiveTime,
          { classroomId },
        );
        if (currentSessionMatch) {
          await this.createDiscrepancyRecord(
            trigger,
            currentSessionMatch.session.id,
          );
        }
        return {
          success: false,
          message: "Sensor trigger without timely RFID correlation",
        };
      }
      const studentData = await this.findStudentByRfidUid(recentScan.rfidUid);

      if (!studentData) {
        return { success: false, message: "Student not found" };
      }

      const publicStudent = this.toPublicStudent(studentData);
      const currentSessionMatch = await this.findActiveClassSessionMatch(
        effectiveTime,
        {
          classroomId,
          studentId: studentData.id,
        },
      );

      if (!currentSessionMatch) {
        console.log("No enrolled active class session for sensor trigger");
        return { success: false, message: "No active class session" };
      }

      const currentSession = currentSessionMatch.session;

      // Anti-passback validation for sensor triggers
      const attendanceKey = `${studentData.id}-${currentSession.id}`;
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
        if (
          trigger.sensorType === "entry" &&
          existingRecord[0].entryTime &&
          !existingRecord[0].exitTime
        ) {
          console.log(
            `Anti-passback violation: Student ${studentData.id} already entered without exiting`,
          );
          return {
            success: false,
            message: "Anti-passback violation: Already entered without exiting",
          };
        }

        if (trigger.sensorType === "exit" && !existingRecord[0].entryTime) {
          console.log(
            `Invalid exit: Student ${studentData.id} has no entry record`,
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
          studentId: studentData.id,
          classSessionId: currentSession.id,
          rfidDetected: false,
          sensorDetected: true,
          [trigger.sensorType === "entry" ? "entryTime" : "exitTime"]: now,
        });
      }

      return {
        success: true,
        message: "Sensor trigger processed",
        student: publicStudent,
        session: this.toPublicSession(currentSessionMatch),
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

  private storeRecentRFIDScan(scan: RFIDScan) {
    // Use server receipt time for correlation (device clocks can drift).
    const timestamp = new Date();
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

    // Use server receipt time for correlation.
    const tsMs = Date.now();
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
    console.warn(
      `Skipping sensor discrepancy insert for session ${sessionId}: attendance_records requires a student_id`,
      trigger,
    );
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
      const classroomId = await this.resolveDeviceClassroomId(discrepancy.deviceId);
      const currentSession = await this.findActiveClassSessionMatch(now, {
        classroomId,
        studentId: discrepancy.studentId,
      });
      sessionId = currentSession?.session.id || 0;
    }

    // If we cannot associate to a real class session, do not write a dangling FK.
    // (This should be handled by a dedicated discrepancies/audit table in a fuller design.)
    if (!sessionId) {
      console.warn(
        "Skipping general discrepancy insert because no active session could be resolved:",
        discrepancy.type,
      );
      return;
    }

    if (!discrepancy.studentId) {
      console.warn(
        "Skipping general discrepancy insert without student context:",
        discrepancy,
      );
      return;
    }

    await db.insert(attendanceRecords).values({
      studentId: discrepancy.studentId,
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
      totalStudents: new Set(
        records
          .map((r) => r.studentId)
          .filter((v): v is number => typeof v === "number" && v > 0),
      ).size,
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
