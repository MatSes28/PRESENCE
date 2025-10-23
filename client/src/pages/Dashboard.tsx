import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
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

export const Dashboard = () => {
  const { user, logout } = useAuth();
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
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center">
        <div
          className={`w-12 h-12 bg-${color}-500 rounded-full flex items-center justify-center`}
        >
          <span className="text-white text-lg">{icon}</span>
        </div>
        <div className="ml-4">
          <dt className="text-sm font-medium text-gray-600 truncate">
            {title}
          </dt>
          <dd className="text-2xl font-semibold text-gray-800">{value}</dd>
          {trend && trendValue && (
            <div
              className={`flex items-center text-sm ${
                trend === "up"
                  ? "text-green-600"
                  : trend === "down"
                  ? "text-red-600"
                  : "text-gray-500"
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
        <div className="bg-white rounded-lg p-6 w-full max-w-md border border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            Start New Session
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Class
              </label>
              <select className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-800">
                <option>Select a class...</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Session Type
              </label>
              <select className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-800">
                <option>Lecture</option>
                <option>Lab</option>
                <option>Exam</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
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
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h4 className="text-lg font-medium text-gray-800 mb-4">
            Active Sessions
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">CS101 - Lecture</span>
              <span className="text-green-600">Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Lab 201 - Practical</span>
              <span className="text-green-600">Active</span>
            </div>
          </div>
          <button
            onClick={() => setShowSessionModal(true)}
            className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Start New Session
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h4 className="text-lg font-medium text-gray-800 mb-4">
            Quick Actions
          </h4>
          <div className="space-y-3">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">
              📚 Add Students
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">
              📊 View Reports
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">
              📢 Send Notifications
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h4 className="text-lg font-medium text-gray-800 mb-4">
            System Overview
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Events</span>
              <span className="text-gray-800">
                {dashboardStats.totalEvents}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Devices</span>
              <span className="text-gray-800">
                {dashboardStats.activeDevices}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Activity */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h4 className="text-lg font-medium text-gray-800 mb-4">
          Real-time Activity
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {realTimeData.length === 0 ? (
            <p className="text-gray-500">No recent activity</p>
          ) : (
            realTimeData.map((data: any, index: number) => (
              <div
                key={index}
                className="bg-gray-50 p-3 rounded border border-gray-200"
              >
                <p className="text-xs text-gray-500">
                  {new Date(data.timestamp).toLocaleTimeString()}
                </p>
                <p className="text-sm text-gray-800">
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

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-800">Loading...</div>
        </div>
      ) : (
        overviewContent
      )}

      {/* Modals */}
      <StartSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
      />
    </div>
  );
};
