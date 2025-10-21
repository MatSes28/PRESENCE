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
    title: "Advanced Attendance Management",
    items: [
      {
        name: "Dashboard",
        icon: "📊",
        description: "Overview & Analytics",
        active: true,
      },
      {
        name: "Live Attendance",
        icon: "⚡",
        description: "Real-time tracking",
      },
    ],
  },
  {
    title: "Academic Management",
    items: [
      { name: "Schedule", icon: "📅", description: "Class timetables" },
      { name: "Students", icon: "👥", description: "Student management" },
      { name: "Lab Computers", icon: "💻", description: "Computer allocation" },
    ],
  },
  {
    title: "System Monitoring",
    items: [{ name: "IoT Devices", icon: "📡", description: "ESP32 hardware" }],
  },
  {
    title: "Reports & Analytics",
    items: [{ name: "Reports", icon: "📈", description: "Data insights" }],
  },
  {
    title: "Administration",
    items: [
      {
        name: "Faculty Management",
        icon: "👤",
        description: "Faculty & admin accounts",
      },
    ],
  },
  {
    title: "Account",
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
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">⚡</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Real-time Activity
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        Live Updates
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {realTimeData.length === 0 ? (
                      <p className="text-gray-500">No recent activity</p>
                    ) : (
                      realTimeData.map((data: any, index: number) => (
                        <div
                          key={index}
                          className="bg-white p-2 rounded border"
                        >
                          <p className="text-xs text-gray-600">
                            {new Date(data.timestamp).toLocaleTimeString()}
                          </p>
                          <p className="text-sm">
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
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">📡</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        IoT Devices
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
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
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <div className="space-y-2">
                    {deviceStatus.map((device: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span className="text-gray-900">{device.deviceId}</span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            device.status === "online"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
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
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">⚙️</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Quick Actions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        Management
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <div className="space-y-2">
                    <button
                      onClick={() => (window.location.href = "/students")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      📚 Manage Students
                    </button>
                    <button
                      onClick={() => (window.location.href = "/reports")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      📊 View Reports
                    </button>
                    <button
                      onClick={() => (window.location.href = "/schedule")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      📅 View Schedule
                    </button>
                    <button
                      onClick={() => (window.location.href = "/devices")}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
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
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {activeSection} - Coming Soon
            </h3>
            <p className="text-gray-600">
              This feature is currently under development. Check back soon!
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-teal-600">
                CLIRDEC:PRESENCE
              </h1>
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {menuSections.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
                          } else if (item.name === "Faculty Management") {
                            window.location.href = "/faculty";
                          } else if (item.name === "Settings") {
                            window.location.href = "/settings";
                          } else {
                            setActiveSection(item.name);
                          }
                        }}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeSection === item.name
                            ? "bg-teal-50 text-teal-700 border-r-2 border-teal-500"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <span className="mr-3 text-lg">{item.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-gray-500">
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
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {activeSection}
                </h2>
                <p className="text-sm text-gray-600">
                  {menuSections
                    .flatMap((s) => s.items)
                    .find((item) => item.name === activeSection)?.description ||
                    "System Overview"}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{renderContent()}</main>
      </div>
    </div>
  );
};
