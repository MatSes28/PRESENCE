import { useAuth } from "../hooks/useAuth";
import { useState, useEffect } from "react";
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
    title: "IoT Devices",
    items: [{ name: "IoT Devices", icon: "📡", description: "ESP32 hardware" }],
  },
  {
    title: "System Health",
    items: [
      { name: "System Health", icon: "🩺", description: "Performance monitor" },
    ],
  },
  {
    title: "System Testing",
    items: [
      { name: "System Testing", icon: "🧪", description: "Test & simulate" },
    ],
  },
  {
    title: "Reports",
    items: [{ name: "Reports", icon: "📈", description: "Data insights" }],
  },
  {
    title: "Help Center",
    items: [{ name: "Help Center", icon: "❓", description: "Guides & FAQs" }],
  },
  {
    title: "Settings",
    items: [
      { name: "Settings", icon: "⚙️", description: "System configuration" },
    ],
  },
];

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const [realTimeData, setRealTimeData] = useState<any[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState("Dashboard");

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
                      onClick={() => (window.location.href = "/students")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📚 Manage Students
                    </button>
                    <button
                      onClick={() => (window.location.href = "/reports")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📊 View Reports
                    </button>
                    <button
                      onClick={() => (window.location.href = "/schedule")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📅 View Schedule
                    </button>
                    <button
                      onClick={() => (window.location.href = "/devices")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-600 rounded"
                    >
                      📡 IoT Devices
                    </button>
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
                          // Handle navigation for actual pages
                          if (item.name === "Students") {
                            window.location.href = "/students";
                          } else if (item.name === "Reports") {
                            window.location.href = "/reports";
                          } else if (item.name === "IoT Devices") {
                            window.location.href = "/devices";
                          } else if (item.name === "Lab Computers") {
                            window.location.href = "/lab-computers";
                          } else if (item.name === "Live Attendance") {
                            window.location.href = "/attendance";
                          } else if (item.name === "Schedule") {
                            window.location.href = "/schedule";
                          } else if (item.name === "Settings") {
                            window.location.href = "/settings";
                          } else {
                            setActiveSection(item.name);
                          }
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
