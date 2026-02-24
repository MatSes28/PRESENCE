import { useAuth } from "../hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { getWebSocketClient } from "../lib/websocket";
import { api } from "../lib/api";
import { useLocation } from "wouter";
import { useNotifications } from "../components/NotificationSystem";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// Enhanced Dashboard with Statistics Cards and Tabs
// Main Dashboard interface with comprehensive management features

interface DashboardStats {
  todayClasses: number;
  presentStudents: number;
  absentStudents: number;
  attendanceRate: number;
  totalEvents: number;
  activeDevices: number;
  systemUptime: string;
  errorRate: number;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [realTimeData, setRealTimeData] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    todayClasses: 0,
    presentStudents: 0,
    absentStudents: 0,
    attendanceRate: 0,
    totalEvents: 0,
    activeDevices: 0,
    systemUptime: "0d 0h 0m",
    errorRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("7d");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [sessionFormData, setSessionFormData] = useState({
    scheduleId: "",
    action: "create", // create or activate
  });

  // Security tab
  const [securityMetrics, setSecurityMetrics] = useState<any>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Performance tab
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  // RFID Tools tab
  const [rfidSimulateUid, setRfidSimulateUid] = useState("");
  const [rfidSimulateLoading, setRfidSimulateLoading] = useState(false);
  const [rfidActivityList, setRfidActivityList] = useState<any[]>([]);
  const [rfidActivityLoading, setRfidActivityLoading] = useState(false);
  const [rfidDevices, setRfidDevices] = useState<any[]>([]);
  const [notificationSending, setNotificationSending] = useState(false);
  const [activeSessionsList, setActiveSessionsList] = useState<any[]>([]);
  const [rfidDiagnosticLoading, setRfidDiagnosticLoading] = useState<string | null>(null);
  const [rfidEmergencyActive, setRfidEmergencyActive] = useState(false);
  const [rfidCalibrationLast, setRfidCalibrationLast] = useState<string | null>(null);
  const [showEmergencyStopConfirm, setShowEmergencyStopConfirm] = useState(false);

