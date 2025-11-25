import { db } from '../storage.js';
import { iotDevices, classrooms } from '../schema.js';
import { eq } from 'drizzle-orm';
import { sendToDevice } from './websocket.js';
class IoTDeviceManager {
    deviceStatuses = new Map();
    async registerDevice(config) {
        try {
            const existingDevice = await db
                .select()
                .from(iotDevices)
                .where(eq(iotDevices.deviceId, config.deviceId))
                .limit(1);
            if (existingDevice.length > 0) {
                const [updatedDevice] = await db
                    .update(iotDevices)
                    .set({
                    classroomId: config.classroomId,
                    deviceType: config.deviceType,
                    config: config.config,
                    status: 'offline',
                    updatedAt: new Date()
                })
                    .where(eq(iotDevices.deviceId, config.deviceId))
                    .returning();
                console.log(`Updated IoT device: ${config.deviceId}`);
                return updatedDevice;
            }
            else {
                const [newDevice] = await db
                    .insert(iotDevices)
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
            await db
                .update(iotDevices)
                .set({
                status,
                lastSeen: now,
                config,
                updatedAt: now
            })
                .where(eq(iotDevices.deviceId, deviceId));
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
            const device = await db
                .select()
                .from(iotDevices)
                .where(eq(iotDevices.deviceId, deviceId))
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
            return await db
                .select({
                device: iotDevices,
                classroom: classrooms
            })
                .from(iotDevices)
                .innerJoin(classrooms, eq(iotDevices.classroomId, classrooms.id))
                .where(eq(iotDevices.classroomId, classroomId));
        }
        catch (error) {
            console.error('Error getting devices by classroom:', error);
            return [];
        }
    }
    async getAllDevices() {
        try {
            return await db
                .select({
                device: iotDevices,
                classroom: classrooms
            })
                .from(iotDevices)
                .innerJoin(classrooms, eq(iotDevices.classroomId, classrooms.id));
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
        return sendToDevice(deviceId, 'command', message);
    }
    async configureDevice(deviceId, config) {
        try {
            await db
                .update(iotDevices)
                .set({
                config,
                updatedAt: new Date()
            })
                .where(eq(iotDevices.deviceId, deviceId));
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
export const iotDeviceManager = new IoTDeviceManager();
iotDeviceManager.startPeriodicCleanup();
