import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getWebSocketClient } from "../lib/websocket";

type MenuSection = {
  title: string;
  items: MenuItem[];
};

type MenuItem = {
  name: string;
  icon: string;
  description?: string;
  active?: boolean;
};

const menuSections: MenuSection[] = [
  {
    title: "Dashboard",
    items: [
      {
        name: "Dashboard",
        icon: "📊",
        description: "Overview & Analytics",
        active: true,
      },
    ],
  },
  {
    title: "Overview & Analytics",
    items: [
      {
        name: "Live Attendance",
        icon: "⚡",
        description: "Real-time tracking",
      },
    ],
  },
  {
    title: "Schedule",
    items: [{ name: "Schedule", icon: "📅", description: "Class timetables" }],
  },
  {
    title: "Students",
    items: [
      { name: "Students", icon: "👥", description: "Student management" },
      {
        name: "Class Roster",
        icon: "📋",
        description: "View enrolled students",
      },
    ],
  },
  {
    title: "Lab Computers",
    items: [
      { name: "Lab Computers", icon: "💻", description: "Computer allocation" },
    ],
  },
  {
    title: "Reports",
    items: [{ name: "Reports", icon: "📈", description: "Data insights" }],
  },
  {
    title: "Settings",
    items: [
      { name: "Settings", icon: "⚙️", description: "System configuration" },
    ],
  },
  {
    title: "Management",
    items: [
      { name: "Faculty", icon: "👨‍🏫", description: "Faculty management" },
      {
        name: "User Management",
        icon: "👤",
        description: "User administration",
      },
    ],
  },
];

interface DashboardProps {
  initialSection?: string;
}

