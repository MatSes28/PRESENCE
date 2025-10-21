interface DeviceConfig {
    deviceId: string;
    classroomId: number;
    deviceType: string;
    config?: any;
}
interface DeviceStatus {
    deviceId: string;
    status: 'online' | 'offline' | 'maintenance';
    lastSeen: Date;
    config?: any;
}
declare class IoTDeviceManager {
    private deviceStatuses;
    registerDevice(config: DeviceConfig): Promise<any>;
    updateDeviceStatus(deviceId: string, status: DeviceStatus['status'], config?: any): Promise<void>;
    getDeviceStatus(deviceId: string): Promise<DeviceStatus | null>;
    getDevicesByClassroom(classroomId: number): Promise<any>;
    getAllDevices(): Promise<any>;
    sendCommandToDevice(deviceId: string, command: string, params?: any): Promise<boolean>;
    configureDevice(deviceId: string, config: any): Promise<boolean>;
    restartDevice(deviceId: string): Promise<boolean>;
    updateDeviceFirmware(deviceId: string, firmwareUrl: string): Promise<boolean>;
    getOnlineDevices(): Promise<string[]>;
    cleanupOfflineDevices(): Promise<void>;
    startPeriodicCleanup(): void;
    getDeviceStats(): Promise<{
        total: any;
        online: number;
        offline: number;
        byType: any;
    }>;
}
export declare const iotDeviceManager: IoTDeviceManager;
export {};
//# sourceMappingURL=iotDeviceManager.d.ts.map