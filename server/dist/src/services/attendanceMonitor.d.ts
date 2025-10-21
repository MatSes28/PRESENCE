interface RFIDScan {
    deviceId: string;
    rfidUid: string;
    timestamp: string;
}
interface SensorTrigger {
    deviceId: string;
    sensorType: 'entry' | 'exit';
    distance: number;
    timestamp: string;
}
declare class AttendanceMonitor {
    private activeSessions;
    private validationWindow;
    processRFIDScan(scan: RFIDScan): Promise<{
        success: boolean;
        message: string;
        student?: never;
        session?: never;
    } | {
        success: boolean;
        student: any;
        session: any;
        message?: never;
    }>;
    processSensorTrigger(trigger: SensorTrigger): Promise<{
        success: boolean;
        message: string;
        student?: never;
        session?: never;
        triggerType?: never;
    } | {
        success: boolean;
        student: any;
        session: any;
        triggerType: "entry" | "exit";
        message?: never;
    }>;
    private findActiveClassSession;
    private findRecentRFIDScans;
    private createAttendanceRecord;
    private updateAttendanceRecord;
    private createDiscrepancyRecord;
    validateAttendanceRecord(recordId: number): Promise<void>;
    getAttendanceStats(sessionId: number): Promise<{
        totalRecords: any;
        validRecords: any;
        discrepancies: any;
        rfidOnly: any;
        sensorOnly: any;
    }>;
}
export declare const attendanceMonitor: AttendanceMonitor;
export {};
//# sourceMappingURL=attendanceMonitor.d.ts.map