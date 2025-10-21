import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface IoTDevice {
  id: number;
  deviceId: string;
  classroomId: number;
  classroomName?: string;
  deviceType: string;
  status: "online" | "offline" | "maintenance";
  lastSeen: string;
  config?: any;
  createdAt: string;
}

export const IoTDevices = () => {
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<IoTDevice | null>(null);
  const [commandResult, setCommandResult] = useState<string>("");

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await api.getIoTDevices();
      setDevices((response.data as IoTDevice[]) || []);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async (
    deviceId: string,
    command: string,
    params?: any
  ) => {
    try {
      setCommandResult(`Sending ${command} command...`);
      const response = await api.sendDeviceCommand(deviceId, command, params);
      setCommandResult(
        `Command sent successfully: ${response.message || "OK"}`
      );
      fetchDevices(); // Refresh device list
    } catch (error) {
      setCommandResult(`Command failed: ${error}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800";
      case "offline":
        return "bg-gray-100 text-gray-800";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return "🟢";
      case "offline":
        return "⚫";
      case "maintenance":
        return "🟡";
      default:
        return "⚫";
    }
  };

  const getTimeSinceLastSeen = (lastSeen: string) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            IoT Device Management
          </h3>
          <p className="text-sm text-gray-500">
            Monitor and control ESP32 devices
          </p>
        </div>
        <button
          onClick={fetchDevices}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">📡</div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Devices</p>
              <p className="text-2xl font-bold text-gray-900">
                {devices.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🟢</div>
            <div>
              <p className="text-sm font-medium text-gray-500">Online</p>
              <p className="text-2xl font-bold text-green-600">
                {devices.filter((d) => d.status === "online").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">⚫</div>
            <div>
              <p className="text-sm font-medium text-gray-500">Offline</p>
              <p className="text-2xl font-bold text-gray-600">
                {devices.filter((d) => d.status === "offline").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🟡</div>
            <div>
              <p className="text-sm font-medium text-gray-500">Maintenance</p>
              <p className="text-2xl font-bold text-yellow-600">
                {devices.filter((d) => d.status === "maintenance").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div
            key={device.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{getStatusIcon(device.status)}</div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">
                      {device.deviceId}
                    </h4>
                    <p className="text-sm text-gray-500">{device.deviceType}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    device.status
                  )}`}
                >
                  {device.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Classroom:</span>
                  <span className="text-gray-900">
                    Room {device.classroomId}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last Seen:</span>
                  <span className="text-gray-900">
                    {getTimeSinceLastSeen(device.lastSeen)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-gray-900">
                    {new Date(device.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => sendCommand(device.deviceId, "ping")}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
                  disabled={device.status !== "online"}
                >
                  Ping
                </button>
                <button
                  onClick={() => sendCommand(device.deviceId, "restart")}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm font-medium"
                  disabled={device.status !== "online"}
                >
                  Restart
                </button>
                <button
                  onClick={() => setSelectedDevice(device)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium"
                >
                  Config
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📡</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No IoT Devices Found
          </h3>
          <p className="text-gray-600">
            ESP32 devices will appear here once they connect to the system.
          </p>
        </div>
      )}

      {/* Device Configuration Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Device Configuration: {selectedDevice.deviceId}
                </h3>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Status
                  </label>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      selectedDevice.status
                    )}`}
                  >
                    {selectedDevice.status}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Configuration
                  </label>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedDevice.config || {}, null, 2)}
                  </pre>
                </div>

                {commandResult && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm text-blue-800">{commandResult}</p>
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      sendCommand(selectedDevice.deviceId, "update_config", {
                        test: true,
                      })
                    }
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                    disabled={selectedDevice.status !== "online"}
                  >
                    Update Config
                  </button>
                  <button
                    onClick={() =>
                      sendCommand(selectedDevice.deviceId, "status")
                    }
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium"
                    disabled={selectedDevice.status !== "online"}
                  >
                    Get Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
