import { api } from "./api";

interface MobileLoginRequest {
  email: string;
  password: string;
  deviceToken?: string;
  deviceType?: string;
}

interface DeviceRegistrationRequest {
  userId: string;
  deviceToken: string;
  deviceType: string;
  platform?: string;
}

interface QRAttendanceRequest {
  qrData: string | object;
  studentId: string;
  rfidDetected?: boolean;
}

interface OfflineSyncRequest {
  userId: string;
  offlineData: {
    attendanceRecords?: Array<{
      studentId: number;
      sessionId: number;
      timestamp: string;
      status: "present" | "late" | "absent";
    }>;
  };
  deviceInfo?: {
    deviceType: string;
    platform: string;
    appVersion: string;
  };
}

interface MobileDashboardData {
  user: {
    id: number;
    name: string;
    role: string;
  };
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    type: string;
    read: boolean;
    createdAt: string;
  }>;
  upcomingSessions: Array<{
    id: number;
    subject: string;
    date: string;
    startTime: string;
    classroom: string;
  }>;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

interface QRCodeData {
  qrCode: string;
  sessionData: {
    sessionId: number;
    type: string;
    timestamp: string;
    expiresAt: string;
  };
  qrText: string;
}

interface AttendanceRecord {
  recordId: number;
  status: "present" | "late" | "absent";
  timestamp: string;
}

interface SyncResult {
  results: {
    attendanceRecords: { success: number; failed: number };
    notifications: { sent: number; failed: number };
  };
  syncedAt: string;
}

interface MobileSessionData {
  session: {
    id: number;
    subject: string;
    date: string;
    startTime: string;
    endTime: string;
    classroom: string;
  };
  attendance: {
    present: number;
    late: number;
    absent: number;
    totalEnrolled: number;
    attendanceRate: number;
  };
}

class MobileApiClient {
  // Mobile-optimized authentication
  async mobileLogin(credentials: MobileLoginRequest) {
    return api.post("/mobile/auth/login", credentials);
  }

  // Register device for push notifications
  async registerDevice(deviceData: DeviceRegistrationRequest) {
    return api.post("/mobile/device/register", deviceData);
  }

  // Get mobile dashboard data
  async getMobileDashboard(userId: number) {
    return api.get(`/mobile/dashboard/${userId}`) as Promise<{
      success: boolean;
      data: MobileDashboardData;
    }>;
  }

  // Generate QR code for attendance
  async generateQRCode(sessionId: number) {
    return api.get(`/mobile/qr/generate/${sessionId}`) as Promise<{
      success: boolean;
      data: QRCodeData;
    }>;
  }

  // Record attendance via QR code
  async recordQRAttendance(attendanceData: QRAttendanceRequest) {
    return api.post("/mobile/qr/attendance", attendanceData) as Promise<{
      success: boolean;
      message: string;
      data: AttendanceRecord;
    }>;
  }

  // Sync offline data
  async syncOfflineData(syncData: OfflineSyncRequest) {
    return api.post("/mobile/sync", syncData) as Promise<{
      success: boolean;
      message: string;
      data: SyncResult;
    }>;
  }

  // Get mobile-optimized session data
  async getMobileSessionData(sessionId: number) {
    return api.get(`/mobile/sessions/${sessionId}/mobile`) as Promise<{
      success: boolean;
      data: MobileSessionData;
    }>;
  }

  // Quick attendance check (simplified)
  async quickAttendanceCheck(sessionId: number, studentId: number) {
    return api.post("/mobile/qr/attendance", {
      qrData: JSON.stringify({
        sessionId,
        type: "attendance_check",
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
      studentId: studentId.toString(),
      rfidDetected: false,
    });
  }

  // Get offline-compatible data for caching
  async getOfflineData(userId: number) {
    // Get essential data for offline use
    const [dashboard, notifications] = await Promise.all([
      this.getMobileDashboard(userId),
      api.get(`/notifications?userId=${userId}&limit=20`),
    ]);

    return {
      dashboard: dashboard.success ? dashboard.data : null,
      notifications: notifications.success ? notifications.data : [],
      lastSync: new Date().toISOString(),
    };
  }

  // Check network connectivity and sync status
  async checkConnectivity() {
    try {
      const response = await fetch(`${window.location.origin}/api/health`, {
        method: "GET",
        cache: "no-cache",
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Batch operations for better mobile performance
  async batchOperations(
    operations: Array<{
      type: "attendance" | "notification_read" | "device_register";
      data: any;
    }>
  ) {
    const results = [];

    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case "attendance":
            result = await this.recordQRAttendance(operation.data);
            break;
          case "notification_read":
            result = await api.put(
              `/notifications/${operation.data.notificationId}/read`,
              {
                userId: operation.data.userId,
              }
            );
            break;
          case "device_register":
            result = await this.registerDevice(operation.data);
            break;
          default:
            result = { success: false, message: "Unknown operation type" };
        }
        results.push({ operation: operation.type, result });
      } catch (error) {
        results.push({
          operation: operation.type,
          result: { success: false, message: "Operation failed" },
        });
      }
    }

    return results;
  }
}

export const mobileApi = new MobileApiClient();
export type {
  MobileLoginRequest,
  DeviceRegistrationRequest,
  QRAttendanceRequest,
  OfflineSyncRequest,
  MobileDashboardData,
  QRCodeData,
  AttendanceRecord,
  SyncResult,
  MobileSessionData,
};
