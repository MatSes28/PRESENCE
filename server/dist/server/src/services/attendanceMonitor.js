"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceMonitor = void 0;
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const iotDeviceManager_js_1 = require("./iotDeviceManager.js");
const errorHandler_js_1 = require("../utils/errorHandler.js");
class AttendanceMonitor {
    activeSessions = new Map();
    validationWindow = 7000;
    async processRFIDScan(scan) {
        try {
            if (!scan.rfidUid || !scan.deviceId) {
                throw new errorHandler_js_1.AppError("Invalid RFID scan data: missing RFID UID or device ID", 400);
            }
            const student = await storage_js_1.db
                .select()
                .from(schema_js_1.students)
                .where((0, drizzle_orm_1.eq)(schema_js_1.students.rfidUid, scan.rfidUid))
                .limit(1);
            if (!student.length) {
                console.log(`Unknown RFID UID: ${scan.rfidUid}`);
                return { success: false, message: "Unknown RFID card" };
            }
            const studentData = student[0];
            try {
                await storage_js_1.db.insert(schema_js_1.rfidScans).values({
                    deviceId: scan.deviceId,
                    rfidUid: scan.rfidUid,
                    timestamp: new Date(scan.timestamp),
                });
            }
            catch (error) {
                console.warn("Failed to store RFID scan:", error);
            }
            const now = new Date();
            const currentSession = await this.findActiveClassSession(now);
            if (!currentSession) {
                console.log(`No active class session for student ${studentData.id}`);
                return { success: false, message: "No active class session" };
            }
            const existingRecord = await storage_js_1.db
                .select()
                .from(schema_js_1.attendanceRecords)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, studentData.id), (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, currentSession.id)))
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
            if (error instanceof errorHandler_js_1.AppError) {
                throw error;
            }
            const appError = (0, errorHandler_js_1.handleDatabaseError)(error);
            console.error("Error processing RFID scan:", appError);
            return { success: false, message: appError.message };
        }
    }
    async processSensorTrigger(trigger) {
        try {
            const isValidReading = await iotDeviceManager_js_1.iotDeviceManager.validateSensorReading(trigger.deviceId, trigger.sensorType, trigger.distance);
            if (!isValidReading) {
                console.warn(`Invalid sensor reading from ${trigger.deviceId}, ignoring trigger`);
                return { success: false, message: "Invalid sensor reading" };
            }
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
            const student = await storage_js_1.db
                .select()
                .from(schema_js_1.students)
                .where((0, drizzle_orm_1.eq)(schema_js_1.students.rfidUid, recentScan.rfidUid))
                .limit(1);
            if (!student.length) {
                return { success: false, message: "Student not found" };
            }
            const existingRecord = await storage_js_1.db
                .select()
                .from(schema_js_1.attendanceRecords)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.studentId, student[0].id), (0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, currentSession.id)))
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
        const activeSchedules = await storage_js_1.db
            .select({
            schedule: schema_js_1.schedules,
            session: schema_js_1.classSessions,
        })
            .from(schema_js_1.schedules)
            .innerJoin(schema_js_1.classSessions, (0, drizzle_orm_1.eq)(schema_js_1.schedules.id, schema_js_1.classSessions.scheduleId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.schedules.dayOfWeek, dayOfWeek), (0, drizzle_orm_1.eq)(schema_js_1.classSessions.status, "active"), (0, drizzle_orm_1.lte)(schema_js_1.schedules.startTime, currentTimeStr), (0, drizzle_orm_1.gte)(schema_js_1.schedules.endTime, currentTimeStr), (0, drizzle_orm_1.gte)(schema_js_1.classSessions.date, new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate())), (0, drizzle_orm_1.lte)(schema_js_1.classSessions.date, new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() + 1))));
        return activeSchedules.length > 0 ? activeSchedules[0].session : null;
    }
    async findRecentRFIDScans(deviceId, currentTime) {
        const validationWindowStart = new Date(currentTime.getTime() - this.validationWindow);
        const recentScans = await storage_js_1.db
            .select()
            .from(schema_js_1.rfidScans)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.rfidScans.deviceId, deviceId), (0, drizzle_orm_1.gte)(schema_js_1.rfidScans.timestamp, validationWindowStart), (0, drizzle_orm_1.lte)(schema_js_1.rfidScans.timestamp, currentTime)))
            .orderBy((0, drizzle_orm_1.desc)(schema_js_1.rfidScans.timestamp))
            .limit(5);
        return recentScans;
    }
    async createAttendanceRecord(record) {
        const [newRecord] = await storage_js_1.db
            .insert(schema_js_1.attendanceRecords)
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
        await storage_js_1.db
            .update(schema_js_1.attendanceRecords)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.id, existingRecord.id));
        console.log(`Updated attendance record: ${existingRecord.id}`);
    }
    async createDiscrepancyRecord(trigger, sessionId) {
        await storage_js_1.db.insert(schema_js_1.attendanceRecords).values({
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
        await storage_js_1.db
            .update(schema_js_1.attendanceRecords)
            .set({
            isValid: true,
            discrepancyFlag: false,
            notes: "Manually validated",
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.id, recordId));
    }
    async getAttendanceStats(sessionId) {
        const records = await storage_js_1.db
            .select()
            .from(schema_js_1.attendanceRecords)
            .where((0, drizzle_orm_1.eq)(schema_js_1.attendanceRecords.classSessionId, sessionId));
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
exports.attendanceMonitor = new AttendanceMonitor();
