import { db } from "../storage.js";
import { attendanceRecords, students, classSessions, schedules, } from "../schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
class AttendanceMonitor {
    activeSessions = new Map();
    validationWindow = 7000;
    recentRFIDScans = new Map();
    async processRFIDScan(scan) {
        try {
            this.storeRecentRFIDScan(scan);
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
            const now = new Date();
            const currentSession = await this.findActiveClassSession(now);
            if (!currentSession) {
                console.log(`No active class session for student ${studentData.id}`);
                return { success: false, message: "No active class session" };
            }
            const existingRecord = await db
                .select()
                .from(attendanceRecords)
                .where(and(eq(attendanceRecords.studentId, studentData.id), eq(attendanceRecords.classSessionId, currentSession.id)))
                .limit(1);
            if (existingRecord.length) {
                await this.updateAttendanceRecord(existingRecord[0], "rfid", now);
            }
            else {
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
        }
        catch (error) {
            console.error("Error processing RFID scan:", error);
            return { success: false, message: "Internal error" };
        }
    }
    async processSensorTrigger(trigger) {
        try {
            const now = new Date();
            const currentSession = await this.findActiveClassSession(now);
            if (!currentSession) {
                console.log("No active class session for sensor trigger");
                return { success: false, message: "No active class session" };
            }
            const recentScans = await this.findRecentRFIDScans(trigger.deviceId, now);
            if (recentScans.length === 0) {
                console.log("Sensor trigger without recent RFID scan - potential ghost attendance");
                await this.createDiscrepancyRecord(trigger, currentSession.id);
                return {
                    success: false,
                    message: "Sensor trigger without RFID validation",
                };
            }
            const recentScan = recentScans[0];
            const student = await db
                .select()
                .from(students)
                .where(eq(students.rfidUid, recentScan.rfidUid))
                .limit(1);
            if (!student.length) {
                return { success: false, message: "Student not found" };
            }
            const existingRecord = await db
                .select()
                .from(attendanceRecords)
                .where(and(eq(attendanceRecords.studentId, student[0].id), eq(attendanceRecords.classSessionId, currentSession.id)))
                .limit(1);
            if (existingRecord.length) {
                await this.updateAttendanceRecord(existingRecord[0], "sensor", now, trigger.sensorType);
            }
            else {
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
        }
        catch (error) {
            console.error("Error processing sensor trigger:", error);
            return { success: false, message: "Internal error" };
        }
    }
    async findActiveClassSession(currentTime) {
        const dayOfWeek = currentTime.getDay();
        const currentTimeStr = currentTime.toTimeString().slice(0, 8);
        const activeSchedules = await db
            .select({
            schedule: schedules,
            session: classSessions,
        })
            .from(schedules)
            .innerJoin(classSessions, eq(schedules.id, classSessions.scheduleId))
            .where(and(eq(schedules.dayOfWeek, dayOfWeek), eq(classSessions.status, "active"), lte(schedules.startTime, currentTimeStr), gte(schedules.endTime, currentTimeStr), gte(classSessions.date, new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate())), lte(classSessions.date, new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1))));
        return activeSchedules.length > 0 ? activeSchedules[0].session : null;
    }
    storeRecentRFIDScan(scan) {
        const timestamp = new Date(scan.timestamp);
        const scanData = {
            rfidUid: scan.rfidUid,
            timestamp,
            deviceId: scan.deviceId,
        };
        const deviceScans = this.recentRFIDScans.get(scan.deviceId) || [];
        deviceScans.push(scanData);
        const cutoffTime = new Date(timestamp.getTime() - this.validationWindow);
        const recentScans = deviceScans.filter((scan) => scan.timestamp > cutoffTime);
        if (recentScans.length > 10) {
            recentScans.splice(0, recentScans.length - 10);
        }
        this.recentRFIDScans.set(scan.deviceId, recentScans);
        console.log(`Stored RFID scan: ${scan.rfidUid} from device ${scan.deviceId}`);
    }
    async findRecentRFIDScans(deviceId, currentTime) {
        const deviceScans = this.recentRFIDScans.get(deviceId) || [];
        const cutoffTime = new Date(currentTime.getTime() - this.validationWindow);
        return deviceScans.filter((scan) => scan.timestamp > cutoffTime);
    }
    async createAttendanceRecord(record) {
        const [newRecord] = await db
            .insert(attendanceRecords)
            .values({
            studentId: record.studentId,
            classSessionId: record.classSessionId,
            entryTime: record.entryTime || null,
            exitTime: record.exitTime || null,
            rfidDetected: record.rfidDetected || false,
            sensorDetected: record.sensorDetected || false,
            isValid: (record.rfidDetected && record.sensorDetected) || false,
            discrepancyFlag: !(record.rfidDetected && record.sensorDetected) || false,
            notes: record.notes || null,
        })
            .returning();
        console.log(`Created attendance record: ${newRecord.id}`);
        return newRecord;
    }
    async updateAttendanceRecord(existingRecord, detectionType, timestamp, sensorType) {
        const updateData = {};
        if (detectionType === "rfid") {
            updateData.rfidDetected = true;
        }
        else if (detectionType === "sensor") {
            updateData.sensorDetected = true;
            if (sensorType === "entry") {
                updateData.entryTime = timestamp;
            }
            else if (sensorType === "exit") {
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
    async createDiscrepancyRecord(trigger, sessionId) {
        await db.insert(attendanceRecords).values({
            studentId: 0,
            classSessionId: sessionId,
            sensorDetected: true,
            rfidDetected: false,
            isValid: false,
            discrepancyFlag: true,
            notes: `Sensor trigger without RFID validation: ${trigger.sensorType} sensor, distance: ${trigger.distance}cm`,
        });
        console.log(`Created discrepancy record for sensor trigger`);
    }
    async validateAttendanceRecord(recordId) {
        await db
            .update(attendanceRecords)
            .set({
            isValid: true,
            discrepancyFlag: false,
            notes: "Manually validated",
        })
            .where(eq(attendanceRecords.id, recordId));
    }
    async getAttendanceStats(sessionId) {
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
    cleanupOldRFIDScans() {
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - this.validationWindow * 2);
        for (const [deviceId, scans] of this.recentRFIDScans) {
            const recentScans = scans.filter((scan) => scan.timestamp > cutoffTime);
            if (recentScans.length === 0) {
                this.recentRFIDScans.delete(deviceId);
            }
            else {
                this.recentRFIDScans.set(deviceId, recentScans);
            }
        }
        console.log("Cleaned up old RFID scans");
    }
    getRFIDScanStats() {
        const stats = {
            totalDevices: this.recentRFIDScans.size,
            totalScans: Array.from(this.recentRFIDScans.values()).reduce((sum, scans) => sum + scans.length, 0),
            devicesWithScans: Array.from(this.recentRFIDScans.entries()).map(([deviceId, scans]) => ({
                deviceId,
                scanCount: scans.length,
                latestScan: scans[scans.length - 1]?.timestamp,
            })),
        };
        return stats;
    }
}
export const attendanceMonitor = new AttendanceMonitor();