export const Dashboard = ({ initialSection = "Dashboard" }: DashboardProps) => {
  const { user, logout } = useAuth();
  const [realTimeData, setRealTimeData] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const wsClient = getWebSocketClient(user?.id);

    // Subscribe to real-time updates
    wsClient.on("rfidScan", (data) => {
      setRealTimeData((prev) => [data, ...prev.slice(0, 9)]); // Keep last 10 events
    });

    wsClient.on("sensorTrigger", (data) => {
      setRealTimeData((prev) => [data, ...prev.slice(0, 9)]);
    });

    wsClient.on("attendanceRecord", (data) => {
      setRealTimeData((prev) => [data, ...prev.slice(0, 9)]);
    });

    wsClient.on("deviceStatus", (data) => {
      setDeviceStatus(data);
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

  const renderContent = () => {
    switch (activeSection) {
      case "Dashboard":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Real-time Activity */}
            <div className="bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">⚡</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-300 truncate">
                        Real-time Activity
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        Live Updates
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 px-5 py-3">
                <div className="text-sm">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {realTimeData.length === 0 ? (
                      <p className="text-gray-400">No recent activity</p>
                    ) : (
                      realTimeData.map((data: any, index: number) => (
                        <div
                          key={index}
                          className="bg-gray-600 p-2 rounded border border-gray-500"
                        >
                          <p className="text-xs text-gray-300">
                            {new Date(data.timestamp).toLocaleTimeString()}
                          </p>
                          <p className="text-sm text-white">
                            {data.type === "rfid_scan" &&
                              `RFID: ${data.rfidUid}`}
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
            </div>

            {/* Device Status */}
            <div className="bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">📡</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-300 truncate">
                        IoT Devices
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        {
                          deviceStatus.filter((d: any) => d.status === "online")
                            .length
                        }{" "}
                        Online
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 px-5 py-3">
                <div className="text-sm">
                  <div className="space-y-2">
                    {deviceStatus.map((device: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-white">{device.deviceId}</span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            device.status === "online"
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {device.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">⚙️</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-300 truncate">
                        Quick Actions
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        Management
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 px-5 py-3">
                <div className="text-sm">
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveSection("Students")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📚 Manage Students
                    </button>
                    <button
                      onClick={() => setActiveSection("Reports")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📊 View Reports
                    </button>
                    <button
                      onClick={() => setActiveSection("Schedule")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📅 View Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Live Attendance":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Live Attendance Monitoring
                </h3>
                <p className="text-sm text-gray-300">
                  Real-time attendance tracking and system events
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📊</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Total Events
                    </dt>
                    <dd className="text-lg font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">✅</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Valid Entries
                    </dt>
                    <dd className="text-lg font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">⚠️</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Discrepancies
                    </dt>
                    <dd className="text-lg font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📡</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Active Devices
                    </dt>
                    <dd className="text-lg font-semibold text-white">
                      {
                        deviceStatus.filter((d: any) => d.status === "online")
                          .length
                      }
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">
                  Live Events Feed
                </h4>
                <p className="text-sm text-gray-300">
                  Real-time system events and attendance records
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {realTimeData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">📡</div>
                      <p className="text-gray-300">
                        Waiting for attendance events...
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Events will appear here as students interact with the
                        system
                      </p>
                    </div>
                  ) : (
                    realTimeData.map((data: any, index: number) => (
                      <div
                        key={index}
                        className="bg-gray-700 p-3 rounded border border-gray-600"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm">
                                {data.type === "rfid_scan" && "🎫"}
                                {data.type === "sensor_trigger" && "📡"}
                                {data.type === "attendance_record" && "✅"}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm text-white">
                                {data.type === "rfid_scan" &&
                                  `RFID Card Scanned`}
                                {data.type === "sensor_trigger" &&
                                  `${data.sensorType} Sensor Triggered`}
                                {data.type === "attendance_record" &&
                                  `Attendance Recorded`}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(data.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              data.status === "valid"
                                ? "bg-green-600 text-white"
                                : data.status === "invalid"
                                ? "bg-red-600 text-white"
                                : "bg-yellow-600 text-white"
                            }`}
                          >
                            {data.status || "unknown"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "Students":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Student Management
                </h3>
                <p className="text-sm text-gray-300">
                  Manage student information and records
                </p>
              </div>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Add New Student
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👥</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Total Students
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">✅</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Active Today
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🎫</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      RFID Cards
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">
                  Recent Students
                </h4>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">📚</div>
                <p className="text-gray-300">No students registered yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add students to start managing attendance records
                </p>
              </div>
            </div>
          </div>
        );

      case "Reports":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Reports & Analytics
                </h3>
                <p className="text-sm text-gray-300">
                  View attendance reports and data insights
                </p>
              </div>
              <div className="flex space-x-3">
                <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Generate Report
                </button>
                <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Export Data
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">📊</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Today's Attendance
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0%</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👥</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Total Records
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">⚠️</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Late Arrivals
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🏫</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Classes Today
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">
                  Recent Reports
                </h4>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">📈</div>
                <p className="text-gray-300">No reports generated yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Generate your first attendance report to get started
                </p>
              </div>
            </div>
          </div>
        );

      case "Schedule":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Class Schedule
                </h3>
                <p className="text-sm text-gray-300">
                  View and manage class timetables
                </p>
              </div>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Add Class
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-700">
                  <h4 className="text-lg font-medium text-white">
                    Today's Schedule
                  </h4>
                </div>
                <div className="p-6 text-center">
                  <div className="text-4xl mb-4">📅</div>
                  <p className="text-gray-300">
                    No classes scheduled for today
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Add classes to see them here
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-700">
                  <h4 className="text-lg font-medium text-white">
                    Weekly Overview
                  </h4>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                    ].map((day) => (
                      <div
                        key={day}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded"
                      >
                        <span className="text-white font-medium">{day}</span>
                        <span className="text-gray-300 text-sm">
                          No classes
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">Quick Stats</h4>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">0</div>
                    <div className="text-sm text-gray-300">Total Classes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">0</div>
                    <div className="text-sm text-gray-300">Active Classes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">0</div>
                    <div className="text-sm text-gray-300">Faculty Members</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "Lab Computers":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Lab Computers
                </h3>
                <p className="text-sm text-gray-300">
                  Monitor and manage computer allocation
                </p>
              </div>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Add Computer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">💻</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Online
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🔴</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Offline
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🔧</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Maintenance
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👥</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      In Use
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">
                  Computer Status
                </h4>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">🖥️</div>
                <p className="text-gray-300">No computers configured</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add computers to start monitoring their status
                </p>
              </div>
            </div>
          </div>
        );

      case "Settings":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white">
                System Settings
              </h3>
              <p className="text-sm text-gray-300">
                Configure system preferences
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
                  General Settings
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      System Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="CLIRDEC Presence"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Time Zone
                    </label>
                    <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                      <option>Asia/Shanghai</option>
                      <option>Asia/Manila</option>
                      <option>UTC</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoBackup"
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="autoBackup"
                      className="ml-2 block text-sm text-gray-300"
                    >
                      Enable automatic backups
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <h4 className="text-lg font-medium text-white mb-4">
                  Notification Settings
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="emailNotifications"
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                      defaultChecked
                    />
                    <label
                      htmlFor="emailNotifications"
                      className="ml-2 block text-sm text-gray-300"
                    >
                      Email notifications
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="lateAlerts"
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="lateAlerts"
                      className="ml-2 block text-sm text-gray-300"
                    >
                      Late arrival alerts
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="deviceAlerts"
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                      defaultChecked
                    />
                    <label
                      htmlFor="deviceAlerts"
                      className="ml-2 block text-sm text-gray-300"
                    >
                      Device status alerts
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-medium text-white mb-4">
                System Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-300">Version:</span>
                    <span className="text-white">1.0.0</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-300">Database:</span>
                    <span className="text-green-400">Connected</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-300">WebSocket:</span>
                    <span className="text-green-400">Connected</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-300">Uptime:</span>
                    <span className="text-white">0d 0h 0m</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-300">Last Backup:</span>
                    <span className="text-gray-400">Never</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-300">Storage Used:</span>
                    <span className="text-white">0 MB</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        );

      case "Class Roster":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">Class Roster</h3>
                <p className="text-sm text-gray-300">
                  View enrolled students by class
                </p>
              </div>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Manage Enrollment
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">📚</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Active Classes
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👥</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Total Enrolled
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">⏰</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Today's Classes
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">Class List</h4>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-gray-300">No classes available</p>
                <p className="text-sm text-gray-400 mt-2">
                  Create classes and enroll students to see roster information
                </p>
              </div>
            </div>
          </div>
        );

      case "Faculty":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Faculty Management
                </h3>
                <p className="text-sm text-gray-300">
                  Manage faculty information and permissions
                </p>
              </div>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Add Faculty
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👨‍🏫</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Total Faculty
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">✅</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Active Today
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🏫</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Departments
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">
                  Faculty Members
                </h4>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">👨‍🏫</div>
                <p className="text-gray-300">No faculty members added yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add faculty members to start managing permissions and class
                  assignments
                </p>
              </div>
            </div>
          </div>
        );

      case "User Management":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">
                  User Management
                </h3>
                <p className="text-sm text-gray-300">
                  Manage system users and permissions
                </p>
              </div>
              <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Add User
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👤</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Total Users
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🛡️</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Administrators
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">👨‍🏫</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Faculty
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">🔧</span>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-300 truncate">
                      Technicians
                    </dt>
                    <dd className="text-2xl font-semibold text-white">0</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-700">
                <h4 className="text-lg font-medium text-white">System Users</h4>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">👥</div>
                <p className="text-gray-300">No users configured yet</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add users to start managing system access and permissions
                </p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow p-6">
              <h4 className="text-lg font-medium text-white mb-4">
                Permission Overview
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-md font-medium text-cyan-400 mb-3">
                    Administrator Access
                  </h5>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Full system access
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      User management
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      System configuration
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="text-md font-medium text-blue-400 mb-3">
                    Faculty Access
                  </h5>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Attendance monitoring
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Student management
                    </div>
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Report generation
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {activeSection} - Coming Soon
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
              {menuSections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item, itemIndex) => (
                      <button
                        key={itemIndex}
                        onClick={() => {
                          setActiveSection(item.name);
                        }}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeSection === item.name
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
                    ))}
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
                <h2 className="text-2xl font-bold text-white">
                  {activeSection}
                </h2>
                <p className="text-sm text-gray-300">
                  {menuSections
                    .flatMap((s) => s.items)
                    .find((item) => item.name === activeSection)?.description ||
                    "System Overview"}
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
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
