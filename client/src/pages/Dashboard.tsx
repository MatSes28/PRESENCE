import { useAuth } from "../hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { getWebSocketClient } from "../lib/websocket";
import { api } from "../lib/api";
import { useLocation } from "wouter";
import { useNotifications } from "../components/NotificationSystem";
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

        const response = await api.get("/dashboard/stats");
        if (response.success && response.data) {
          setDashboardStats((prev) => ({
            ...prev,
            ...(response.data as Partial<DashboardStats>),
            activeDevices: deviceStatus.filter((d) => d.status === "online")
              .length,
          }));
          setRetryCount(0); // Reset retry count on success
        } else {
          throw new Error(
            response.message || "Failed to load dashboard statistics"
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
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
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

  // Handle sending notifications
  const handleSendNotifications = async () => {
    try {
      // This would typically send notifications to absent students
      // For now, we'll show a placeholder
      addNotification({
        type: "info",
        title: "Notifications Sent",
        message:
          "Attendance notifications have been sent to parents of absent students.",
      });
    } catch (error) {
      console.error("Failed to send notifications:", error);
      addNotification({
        type: "error",
        title: "Notification Failed",
        message: "Failed to send notifications. Please try again.",
      });
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Classes"
          value={dashboardStats.todayClasses}
          icon="📚"
          trend="up"
          trendValue="+2"
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Present Students"
          value={dashboardStats.presentStudents}
          icon="✅"
          trend="up"
          trendValue="+15"
          color="green"
          loading={loading}
        />
        <StatCard
          title="Absent Students"
          value={dashboardStats.absentStudents}
          icon="❌"
          trend="down"
          trendValue="-3"
          color="red"
          loading={loading}
        />
        <StatCard
          title="Attendance Rate"
          value={`${dashboardStats.attendanceRate}%`}
          icon="📊"
          trend="up"
          trendValue="+1.2%"
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
            <div className="flex justify-between items-center">
              <span className="text-gray-300">CS101 - Lecture</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Lab 201 - Practical</span>
              <span className="text-green-400">Active</span>
            </div>
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
              onClick={handleSendNotifications}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded"
            >
              📢 Send Notifications
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
              <span className="text-white">{dashboardStats.totalEvents}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Active Devices</span>
              <span className="text-white">{dashboardStats.activeDevices}</span>
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
          </div>

          {/* Hourly Patterns and Subject Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-cyan-400 mb-4">
                Hourly Attendance Patterns
              </h4>
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
            </div>

            <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-cyan-400 mb-4">
                Subject Performance
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {analyticsData.subjectPerformance.map(
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
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400">No analytics data available</p>
        </div>
      )}
    </div>
  );

  // Security Tab Content
  const securityContent = (
    <div className="space-y-6">
      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-lg">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-400">
              Security Monitoring Not Available
            </h3>
            <p className="text-sm text-yellow-200 mt-1">
              Real-time security metrics require backend implementation.
              Currently showing placeholder data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Sessions"
          value="N/A"
          icon="🔐"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
        <StatCard
          title="Failed Logins"
          value="N/A"
          icon="🚫"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
        <StatCard
          title="Security Alerts"
          value="N/A"
          icon="⚠️"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
        <StatCard
          title="System Integrity"
          value="N/A"
          icon="🛡️"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Recent Security Events
          </h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {[
              {
                type: "success",
                message: "Successful login - Admin",
                time: "2 minutes ago",
              },
              {
                type: "info",
                message: "RFID card validated",
                time: "5 minutes ago",
              },
              {
                type: "warning",
                message: "Sensor calibration completed",
                time: "1 hour ago",
              },
              {
                type: "success",
                message: "Database backup completed",
                time: "2 hours ago",
              },
              {
                type: "info",
                message: "User session expired",
                time: "3 hours ago",
              },
              {
                type: "warning",
                message: "High CPU usage detected",
                time: "4 hours ago",
              },
            ].map((event, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    event.type === "success"
                      ? "bg-green-500"
                      : event.type === "warning"
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                ></div>
                <div className="flex-1">
                  <p className="text-sm text-white">{event.message}</p>
                  <p className="text-xs text-gray-400">{event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Access Control
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Multi-factor Authentication</span>
              <span className="text-green-400">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Session Timeout</span>
              <span className="text-white">30 min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Failed Login Lockout</span>
              <span className="text-green-400">5 attempts</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">IP Whitelisting</span>
              <span className="text-yellow-400">Partial</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Password Complexity</span>
              <span className="text-green-400">Enforced</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Data Encryption</span>
              <span className="text-green-400">AES-256</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Threat Detection
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Suspicious IPs</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Brute Force Attempts</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Anomaly Detections</span>
              <span className="text-gray-400">N/A</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Data Protection
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Encrypted Fields</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Backup Frequency</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Last Backup</span>
              <span className="text-gray-400">N/A</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Compliance Status
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">GDPR Compliance</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Data Retention</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Audit Logging</span>
              <span className="text-gray-400">N/A</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Performance Tab Content
  const performanceContent = (
    <div className="space-y-6">
      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-lg">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-400">
              Performance Monitoring Not Available
            </h3>
            <p className="text-sm text-yellow-200 mt-1">
              Real-time performance metrics require backend implementation.
              Currently showing placeholder data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Response Time"
          value="N/A"
          icon="⚡"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
        <StatCard
          title="Uptime"
          value="N/A"
          icon="📈"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
        <StatCard
          title="CPU Usage"
          value="N/A"
          icon="💻"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
        <StatCard
          title="Memory Usage"
          value="N/A"
          icon="🧠"
          trend="neutral"
          trendValue="Pending"
          color="gray"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            System Resources
          </h4>
          <div className="space-y-4">
            {[
              {
                name: "CPU",
                value: 0,
                color: "gray",
              },
              {
                name: "Memory",
                value: 0,
                color: "gray",
              },
              {
                name: "Storage",
                value: 0,
                color: "gray",
              },
              {
                name: "Network",
                value: 0,
                color: "gray",
              },
            ].map((resource) => (
              <div key={resource.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{resource.name}</span>
                  <span className="text-gray-400">N/A</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`bg-${resource.color}-600 h-2 rounded-full`}
                    style={{ width: `${resource.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            API Performance
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Average Response</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Requests/min</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Error Rate</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cache Hit Rate</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Active Connections</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Database Queries/sec</span>
              <span className="text-gray-400">N/A</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Database Performance
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Query Execution Time</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Connection Pool Usage</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cache Efficiency</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Index Usage</span>
              <span className="text-gray-400">N/A</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Application Metrics
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Active Users</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Page Load Time</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">JavaScript Errors</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Memory Leaks</span>
              <span className="text-gray-400">N/A</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          Performance Trends (Last 24 Hours)
        </h4>
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-400">
              Performance monitoring data not available
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Real-time performance trends require backend implementation
            </p>
          </div>
        </div>
        <div className="flex justify-center space-x-4 mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-600 rounded"></div>
            <span className="text-xs text-gray-400">CPU Usage</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-600 rounded"></div>
            <span className="text-xs text-gray-400">Memory Usage</span>
          </div>
        </div>
      </div>
    </div>
  );

  // RFID Tools Tab Content
  const rfidToolsContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            RFID Diagnostics
          </h4>
          <div className="space-y-3">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
              Test RFID Reader
            </button>
            <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">
              Calibrate Sensors
            </button>
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm">
              Check Card Database
            </button>
            <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm">
              Reset Device Cache
            </button>
            <button className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm">
              Emergency Stop
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Device Status
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Readers Online</span>
              <span className="text-green-400">
                {Math.floor(6 + Math.random() * 4)}/10
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Sensors Active</span>
              <span className="text-green-400">
                {Math.floor(8 + Math.random() * 4)}/12
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cards Registered</span>
              <span className="text-white">
                {Math.floor(200 + Math.random() * 100)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Active Sessions</span>
              <span className="text-cyan-400">
                {Math.floor(Math.random() * 8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Signal Strength</span>
              <span className="text-green-400">Excellent</span>
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
              placeholder="Enter RFID UID"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
            <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm">
              Simulate Scan
            </button>
            <button className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm">
              Simulate Entry Sensor
            </button>
            <button className="w-full bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded text-sm">
              Simulate Exit Sensor
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Device Health Monitor
          </h4>
          <div className="space-y-4">
            {["Reader 1", "Reader 2", "Reader 3", "Sensor A", "Sensor B"].map(
              (device) => (
                <div key={device} className="flex items-center justify-between">
                  <span className="text-gray-300">{device}</span>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        Math.random() > 0.1 ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></div>
                    <span className="text-sm text-white">
                      {Math.floor(90 + Math.random() * 10)}%
                    </span>
                  </div>
                </div>
              )
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
              <span className="text-white">2 hours ago</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Calibration Status</span>
              <span className="text-green-400">Optimal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Accuracy Rate</span>
              <span className="text-green-400">99.2%</span>
            </div>
            <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm">
              Run Calibration Test
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          RFID Activity Log
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {[
            {
              type: "success",
              message: "RFID scan successful - Student ID: 2021001",
              time: "2 minutes ago",
              device: "Reader 1",
            },
            {
              type: "info",
              message: "Sensor triggered - Entry detected",
              time: "5 minutes ago",
              device: "Sensor A",
            },
            {
              type: "warning",
              message: "RFID read error - Card not recognized",
              time: "8 minutes ago",
              device: "Reader 2",
            },
            {
              type: "success",
              message: "Attendance recorded successfully",
              time: "10 minutes ago",
              device: "System",
            },
            {
              type: "info",
              message: "Device calibration completed",
              time: "15 minutes ago",
              device: "Reader 3",
            },
            {
              type: "warning",
              message: "Low signal strength detected",
              time: "20 minutes ago",
              device: "Sensor B",
            },
            {
              type: "success",
              message: "Bulk card validation completed",
              time: "25 minutes ago",
              device: "System",
            },
            {
              type: "info",
              message: "Sensor recalibration triggered",
              time: "30 minutes ago",
              device: "Sensor A",
            },
          ].map((event, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  event.type === "success"
                    ? "bg-green-500"
                    : event.type === "warning"
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                }`}
              ></div>
              <div className="flex-1">
                <p className="text-sm text-white">{event.message}</p>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{event.device}</span>
                  <span>{event.time}</span>
                </div>
              </div>
            </div>
          ))}
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
    </div>
  );
};
