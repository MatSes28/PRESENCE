import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getWebSocketClient } from "../lib/websocket";
import { api } from "../lib/api";

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

type TabType =
  | "Overview"
  | "Analytics"
  | "Security"
  | "Performance"
  | "RFID Tools";

interface NavigationItem {
  name: string;
  icon: string;
  description?: string;
  tab?: TabType;
  route?: string;
  adminOnly?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    icon: "📊",
    description: "Overview & Analytics",
    tab: "Overview",
  },
  {
    name: "Live Attendance",
    icon: "⚡",
    description: "Real-time tracking",
    route: "/attendance",
  },
  {
    name: "Schedule",
    icon: "📅",
    description: "Class timetables",
    route: "/schedule",
  },
  {
    name: "Students",
    icon: "👥",
    description: "Student management",
    route: "/students",
  },
  {
    name: "Class Roster",
    icon: "📋",
    description: "View enrolled students",
    route: "/roster",
  },
  {
    name: "Lab Computers",
    icon: "💻",
    description: "Computer allocation",
    route: "/lab-computers",
  },
  {
    name: "Reports",
    icon: "📈",
    description: "Data insights",
    route: "/reports",
  },
  {
    name: "Settings",
    icon: "⚙️",
    description: "System configuration",
    route: "/settings",
  },
  {
    name: "Faculty",
    icon: "👨‍🏫",
    description: "Faculty management",
    route: "/faculty",
    adminOnly: true,
  },
  {
    name: "User Management",
    icon: "👤",
    description: "User administration",
    route: "/users",
    adminOnly: true,
  },
];

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const [realTimeData, setRealTimeData] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("Overview");
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
  const [, setLocation] = useLocation();

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        // Uncomment and implement API call
        // const response = await api.get('/api/dashboard/stats');
        // setDashboardStats(response.data);

        // Mock data for now
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
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [deviceStatus]);

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
    <div className="bg-gray-800 rounded-lg shadow p-6">
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

  // Tab Component
  const TabButton = ({
    active,
    onClick,
    children,
    icon,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    icon?: string;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-cyan-600 text-white"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );

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
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-medium text-white mb-4">
            Start New Session
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Class
              </label>
              <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                <option>Select a class...</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Session Type
              </label>
              <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                <option>Lecture</option>
                <option>Lab</option>
                <option>Exam</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Start Session
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Performance Monitor Component
  const PerformanceMonitor = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🗄️</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Database Queries
              </dt>
              <dd className="text-2xl font-semibold text-white">1,234</dd>
              <div className="flex items-center text-sm text-green-400">
                <span>↗</span>
                <span className="ml-1">+5%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📡</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                RFID Processing Rate
              </dt>
              <dd className="text-2xl font-semibold text-white">95%</dd>
              <div className="flex items-center text-sm text-green-400">
                <span>↗</span>
                <span className="ml-1">+2%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">💾</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Cache Hit Rate
              </dt>
              <dd className="text-2xl font-semibold text-white">87%</dd>
              <div className="flex items-center text-sm text-gray-400">
                <span>→</span>
                <span className="ml-1">Stable</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">⚠️</span>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Error Rate
              </dt>
              <dd className="text-2xl font-semibold text-white">
                {dashboardStats.errorRate}%
              </dd>
              <div className="flex items-center text-sm text-red-400">
                <span>↘</span>
                <span className="ml-1">-0.1%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h4 className="text-lg font-medium text-white mb-4">System Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">CPU Usage:</span>
              <span className="text-white">45%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">Memory Usage:</span>
              <span className="text-white">60%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">Network I/O:</span>
              <span className="text-white">1.2 MB/s</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">Uptime:</span>
              <span className="text-white">{dashboardStats.systemUptime}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">Active Connections:</span>
              <span className="text-white">25</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-300">Response Time:</span>
              <span className="text-white">120ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // RFID Tools Component
  const RFIDTools = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">RFID Tools</h3>
          <p className="text-sm text-gray-300">Simulation and system status</p>
        </div>
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Simulate RFID Scan
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">System Status</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Uptime:</span>
              <span className="text-white">{dashboardStats.systemUptime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Active Readers:</span>
              <span className="text-white">{dashboardStats.activeDevices}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Response Time:</span>
              <span className="text-white">150ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Error Rate:</span>
              <span className="text-white">{dashboardStats.errorRate}%</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-white mb-4">
            RFID Simulation
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                RFID UID
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                placeholder="Enter RFID UID"
              />
            </div>
            <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Test RFID
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "Overview":
        return (
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
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
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

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
                  Quick Actions
                </h4>
                <div className="space-y-3">
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded">
                    📚 Add Students
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded">
                    📊 View Reports
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded">
                    📢 Send Notifications
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
                  System Overview
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Total Events</span>
                    <span className="text-white">
                      {dashboardStats.totalEvents}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Active Devices</span>
                    <span className="text-white">
                      {dashboardStats.activeDevices}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Activity */}
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-medium text-white mb-4">
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
                        {data.type === "attendance_record" &&
                          `Attendance recorded`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );

      case "Analytics":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">Analytics</h3>
                <p className="text-sm text-gray-300">
                  Attendance overviews and reports
                </p>
              </div>
              <div className="flex space-x-3">
                <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Export Data
                </button>
                <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Generate Report
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Present Count"
                value={dashboardStats.presentStudents}
                icon="✅"
                color="green"
              />
              <StatCard
                title="Absent Count"
                value={dashboardStats.absentStudents}
                icon="❌"
                color="red"
              />
              <StatCard
                title="Total Events"
                value={dashboardStats.totalEvents}
                icon="📊"
                color="blue"
              />
              <StatCard
                title="Attendance Rate"
                value={`${dashboardStats.attendanceRate}%`}
                icon="📈"
                color="purple"
              />
            </div>
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-medium text-white mb-4">
                Recent Activity Logs
              </h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {realTimeData.length === 0 ? (
                  <p className="text-gray-400">No activity logs available</p>
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
                        {data.type} - {data.status || "N/A"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );

      case "Security":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white">Security</h3>
              <p className="text-sm text-gray-300">
                Security alerts and access control
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
                  Access Control
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">
                      Two-Factor Authentication
                    </span>
                    <span className="text-green-400">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">RFID Security</span>
                    <span className="text-green-400">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Session Encryption</span>
                    <span className="text-green-400">Enabled</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
                  Security Alerts
                </h4>
                <div className="space-y-3">
                  <div className="bg-yellow-900 p-3 rounded border border-yellow-600">
                    <p className="text-sm text-yellow-300">
                      Unauthorized access attempt detected
                    </p>
                    <p className="text-xs text-yellow-400">10 minutes ago</p>
                  </div>
                  <div className="bg-green-900 p-3 rounded border border-green-600">
                    <p className="text-sm text-green-300">
                      Security scan completed
                    </p>
                    <p className="text-xs text-green-400">1 hour ago</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-medium text-white mb-4">
                Database Security Status
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    Secure
                  </div>
                  <div className="text-sm text-gray-300">Encryption</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    Active
                  </div>
                  <div className="text-sm text-gray-300">Backups</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    Compliant
                  </div>
                  <div className="text-sm text-gray-300">Access Logs</div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Performance":
        return <PerformanceMonitor />;

      case "RFID Tools":
        return <RFIDTools />;

      default:
        return (
          <div className="bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {activeTab} - Coming Soon
            </h3>
            <p className="text-gray-300">
              This feature is currently under development. Check back soon!
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-teal-500 to-blue-600 flex">
      {/* Sidebar */}
      <div className="w-80 bg-gray-900 shadow-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h1 className="text-xl font-bold text-cyan-400">
                CLIRDEC:PRESENCE
              </h1>
              <p className="text-sm text-gray-300">Welcome, {user?.name}</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {navigationItems
                .filter((item) => !item.adminOnly || user?.role === "admin")
                .map((item, itemIndex) => (
                  <div key={itemIndex}>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          if (item.route) {
                            setLocation(item.route);
                          } else if (item.tab) {
                            setActiveTab(item.tab);
                          }
                        }}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeTab === item.tab
                            ? "bg-cyan-600 text-white border-r-2 border-cyan-400"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                        }`}
                      >
                        <span className="mr-3 text-lg">{item.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-400">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-900 rounded-md transition-colors"
            >
              <span className="mr-3">🚪</span>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-gray-800 shadow-sm border-b border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{activeTab}</h2>
                <p className="text-sm text-gray-300">
                  {navigationItems.find((item) => item.tab === activeTab)
                    ?.description || "System Overview"}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-900">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white">Loading...</div>
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>

      {/* Modals */}
      <StartSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
    </div>
  );
};
