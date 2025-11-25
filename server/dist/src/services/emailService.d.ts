interface EmailOptions {
    to: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
}
declare class EmailService {
    private apiInstance;
    constructor();
    sendEmail(options: EmailOptions): Promise<boolean>;
    sendAttendanceNotification(parentEmail: string, studentName: string, status: 'present' | 'late' | 'absent', classInfo: string, timestamp: Date): Promise<boolean>;
    sendBulkAttendanceNotifications(notifications: Array<{
        parentEmail: string;
        studentName: string;
        status: 'present' | 'late' | 'absent';
        classInfo: string;
        timestamp: Date;
    }>): Promise<{
        success: number;
        failed: number;
    }>;
    sendSystemAlert(adminEmail: string, alertType: string, message: string, details?: any): Promise<boolean>;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=emailService.d.ts.map