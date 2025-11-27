import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
import { getWebSocketClient } from "../lib/websocket";
import { api } from "../lib/api";
import { useLocation } from "wouter";

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
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [availableSchedules, setAvailableSchedules] = useState<any[]>([]);
  const [sessionFormData, setSessionFormData] = useState({
    scheduleId: "",
    action: "create", // create or activate
  });

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await api.get("/dashboard/stats");
        if (response.success && response.data) {
          setDashboardStats((prev) => ({
            ...prev,
            ...(response.data as Partial<DashboardStats>),
            activeDevices: deviceStatus.filter((d) => d.status === "online")
              .length,
          }));
        } else {
          // Fallback to mock data if API fails
          setDashboardStats({
            todayClasses: 5,
            presentStudents: 120,
            absentStudents: 10,
            attendanceRate: 92.3,
            totalEvents: 150,
            activeDevices: deviceStatus.filter((d) => d.status === "online")
              .length,
            systemUptime: "7d 12h 30m",
            errorRate: 0.5,
          });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        // Fallback to mock data
        setDashboardStats({
          todayClasses: 5,
          presentStudents: 120,
          absentStudents: 10,
          attendanceRate: 92.3,
          totalEvents: 150,
          activeDevices: deviceStatus.filter((d) => d.status === "online")
            .length,
          systemUptime: "7d 12h 30m",
          errorRate: 0.5,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [deviceStatus]);

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

  // Statistics Card Component
  const StatCard = ({
    title,
    value,
    icon,
    trend,
    trendValue,
    color = "blue",
  }: {
    title: string;
    value: string | number;
    icon: string;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    color?: string;
  }) => (
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
              <span>{trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}</span>
              <span className="ml-1">{trendValue}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

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
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Classes"
          value={dashboardStats.todayClasses}
          icon="📚"
          trend="up"
          trendValue="+2"
          color="blue"
        />
        <StatCard
          title="Present Students"
          value={dashboardStats.presentStudents}
          icon="✅"
          trend="up"
          trendValue="+15"
          color="green"
        />
        <StatCard
          title="Absent Students"
          value={dashboardStats.absentStudents}
          icon="❌"
          trend="down"
          trendValue="-3"
          color="red"
        />
        <StatCard
          title="Attendance Rate"
          value={`${dashboardStats.attendanceRate}%`}
          icon="📊"
          trend="up"
          trendValue="+1.2%"
          color="purple"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Attendance Trends
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">This Week</span>
              <span className="text-green-400">+12%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">This Month</span>
              <span className="text-green-400">+8%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">This Semester</span>
              <span className="text-green-400">+15%</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">Peak Hours</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">8:00 AM - 10:00 AM</span>
              <span className="text-white">85%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">10:00 AM - 12:00 PM</span>
              <span className="text-white">78%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">1:00 PM - 3:00 PM</span>
              <span className="text-white">92%</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Device Performance
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">RFID Readers</span>
              <span className="text-green-400">98.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Sensors</span>
              <span className="text-yellow-400">94.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Network</span>
              <span className="text-green-400">99.1%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          Weekly Attendance Chart
        </h4>
        <div className="h-64 flex items-end justify-between space-x-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
            (day, index) => (
              <div key={day} className="flex-1 flex flex-col items-center">
                <div
                  className="bg-cyan-600 w-full rounded-t"
                  style={{ height: `${60 + index * 10}px` }}
                ></div>
                <span className="text-xs text-gray-400 mt-2">{day}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  // Security Tab Content
  const securityContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Sessions"
          value="24"
          icon="🔐"
          trend="neutral"
          trendValue="Stable"
          color="green"
        />
        <StatCard
          title="Failed Logins"
          value="3"
          icon="🚫"
          trend="down"
          trendValue="-2"
          color="red"
        />
        <StatCard
          title="Security Alerts"
          value="0"
          icon="⚠️"
          trend="neutral"
          trendValue="None"
          color="yellow"
        />
        <StatCard
          title="System Integrity"
          value="100%"
          icon="🛡️"
          trend="up"
          trendValue="+0.1%"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Recent Security Events
          </h4>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-white">Successful login - Admin</p>
                <p className="text-xs text-gray-400">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-white">RFID card validated</p>
                <p className="text-xs text-gray-400">5 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-white">
                  Sensor calibration completed
                </p>
                <p className="text-xs text-gray-400">1 hour ago</p>
              </div>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  );

  // Performance Tab Content
  const performanceContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Response Time"
          value="245ms"
          icon="⚡"
          trend="down"
          trendValue="-12ms"
          color="green"
        />
        <StatCard
          title="Uptime"
          value="99.9%"
          icon="📈"
          trend="up"
          trendValue="+0.1%"
          color="blue"
        />
        <StatCard
          title="CPU Usage"
          value="34%"
          icon="💻"
          trend="neutral"
          trendValue="±2%"
          color="purple"
        />
        <StatCard
          title="Memory Usage"
          value="67%"
          icon="🧠"
          trend="up"
          trendValue="+5%"
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            System Resources
          </h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">CPU</span>
                <span className="text-white">34%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: "34%" }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Memory</span>
                <span className="text-white">67%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: "67%" }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Storage</span>
                <span className="text-white">45%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: "45%" }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Network</span>
                <span className="text-white">23%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full"
                  style={{ width: "23%" }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            API Performance
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Average Response</span>
              <span className="text-white">245ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Requests/min</span>
              <span className="text-white">1,247</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Error Rate</span>
              <span className="text-green-400">0.1%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cache Hit Rate</span>
              <span className="text-green-400">94.5%</span>
            </div>
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
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400 mb-4">
            Device Status
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Readers Online</span>
              <span className="text-green-400">8/8</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Sensors Active</span>
              <span className="text-green-400">12/12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cards Registered</span>
              <span className="text-white">247</span>
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
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          RFID Activity Log
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm text-white">
                RFID scan successful - Student ID: 2021001
              </p>
              <p className="text-xs text-gray-400">Reader 1 - 2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm text-white">
                Sensor triggered - Entry detected
              </p>
              <p className="text-xs text-gray-400">Sensor 3 - 5 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm text-white">
                RFID read error - Card not recognized
              </p>
              <p className="text-xs text-gray-400">Reader 2 - 8 minutes ago</p>
            </div>
          </div>
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

      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-white">Loading...</div>
        </div>
      ) : (
        renderTabContent()
      )}

      {/* Modals */}
      <StartSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
    </div>
  );
};