  // Data persistence keys
  const STORAGE_KEYS = {
    DASHBOARD_STATS: "dashboard_stats",
    REAL_TIME_DATA: "real_time_data",
    ANALYTICS_DATA: "analytics_data",
    LAST_UPDATED: "dashboard_last_updated",
  };

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = () => {
      try {
        const persistedStats = localStorage.getItem(
          STORAGE_KEYS.DASHBOARD_STATS
        );
        const persistedRealTimeData = localStorage.getItem(
          STORAGE_KEYS.REAL_TIME_DATA
        );
        const lastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);

        if (persistedStats) {
          const stats = JSON.parse(persistedStats);
          // Only use persisted data if it's less than 5 minutes old
          if (
            lastUpdated &&
            Date.now() - parseInt(lastUpdated) < 5 * 60 * 1000
          ) {
            setDashboardStats(stats);
            setLoading(false); // Show persisted data immediately
          }
        }

        if (persistedRealTimeData) {
          const realTimeData = JSON.parse(persistedRealTimeData);
          setRealTimeData(realTimeData);
        }
      } catch (error) {
        console.warn("Failed to load persisted dashboard data:", error);
      }
    };

    loadPersistedData();
  }, []);

  // Persist data when it changes
  const persistData = useCallback((key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());
    } catch (error) {
      console.warn("Failed to persist dashboard data:", error);
    }
  }, []);

  // Update persisted data when stats change
  useEffect(() => {
    if (!loading) {
      persistData(STORAGE_KEYS.DASHBOARD_STATS, dashboardStats);
    }
  }, [dashboardStats, loading, persistData]);

  // Update persisted data when real-time data changes
  useEffect(() => {
    persistData(STORAGE_KEYS.REAL_TIME_DATA, realTimeData);
  }, [realTimeData, persistData]);

  // Fetch dashboard statistics with retry logic
  const fetchDashboardStats = useCallback(
    async (isRetry = false) => {
      // Only fetch if user is authenticated
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        if (!isRetry) setLoading(true);
        setError(null);

        const [statsResponse, sessionsResponse] = await Promise.all([
          api.get("/dashboard/stats"),
          api.getActiveSessions().catch(() => ({ success: false, data: [] })),
        ]);
        if (statsResponse.success && statsResponse.data) {
          const data = statsResponse.data as Partial<DashboardStats>;
          setDashboardStats((prev) => ({
            ...prev,
            ...data,
            activeDevices: deviceStatus.length > 0
              ? deviceStatus.filter((d) => d.status === "online").length
              : (data.activeDevices ?? prev.activeDevices),
          }));
          setRetryCount(0); // Reset retry count on success
        }
        if (sessionsResponse.success && Array.isArray(sessionsResponse.data)) {
          setActiveSessionsList(sessionsResponse.data);
        } else {
          setActiveSessionsList([]);
        }
        if (!statsResponse.success || !statsResponse.data) {
          throw new Error(
            statsResponse.message || "Failed to load dashboard statistics"
          );
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        setError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );

        // Retry logic (max 3 retries with exponential backoff)
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            fetchDashboardStats(true);
          }, delay);
        } else {
          addNotification({
            type: "error",
            title: "Dashboard Error",
            message:
              "Failed to load dashboard data after multiple attempts. Using cached data if available.",
          });
        }
      } finally {
        if (!isRetry) setLoading(false);
      }
    },
    [user, deviceStatus, retryCount, addNotification]
  );

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    } else {
      setLoading(false);
    }
  }, [user, fetchDashboardStats]);

  // Fetch analytics data
  const fetchAnalytics = async (period: string = "7d") => {
    try {
      setAnalyticsLoading(true);
      const response = await api.getAnalytics(period);
      if (response.success && response.data) {
        setAnalyticsData(response.data);
      } else {
        console.error(
          "Failed to load preview data:",
          response?.message || "No data returned"
        );
        addNotification({
          type: "error",
          title: "Analytics Error",
          message: response?.message || "Failed to load analytics data",
        });
      }
    } catch (error) {
      console.error("Failed to load preview data:", error);
      addNotification({
        type: "error",
        title: "Analytics Error",
        message: "Failed to load analytics data. Please try again.",
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load analytics when Analytics tab is selected
  useEffect(() => {
    if (activeTab === "analytics" && !analyticsData) {
      fetchAnalytics(analyticsPeriod);
    }
  }, [activeTab, analyticsData, analyticsPeriod]);

  // Load security metrics when Security tab is selected
  const fetchSecurityMetrics = useCallback(async () => {
    setSecurityError(null);
    setSecurityLoading(true);
    try {
      const res = await api.getSecurityMetrics();
      if (res.success && res.data) {
        setSecurityMetrics(res.data);
        setSecurityError(null);
      } else {
        setSecurityMetrics(null);
        setSecurityError(res.message || "Failed to load security metrics");
      }
    } catch (error: any) {
      setSecurityMetrics(null);
      setSecurityError(error?.message || "Failed to load security metrics");
    } finally {
      setSecurityLoading(false);
    }
  }, []);
  useEffect(() => {
    if (activeTab === "security") fetchSecurityMetrics();
  }, [activeTab, fetchSecurityMetrics]);

  // Load performance metrics when Performance tab is selected
  const fetchPerformanceMetrics = useCallback(async () => {
    setPerformanceError(null);
    setPerformanceLoading(true);
    try {
      const res = await api.getPerformanceMetrics();
      if (res.success && res.data) {
        setPerformanceMetrics(res.data);
        setPerformanceError(null);
      } else {
        setPerformanceMetrics(null);
        setPerformanceError((res as any).message || "Failed to load performance metrics");
      }
    } catch (error: any) {
      setPerformanceMetrics(null);
      setPerformanceError(error?.message || "Failed to load performance metrics");
    } finally {
      setPerformanceLoading(false);
    }
  }, []);
  useEffect(() => {
    if (activeTab === "performance") fetchPerformanceMetrics();
  }, [activeTab, fetchPerformanceMetrics]);

  // Load activity, devices, emergency status, and calibration for RFID Tools tab
  useEffect(() => {
    if (activeTab !== "rfid-tools") return;
    const load = async () => {
      setRfidActivityLoading(true);
      try {
        const [activityRes, devicesRes, emergencyRes, calibrationRes] = await Promise.all([
          api.getDashboardActivity(),
          api.getIoTDevices(),
          api.getRfidEmergencyStatus().catch(() => ({ success: false, data: { active: false } })),
          api.getRfidCalibrationStatus().catch(() => ({ success: false, data: { lastCalibration: null } })),
        ]);
        if (activityRes.success && Array.isArray(activityRes.data)) {
          setRfidActivityList(
            activityRes.data.map((a: any) => ({
              type: "success",
              message: a.message || "Attendance event",
              time: a.timestamp
                ? new Date(a.timestamp).toLocaleString()
                : "",
              device: "System",
            }))
          );
        } else setRfidActivityList([]);
        if (devicesRes.success && Array.isArray((devicesRes as any).devices)) {
          setRfidDevices((devicesRes as any).devices);
        } else setRfidDevices([]);
        if (emergencyRes.success && emergencyRes.data) setRfidEmergencyActive(!!(emergencyRes.data as any).active);
        if (calibrationRes.success && (calibrationRes.data as any)?.lastCalibration) setRfidCalibrationLast((calibrationRes.data as any).lastCalibration);
        else setRfidCalibrationLast(null);
      } catch {
        setRfidActivityList([]);
        setRfidDevices([]);
      } finally {
        setRfidActivityLoading(false);
      }
    };
    load();
  }, [activeTab]);

  // Fetch available schedules for session management
  const fetchAvailableSchedules = async () => {
    try {
      const response = await api.getSchedules();
      if (response.success && Array.isArray(response.data)) {
        // Filter schedules for today
        const today = new Date().getDay();
        const todaySchedules = response.data.filter(
          (schedule: any) => schedule.dayOfWeek === today
        );
        setAvailableSchedules(todaySchedules);
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
    }
  };

  // Handle sending notifications (calls backend to send automated attendance alerts)
  const handleSendNotifications = async () => {
    setNotificationSending(true);
    try {
      const res = await api.sendAutomatedAttendanceAlerts();
      if (res.success) {
        addNotification({
          type: "success",
          title: "Notifications Sent",
          message:
            res.message ||
            "Attendance notifications have been sent to parents of absent students.",
        });
      } else {
        addNotification({
          type: "error",
          title: "Notification Failed",
          message: (res as any).message || "Failed to send notifications.",
        });
      }
    } catch (error: any) {
      addNotification({
        type: "error",
        title: "Notification Failed",
        message: error?.message || "Failed to send notifications. Please try again.",
      });
    } finally {
      setNotificationSending(false);
    }
  };

  const runRfidDiagnostic = async (action: string, apiCall: () => Promise<any>, successTitle: string) => {
    setRfidDiagnosticLoading(action);
    try {
      const res = await apiCall();
      if (res.success) {
        addNotification({ type: "success", title: successTitle, message: (res as any).message || "Done." });
        if (action === "reset-cache") {
          const devicesRes = await api.getIoTDevices();
          if (devicesRes.success && Array.isArray((devicesRes as any).devices)) setRfidDevices((devicesRes as any).devices);
        }
        if (action === "emergency-stop") setRfidEmergencyActive(true);
        if (action === "resume") setRfidEmergencyActive(false);
        if (action === "run-calibration") {
          setRfidCalibrationLast((res as any).data?.ranAt || new Date().toISOString());
          const devicesRes = await api.getIoTDevices();
          if (devicesRes.success && Array.isArray((devicesRes as any).devices)) setRfidDevices((devicesRes as any).devices);
        }
      } else {
        addNotification({ type: "error", title: successTitle, message: (res as any).message || "Request failed." });
      }
    } catch (err: any) {
      addNotification({ type: "error", title: successTitle, message: err?.message || "Request failed." });
    } finally {
      setRfidDiagnosticLoading(null);
    }
  };

  const handleCheckCardDatabase = async () => {
    setRfidDiagnosticLoading("check-cards");
    try {
      const res = await api.checkCardDatabase();
      if (res.success && res.data) {
        const d = res.data as { studentsWithRfid: number; totalStudents: number; withoutRfid: number };
        addNotification({
          type: "info",
          title: "Card Database",
          message: `${d.studentsWithRfid} students with RFID, ${d.withoutRfid} without. Total: ${d.totalStudents}.`,
        });
      } else {
        addNotification({ type: "error", title: "Card Database", message: (res as any).message || "Failed." });
      }
    } catch (err: any) {
      addNotification({ type: "error", title: "Card Database", message: err?.message || "Failed." });
    } finally {
      setRfidDiagnosticLoading(null);
    }
  };

  useEffect(() => {
    const wsClient = getWebSocketClient(user?.id);

    // Subscribe to real-time updates
    wsClient.on("rfidScan", (data) => {
      setRealTimeData((prev) => [data, ...prev.slice(0, 9)]);
      setDashboardStats((prev) => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
        presentStudents: prev.presentStudents + 1,
      }));
    });

    wsClient.on("sensorTrigger", (data) => {
      setRealTimeData((prev) => [data, ...prev.slice(0, 9)]);
      setDashboardStats((prev) => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
      }));
    });

    wsClient.on("attendanceRecord", (data) => {
      setRealTimeData((prev) => [data, ...prev.slice(0, 9)]);
      setDashboardStats((prev) => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
        presentStudents: data.isValid
          ? prev.presentStudents + 1
          : prev.presentStudents,
        absentStudents: !data.isValid
          ? prev.absentStudents + 1
          : prev.absentStudents,
        attendanceRate: data.isValid
          ? ((prev.presentStudents + 1) /
              (prev.presentStudents + prev.absentStudents + 1)) *
            100
          : (prev.presentStudents /
              (prev.presentStudents + prev.absentStudents + 1)) *
            100,
      }));
    });

    wsClient.on("deviceStatus", (data) => {
      setDeviceStatus(data);
      setDashboardStats((prev) => ({
        ...prev,
        activeDevices: data.filter((d: any) => d.status === "online").length,
      }));
    });

    // Get initial device status
    wsClient.getDeviceStatus();

    return () => {
      wsClient.off("rfidScan");
      wsClient.off("sensorTrigger");
      wsClient.off("attendanceRecord");
      wsClient.off("deviceStatus");
    };
  }, [user?.id]);

  // Loading Skeleton Component
  const StatCardSkeleton = () => (
    <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700 animate-pulse">
      <div className="flex items-center">
        <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
        <div className="ml-4 flex-1">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-1/4"></div>
        </div>
      </div>
    </div>
  );

  // Error State Component
  const ErrorState = ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div className="bg-red-900 border border-red-600 rounded-lg p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-red-400 text-2xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-400">Dashboard Error</h3>
          <p className="text-sm text-red-200 mt-1">{message}</p>
          <button
            onClick={onRetry}
            className="mt-3 bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );

  // Statistics Card Component
  const StatCard = ({
    title,
    value,
    icon,
    trend,
    trendValue,
    color = "blue",
    loading = false,
  }: {
    title: string;
    value: string | number;
    icon: string;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    color?: string;
    loading?: boolean;
  }) => {
    if (loading) return <StatCardSkeleton />;

    return (
      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <div className="flex items-center">
          <div
            className={`w-12 h-12 bg-${color}-500 rounded-full flex items-center justify-center`}
          >
            <span className="text-white text-lg">{icon}</span>
          </div>
          <div className="ml-4">
            <dt className="text-sm font-medium text-gray-300 truncate">
              {title}
            </dt>
            <dd className="text-2xl font-semibold text-white">{value}</dd>
            {trend && trendValue && (
              <div
                className={`flex items-center text-sm ${
                  trend === "up"
                    ? "text-green-400"
                    : trend === "down"
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              >
                <span>
                  {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}
                </span>
                <span className="ml-1">{trendValue}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle session creation
  const handleStartSession = async () => {
    if (!sessionFormData.scheduleId) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please select a schedule",
      });
      return;
    }

    try {
      let response;
      if (sessionFormData.action === "create") {
        // Create sessions for today
        response = await api.createClassSessionsForDate(
          new Date().toISOString().split("T")[0]
        );
      } else {
        // Activate existing sessions
        response = await api.activateSessions();
      }

      if (response.success) {
        addNotification({
          type: "success",
          title: "Session Started",
          message: `Session ${
            sessionFormData.action === "create" ? "created" : "activated"
          } successfully`,
        });
        setShowSessionModal(false);
        // Refresh dashboard stats
        // You could trigger a refresh here
      } else {
        addNotification({
          type: "error",
          title: "Session Start Failed",
          message: response.message || "Failed to start session",
        });
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to start session. Please try again.",
      });
    }
  };

  // Fetch schedules when modal opens
  useEffect(() => {
    if (showSessionModal) {
      fetchAvailableSchedules();
    }
  }, [showSessionModal]);

  // Modal Component for Session Management
  const StartSessionModal = ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
          <h3 className="text-lg font-medium text-cyan-400 mb-4">
            Start New Session
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Schedule
              </label>
              <select
                value={sessionFormData.scheduleId}
                onChange={(e) =>
                  setSessionFormData({
                    ...sessionFormData,
                    scheduleId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="">Select a schedule...</option>
                {availableSchedules.map((schedule: any) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.subjectName} - {schedule.classroomName} (
                    {schedule.startTime}-{schedule.endTime})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Action
              </label>
              <select
                value={sessionFormData.action}
                onChange={(e) =>
                  setSessionFormData({
                    ...sessionFormData,
                    action: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="create">Create New Session</option>
                <option value="activate">Activate Existing Session</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => {
                onClose();
                setSessionFormData({ scheduleId: "", action: "create" });
              }}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleStartSession}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Start Session
            </button>
          </div>
        </div>
      </div>
    );
  };

  const overviewContent = (
    <div className="space-y-6">
      {/* Error State */}
      {error && !loading && (
        <ErrorState message={error} onRetry={() => fetchDashboardStats()} />
      )}

      {/* Statistics Cards – show — when API failed so we never display 0 as fake data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Classes"
          value={error ? "—" : dashboardStats.todayClasses}
          icon="📚"
          trend="neutral"
          trendValue={error ? "Error" : "Live"}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Present Students"
          value={error ? "—" : dashboardStats.presentStudents}
          icon="✅"
          trend="neutral"
          trendValue={error ? "Error" : "Live"}
          color="green"
          loading={loading}
        />
        <StatCard
          title="Absent Students"
          value={error ? "—" : dashboardStats.absentStudents}
          icon="❌"
          trend="neutral"
          trendValue={error ? "Error" : "Live"}
          color="red"
          loading={loading}
        />
        <StatCard
          title="Attendance Rate"
          value={error ? "—" : `${dashboardStats.attendanceRate}%`}
          icon="📊"
          trend="neutral"
          trendValue={error ? "Error" : "Live"}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Active Sessions and Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Active Sessions
          </h4>
          <div className="space-y-3">
            {activeSessionsList.length > 0 ? (
              activeSessionsList.map((s: any) => (
                <div key={s.id} className="flex justify-between items-center">
                  <span className="text-gray-300 truncate">
                    {s.subjectName ?? "Session"} — {s.classroomName ?? ""}
                  </span>
                  <span className="text-green-400 flex-shrink-0 capitalize">{s.status ?? "Active"}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No active sessions right now.</p>
            )}
          </div>
          <button
            onClick={() => setShowSessionModal(true)}
            className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Start New Session
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Quick Actions
          </h4>
          <div className="space-y-3">
            <button
              onClick={() => setLocation("/students")}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded"
            >
              📚 Add Students
            </button>
            <button
              onClick={() => setLocation("/reports")}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded"
            >
              📊 View Reports
            </button>
            <button
              type="button"
              onClick={handleSendNotifications}
              disabled={notificationSending}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {notificationSending ? "⏳ Sending…" : "📢 Send Notifications"}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            System Overview
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Total Events</span>
              <span className="text-white">{error ? "—" : (dashboardStats.totalEvents ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Active Devices</span>
              <span className="text-white">{error ? "—" : (dashboardStats.activeDevices ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Activity */}
      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          Real-time Activity
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {realTimeData.length === 0 ? (
            <p className="text-gray-400">No recent activity</p>
          ) : (
            realTimeData.map((data: any, index: number) => (
              <div
                key={index}
                className="bg-gray-700 p-3 rounded border border-gray-600"
              >
                <p className="text-xs text-gray-400">
                  {new Date(data.timestamp).toLocaleTimeString()}
                </p>
                <p className="text-sm text-white">
                  {data.type === "rfid_scan" && `RFID: ${data.rfidUid}`}
                  {data.type === "sensor_trigger" &&
                    `${data.sensorType} sensor: ${data.distance}cm`}
                  {data.type === "attendance_record" && `Attendance recorded`}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Analytics Tab Content
  const analyticsContent = (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-white">Analytics Dashboard</h3>
        <div className="flex space-x-2">
          {["7d", "30d", "90d"].map((period) => (
            <button
              key={period}
              onClick={() => {
                setAnalyticsPeriod(period);
                fetchAnalytics(period);
              }}
              className={`px-3 py-1 text-sm rounded ${
                analyticsPeriod === period
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {period === "7d"
                ? "7 Days"
                : period === "30d"
                ? "30 Days"
                : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      ) : analyticsData ? (
        <>
          {/* Daily Attendance Trends Chart */}
          <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h4 className="text-lg font-medium text-cyan-400 mb-4">
              Daily Attendance Trends
            </h4>
            {(!analyticsData.dailyTrends || analyticsData.dailyTrends.length === 0) ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No attendance data in this period. Record attendance to see trends.
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "0.5rem",
                  }}
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString()
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="present"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Present"
                />
                <Line
                  type="monotone"
                  dataKey="absent"
                  stroke="#EF4444"
                  strokeWidth={2}
                  name="Absent"
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  name="Attendance Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>

          {/* Hourly Patterns and Subject Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-cyan-400 mb-4">
                Hourly Attendance Patterns
              </h4>
              {(!analyticsData.hourlyPatterns || analyticsData.hourlyPatterns.length === 0) ? (
                <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                  No hourly data in this period.
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analyticsData.hourlyPatterns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="hour"
                    stroke="#9CA3AF"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}:00`}
                  />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "1px solid #374151",
                      borderRadius: "0.5rem",
                    }}
                    labelFormatter={(value) => `${value}:00`}
                  />
                  <Bar
                    dataKey="count"
                    fill="#06B6D4"
                    name="Attendance Events"
                  />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>

            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-cyan-400 mb-4">
                Subject Performance
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {(!analyticsData.subjectPerformance || analyticsData.subjectPerformance.length === 0) ? (
                  <p className="text-gray-400 text-sm">No subject data in this period.</p>
                ) : analyticsData.subjectPerformance.map(
                  (subject: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <span className="text-gray-300 text-sm">
                        {subject.subject}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${subject.rate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-white w-10 text-right">
                          {subject.rate}%
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Faculty Performance */}
          <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
            <h4 className="text-lg font-medium text-cyan-400 mb-4">
              Faculty Performance
            </h4>
            {(!analyticsData.facultyPerformance || analyticsData.facultyPerformance.length === 0) ? (
              <p className="text-gray-400 text-sm">No faculty data in this period.</p>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyticsData.facultyPerformance.map(
                (faculty: any, index: number) => (
                  <div key={index} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300 text-sm font-medium">
                        {faculty.faculty}
                      </span>
                      <span className="text-cyan-400 text-sm">
                        {faculty.rate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full"
                        style={{ width: `${faculty.rate}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {faculty.total} sessions
                    </div>
                  </div>
                )
              )}
            </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">Analytics data could not be loaded.</p>
          <button
            type="button"
            onClick={() => fetchAnalytics(analyticsPeriod)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );

  // Security Tab Content
  const securityContent = (
    <div className="space-y-6">
      {securityLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      ) : securityError ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{securityError}</p>
          <button
            type="button"
            onClick={fetchSecurityMetrics}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium min-h-[44px]"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Security Score"
          value={securityMetrics?.securityScore != null ? `${Math.round(securityMetrics.securityScore)}%` : "—"}
          icon="🛡️"
          trend="neutral"
          trendValue={securityMetrics ? "Live" : "No data"}
          color="gray"
        />
        <StatCard
          title="Failed Logins"
          value={securityMetrics?.failedLogins != null ? String(securityMetrics.failedLogins) : "—"}
          icon="🚫"
          trend="neutral"
          trendValue={securityMetrics ? "7d" : "—"}
          color="gray"
        />
        <StatCard
          title="Successful Logins"
          value={securityMetrics?.successfulLogins != null ? String(securityMetrics.successfulLogins) : "—"}
          icon="🔐"
          trend="neutral"
          trendValue={securityMetrics ? "7d" : "—"}
          color="gray"
        />
        <StatCard
          title="Login Success Rate"
          value={securityMetrics?.loginSuccessRate != null ? `${securityMetrics.loginSuccessRate}%` : "—"}
          icon="✅"
          trend="neutral"
          trendValue={securityMetrics ? "Live" : "—"}
          color="gray"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Recent Security Events
          </h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {securityMetrics?.suspiciousActivities?.length > 0 ? securityMetrics.suspiciousActivities.slice(0, 10).map((event: any, index: number) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{event.action || event.description}</p>
                  <p className="text-xs text-gray-400">
                    {event.timestamp ? new Date(event.timestamp).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-gray-400 text-sm">No security events in this period. System is secure.</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Access Control
          </h4>
          <div className="space-y-4">
            {securityMetrics?.accessControl ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Session-based auth</span>
                  <span className="text-green-400">{securityMetrics.accessControl.sessionAuth ? "Enabled" : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Password hashing</span>
                  <span className="text-green-400">{securityMetrics.accessControl.passwordHashing || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Rate limiting</span>
                  <span className="text-green-400">{securityMetrics.accessControl.rateLimiting ? "Enabled" : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Audit logging</span>
                  <span className="text-green-400">{securityMetrics.accessControl.auditLogging ? "Active" : "—"}</span>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Load security metrics to see access control status.</p>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Security Alerts (by severity)
          </h4>
          <div className="space-y-2 text-sm text-gray-400">
            {securityMetrics ? (
              <>High: {securityMetrics.bySeverity?.high ?? 0} · Medium: {securityMetrics.bySeverity?.medium ?? 0} · Low: {securityMetrics.bySeverity?.low ?? 0}</>
            ) : (
              <p>No alert data for this period.</p>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );

  // Performance Tab Content
  const performanceContent = (
    <div className="space-y-6">
      {performanceLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      ) : performanceError ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{performanceError}</p>
          <button
            type="button"
            onClick={fetchPerformanceMetrics}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium min-h-[44px]"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Performance Score"
          value={performanceMetrics?.performanceScore != null ? `${performanceMetrics.performanceScore}%` : "—"}
          icon="📈"
          trend="neutral"
          trendValue={performanceMetrics ? "Live" : "No data"}
          color="gray"
        />
        <StatCard
          title="Avg Response Time"
          value={performanceMetrics?.api?.avgResponseTime != null ? `${performanceMetrics.api.avgResponseTime}ms` : "—"}
          icon="⚡"
          trend="neutral"
          trendValue={performanceMetrics ? "24h" : "—"}
          color="gray"
        />
        <StatCard
          title="Total Requests"
          value={performanceMetrics?.api?.totalRequests != null ? String(performanceMetrics.api.totalRequests) : "—"}
          icon="📡"
          trend="neutral"
          trendValue={performanceMetrics ? "24h" : "—"}
          color="gray"
        />
        <StatCard
          title="Error Rate"
          value={performanceMetrics?.api?.errorRate != null ? `${performanceMetrics.api.errorRate}%` : "—"}
          icon="⚠️"
          trend="neutral"
          trendValue={performanceMetrics ? "24h" : "—"}
          color="gray"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            API Performance
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Average Response</span>
              <span className="text-gray-400">{performanceMetrics?.api?.avgResponseTime != null ? `${performanceMetrics.api.avgResponseTime}ms` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Total Requests</span>
              <span className="text-gray-400">{performanceMetrics?.api?.totalRequests != null ? performanceMetrics.api.totalRequests : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Error Count</span>
              <span className="text-gray-400">{performanceMetrics?.api?.errorCount != null ? performanceMetrics.api.errorCount : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Error Rate</span>
              <span className="text-gray-400">{performanceMetrics?.api?.errorRate != null ? `${performanceMetrics.api.errorRate}%` : "—"}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Database Performance
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Avg Query Time</span>
              <span className="text-gray-400">{performanceMetrics?.database?.avgQueryTime != null ? `${Math.round(Number(performanceMetrics.database.avgQueryTime))}ms` : "—"}</span>
            </div>
          </div>
          {performanceMetrics?.topEndpoints?.length > 0 ? (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-cyan-400 mb-2">Top Endpoints</h5>
              <div className="space-y-1 text-sm">
                {performanceMetrics.topEndpoints.slice(0, 5).map((ep: any, i: number) => (
                  <div key={i} className="flex justify-between text-gray-300">
                    <span className="truncate max-w-[180px]">{ep.endpoint}</span>
                    <span>{ep.requests}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {(!performanceMetrics || (performanceMetrics?.api?.totalRequests == null && performanceMetrics?.api?.avgResponseTime == null)) ? (
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <p className="text-gray-400 text-center py-4">No performance data in this period. Metrics are collected from request logging.</p>
        </div>
      ) : null}
        </>
      )}
    </div>
  );

  // RFID Tools Tab Content
  const rfidToolsContent = (
    <div className="space-y-6">
      {rfidEmergencyActive && (
        <div className="bg-red-900/40 border border-red-600 rounded-lg p-4 flex items-center justify-between flex-wrap gap-2">
          <span className="text-red-200 font-medium">Emergency stop active — RFID scans are not being processed.</span>
          <button
            type="button"
            onClick={() => runRfidDiagnostic("resume", api.resumeRfid.bind(api), "Resume RFID")}
            disabled={rfidDiagnosticLoading === "resume"}
            className="min-h-[44px] px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {rfidDiagnosticLoading === "resume" ? "Resuming…" : "Resume RFID"}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            RFID Diagnostics
          </h4>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => runRfidDiagnostic("test-reader", api.testRfidReader.bind(api), "Test RFID Reader")}
              disabled={!!rfidDiagnosticLoading}
              className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidDiagnosticLoading === "test-reader" ? "Running…" : "Test RFID Reader"}
            </button>
            <button
              type="button"
              onClick={() => runRfidDiagnostic("calibrate", api.calibrateRfidSensors.bind(api), "Calibrate Sensors")}
              disabled={!!rfidDiagnosticLoading}
              className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidDiagnosticLoading === "calibrate" ? "Sending…" : "Calibrate Sensors"}
            </button>
            <button
              type="button"
              onClick={handleCheckCardDatabase}
              disabled={!!rfidDiagnosticLoading}
              className="w-full min-h-[44px] bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidDiagnosticLoading === "check-cards" ? "Checking…" : "Check Card Database"}
            </button>
            <button
              type="button"
              onClick={() => runRfidDiagnostic("reset-cache", api.resetDeviceCache.bind(api), "Reset Device Cache")}
              disabled={!!rfidDiagnosticLoading}
              className="w-full min-h-[44px] bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidDiagnosticLoading === "reset-cache" ? "Resetting…" : "Reset Device Cache"}
            </button>
            <button
              type="button"
              onClick={() => setShowEmergencyStopConfirm(true)}
              disabled={!!rfidDiagnosticLoading || rfidEmergencyActive}
              className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidDiagnosticLoading === "emergency-stop" ? "Stopping…" : "Emergency Stop"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-700">
            <strong className="text-gray-300">What each does:</strong> Test Reader sends a test command to RFID/ESP32 devices. Calibrate sends a calibrate command to sensors. Check Card Database queries the DB for students with/without RFID. Reset Device Cache clears the IoT device cache and refreshes the list. Emergency Stop pauses all RFID scan processing until you click Resume.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Device Status
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Active devices (today)</span>
              <span className="text-white">{dashboardStats.activeDevices ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Total events (today)</span>
              <span className="text-white">{dashboardStats.totalEvents ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Today’s classes</span>
              <span className="text-cyan-400">{dashboardStats.todayClasses ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            RFID Simulation
          </h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter RFID UID (e.g. card ID or student RFID)"
              value={rfidSimulateUid}
              onChange={(e) => setRfidSimulateUid(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-400"
            />
            <button
              type="button"
              onClick={async () => {
                if (!rfidSimulateUid.trim()) {
                  addNotification({ type: "error", title: "RFID Simulate", message: "Enter an RFID UID." });
                  return;
                }
                setRfidSimulateLoading(true);
                try {
                  const res = await api.simulateRFID(rfidSimulateUid.trim());
                  if (res.success) {
                    addNotification({ type: "success", title: "RFID Simulate", message: res.message || "Scan simulated successfully." });
                    setRfidSimulateUid("");
                    const activityRes = await api.getDashboardActivity();
                    if (activityRes.success && Array.isArray(activityRes.data)) {
                      setRfidActivityList(activityRes.data.map((a: any) => ({
                        type: "success",
                        message: a.message || "Attendance event",
                        time: a.timestamp ? new Date(a.timestamp).toLocaleString() : "",
                        device: "System",
                      })));
                    }
                  } else {
                    addNotification({ type: "error", title: "RFID Simulate", message: res.message || "Simulation failed." });
                  }
                } catch (err: any) {
                  addNotification({ type: "error", title: "RFID Simulate", message: err?.message || "Request failed." });
                } finally {
                  setRfidSimulateLoading(false);
                }
              }}
              disabled={rfidSimulateLoading}
              className="w-full min-h-[44px] bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidSimulateLoading ? "Simulating…" : "Simulate Scan"}
            </button>
            <p className="text-xs text-gray-400">Admin only. Uses a student’s registered RFID UID to test attendance flow.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Device Health Monitor
          </h4>
          <div className="space-y-4">
            {rfidDevices.length > 0 ? (
              rfidDevices.map((device: any) => (
                <div key={device.deviceId || device.id} className="flex items-center justify-between">
                  <span className="text-gray-300 truncate">{device.name || device.deviceId || "Device"}</span>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        device.status === "online" ? "bg-green-500" : "bg-red-500"
                      }`}
                      title={device.status || "unknown"}
                    />
                    <span className="text-sm text-white capitalize">
                      {device.status ?? "—"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No devices registered. Data from IoT API.</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            System Calibration
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Last Calibration</span>
              <span className="text-white">
                {rfidCalibrationLast ? (() => {
                  const d = new Date(rfidCalibrationLast);
                  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
                  if (mins < 1) return "Just now";
                  if (mins < 60) return `${mins} min ago`;
                  const h = Math.floor(mins / 60);
                  if (h < 24) return `${h} hour(s) ago`;
                  return d.toLocaleDateString();
                })() : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Calibration Status</span>
              <span className={rfidCalibrationLast ? "text-green-400" : "text-gray-400"}>
                {rfidCalibrationLast ? "Completed" : "No data"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Devices refreshed</span>
              <span className="text-gray-400">{rfidDevices.length} device(s)</span>
            </div>
            <button
              type="button"
              onClick={() => runRfidDiagnostic("run-calibration", api.runRfidCalibration.bind(api), "Run Calibration")}
              disabled={!!rfidDiagnosticLoading}
              className="w-full min-h-[44px] bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {rfidDiagnosticLoading === "run-calibration" ? "Running…" : "Run Calibration Test"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          RFID Activity Log
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {rfidActivityLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : rfidActivityList.length > 0 ? rfidActivityList.map((event: any, index: number) => (
            <div key={index} className="flex items-center space-x-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${event.type === "warning" ? "bg-amber-500" : "bg-green-500"}`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{event.message}</p>
                <p className="text-xs text-gray-400">{event.time}</p>
              </div>
            </div>
          )) : (
            <p className="text-gray-400 text-sm py-4">No recent attendance activity. Use Simulate Scan or record attendance to see events.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return overviewContent;
      case "analytics":
        return analyticsContent;
      case "security":
        return securityContent;
      case "performance":
        return performanceContent;
      case "rfid-tools":
        return rfidToolsContent;
      default:
        return overviewContent;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-cyan-400">
            Dashboard Overview
          </h3>
          <p className="text-sm text-gray-300">
            Real-time attendance monitoring and analytics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {error && (
            <span className="text-red-400 text-sm">⚠️ Offline Mode</span>
          )}
          <button
            onClick={() => fetchDashboardStats()}
            disabled={loading}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white text-sm font-medium rounded disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <span>🔄</span>
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("overview")}
            className={`${
              activeTab === "overview"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`${
              activeTab === "analytics"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`${
              activeTab === "security"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Security
          </button>
          <button
            onClick={() => setActiveTab("performance")}
            className={`${
              activeTab === "performance"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab("rfid-tools")}
            className={`${
              activeTab === "rfid-tools"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            RFID Tools
          </button>
        </nav>
      </div>

      {renderTabContent()}

      {/* Modals */}
      <StartSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
      <ConfirmationDialog
        isOpen={showEmergencyStopConfirm}
        title="Emergency Stop"
        message="RFID scans will not be processed until you resume. Continue?"
        confirmText="Activate Emergency Stop"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        onConfirm={() => {
          setShowEmergencyStopConfirm(false);
          runRfidDiagnostic("emergency-stop", api.emergencyStopRfid.bind(api), "Emergency Stop");
        }}
        onCancel={() => setShowEmergencyStopConfirm(false)}
      />
    </div>
  );
};
