"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iotDeviceManager = void 0;
const storage_js_1 = require("../storage.js");
const schema_js_1 = require("../schema.js");
const drizzle_orm_1 = require("drizzle-orm");
const websocket_js_1 = require("./websocket.js");
class IoTDeviceManager {
    deviceStatuses = new Map();
    async registerDevice(config) {
        try {
            const existingDevice = await storage_js_1.db
                .select()
                .from(schema_js_1.iotDevices)
                .where((0, drizzle_orm_1.eq)(schema_js_1.iotDevices.deviceId, config.deviceId))
                .limit(1);
            if (existingDevice.length > 0) {
                const [updatedDevice] = await storage_js_1.db
                    .update(schema_js_1.iotDevices)
                    .set({
                    classroomId: config.classroomId,
                    deviceType: config.deviceType,
                    config: config.config,
                    status: 'offline',
                    updatedAt: new Date()
                })
                    .where((0, drizzle_orm_1.eq)(schema_js_1.iotDevices.deviceId, config.deviceId))
                    .returning();
                console.log(`Updated IoT device: ${config.deviceId}`);
                return updatedDevice;
            }
            else {
                const [newDevice] = await storage_js_1.db
                    .insert(schema_js_1.iotDevices)
                    .values({
                    deviceId: config.deviceId,
                    classroomId: config.classroomId,
                    deviceType: config.deviceType,
                    config: config.config,
                    status: 'offline'
                })
                    .returning();
                console.log(`Registered new IoT device: ${config.deviceId}`);
                return newDevice;
            }
        }
        catch (error) {
            console.error('Error registering IoT device:', error);
            throw error;
        }
    }
    async updateDeviceStatus(deviceId, status, config) {
        try {
            const now = new Date();
            this.deviceStatuses.set(deviceId, {
                deviceId,
                status,
                lastSeen: now,
                config
            });
            await storage_js_1.db
                .update(schema_js_1.iotDevices)
                .set({
                status,
                lastSeen: now,
                config,
                updatedAt: now
            })
                .where((0, drizzle_orm_1.eq)(schema_js_1.iotDevices.deviceId, deviceId));
            console.log(`Updated device status: ${deviceId} -> ${status}`);
        }
        catch (error) {
            console.error('Error updating device status:', error);
        }
    }
    async getDeviceStatus(deviceId) {
        const cached = this.deviceStatuses.get(deviceId);
        if (cached && (Date.now() - cached.lastSeen.getTime()) < 60000) {
            return cached;
        }
        try {
            const device = await storage_js_1.db
                .select()
                .from(schema_js_1.iotDevices)
                .where((0, drizzle_orm_1.eq)(schema_js_1.iotDevices.deviceId, deviceId))
                .limit(1);
            if (device.length > 0) {
                const dbDevice = device[0];
                const status = {
                    deviceId: dbDevice.deviceId,
                    status: dbDevice.status,
                    lastSeen: dbDevice.lastSeen || new Date(),
                    config: dbDevice.config
                };
                this.deviceStatuses.set(deviceId, status);
                return status;
            }
        }
        catch (error) {
            console.error('Error getting device status:', error);
        }
        return null;
    }
    async getDevicesByClassroom(classroomId) {
        try {
            return await storage_js_1.db
                .select({
                device: schema_js_1.iotDevices,
                classroom: schema_js_1.classrooms
            })
                .from(schema_js_1.iotDevices)
                .innerJoin(schema_js_1.classrooms, (0, drizzle_orm_1.eq)(schema_js_1.iotDevices.classroomId, schema_js_1.classrooms.id))
                .where((0, drizzle_orm_1.eq)(schema_js_1.iotDevices.classroomId, classroomId));
        }
        catch (error) {
            console.error('Error getting devices by classroom:', error);
            return [];
        }
    }
    async getAllDevices() {
        try {
            return await storage_js_1.db
                .select({
                device: schema_js_1.iotDevices,
                classroom: schema_js_1.classrooms
            })
                .from(schema_js_1.iotDevices)
                .innerJoin(schema_js_1.classrooms, (0, drizzle_orm_1.eq)(schema_js_1.iotDevices.classroomId, schema_js_1.classrooms.id));
        }
        catch (error) {
            console.error('Error getting all devices:', error);
            return [];
        }
    }
    async sendCommandToDevice(deviceId, command, params) {
        const message = {
            type: 'command',
            command,
            params,
            timestamp: new Date().toISOString()
        };
        return (0, websocket_js_1.sendToDevice)(deviceId, 'command', message);
    }
    async configureDevice(deviceId, config) {
        try {
            await storage_js_1.db
                .update(schema_js_1.iotDevices)
                .set({
                config,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_js_1.iotDevices.deviceId, deviceId));
            return this.sendCommandToDevice(deviceId, 'update_config', config);
        }
        catch (error) {
            console.error('Error configuring device:', error);
            return false;
        }
    }
    async restartDevice(deviceId) {
        return this.sendCommandToDevice(deviceId, 'restart');
    }
    async updateDeviceFirmware(deviceId, firmwareUrl) {
        return this.sendCommandToDevice(deviceId, 'update_firmware', { firmwareUrl });
    }
    async getOnlineDevices() {
        const onlineDevices = [];
        for (const [deviceId, status] of this.deviceStatuses) {
            if (status.status === 'online' &&
                (Date.now() - status.lastSeen.getTime()) < 300000) {
                onlineDevices.push(deviceId);
            }
        }
        return onlineDevices;
    }
    async cleanupOfflineDevices() {
        const now = Date.now();
        const offlineThreshold = 10 * 60 * 1000;
        for (const [deviceId, status] of this.deviceStatuses) {
            if ((now - status.lastSeen.getTime()) > offlineThreshold) {
                await this.updateDeviceStatus(deviceId, 'offline');
            }
        }
        console.log('Cleaned up offline devices');
    }
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupOfflineDevices();
        }, 5 * 60 * 1000);
    }
    async getDeviceStats() {
        const allDevices = await this.getAllDevices();
        const onlineDevices = await this.getOnlineDevices();
        return {
            total: allDevices.length,
            online: onlineDevices.length,
            offline: allDevices.length - onlineDevices.length,
            byType: allDevices.reduce((acc, item) => {
                const type = item.device.classroomId.toString();
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {})
        };
    }
}
exports.iotDeviceManager = new IoTDeviceManager();
exports.iotDeviceManager.startPeriodicCleanup();
