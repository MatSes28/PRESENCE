import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

interface IoTDevice {
  device: {
    id: number;
    deviceId: string;
    classroomId: number;
    deviceType: string;
    status: "online" | "offline" | "maintenance";
    lastSeen: string | null;
    config: any;
    apiKey?: string;
    certificateFingerprint?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  classroom: {
    id: number;
    name: string;
    location: string;
    type: string;
    capacity: number | null;
  };
}

interface Classroom {
  id: number;
  name: string;
  location: string;
}

export const IoTDevices: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<IoTDevice | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [deviceApiKey, setDeviceApiKey] = useState<string | null>(null);

  // Registration form state
  const [registrationForm, setRegistrationForm] = useState({
    deviceId: "",
    classroomId: "",
    deviceType: "esp32_s3",
    config: {
      rfidEnabled: true,
      ultrasonicEnabled: true,
      heartbeatInterval: 30000,
      sensorThreshold: 50,
    },
  });

  useEffect(() => {
    loadDevices();
    loadClassrooms();
  }, []);

  const loadDevices = async () => {
    try {
      const response = (await api.get("/iot/devices")) as { data: IoTDevice[] };
      setDevices(response.data);
    } catch (error) {
      console.error("Failed to load IoT devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadClassrooms = async () => {
    try {
      const response = (await api.get("/classrooms")) as { data: Classroom[] };
      setClassrooms(response.data);
    } catch (error) {
      console.error("Failed to load classrooms:", error);
    }
  };

  const handleRegisterDevice = async () => {
    try {
      await api.post("/iot/devices", registrationForm);
      setShowRegisterModal(false);
      setRegistrationForm({
        deviceId: "",
        classroomId: "",
        deviceType: "esp32_s3",
        config: {
          rfidEnabled: true,
          ultrasonicEnabled: true,
          heartbeatInterval: 30000,
          sensorThreshold: 50,
        },
      });
      loadDevices();
    } catch (error) {
      console.error("Failed to register device:", error);
    }
  };

  const handleSendCommand = async (
    deviceId: string,
    command: string,
    params?: any
  ) => {
    try {
      await api.post(`/iot/devices/${deviceId}/command`, { command, params });
      // Show success notification
    } catch (error) {
      console.error("Failed to send command:", error);
    }
  };

  const handleUpdateConfig = async (deviceId: string, config: any) => {
    try {
      await api.put(`/iot/devices/${deviceId}/config`, { config });
      setShowConfigModal(false);
      setSelectedDevice(null);
      loadDevices();
    } catch (error) {
      console.error("Failed to update config:", error);
    }
  };

  const handleGetApiKey = async (deviceId: string) => {
    try {
      // Find the device data
      const deviceData = devices.find((d) => d.device.deviceId === deviceId);
      if (deviceData) {
        setSelectedDevice(deviceData);
      }

      const response = (await api.get(`/iot/devices/${deviceId}/api-key`)) as {
        data: { apiKey: string };
      };
      setDeviceApiKey(response.data.apiKey);
      setShowSecurityModal(true);
    } catch (error) {
      console.error("Failed to get API key:", error);
    }
  };

  const handleRegenerateApiKey = async (deviceId: string) => {
    try {
      const response = (await api.post(
        `/iot/devices/${deviceId}/regenerate-api-key`
      )) as { data: { apiKey: string } };
      setDeviceApiKey(response.data.apiKey);
      alert("API key regenerated successfully!");
    } catch (error) {
      console.error("Failed to regenerate API key:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800 border-green-200";
      case "offline":
        return "bg-red-100 text-red-800 border-red-200";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return "🟢";
      case "offline":
        return "🔴";
      case "maintenance":
        return "🟡";
      default:
        return "⚪";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading IoT devices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            IoT Device Management
          </h2>
          <p className="text-gray-600">
            Monitor and control RFID attendance devices
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Register Device
          </button>
          <button
            onClick={loadDevices}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-full sm:w-auto"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">📊</div>
            <div>
              <p className="text-sm text-gray-600">Total Devices</p>
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
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-2xl font-bold text-green-600">
                {devices.filter((d) => d.device.status === "online").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🔴</div>
            <div>
              <p className="text-sm text-gray-600">Offline</p>
              <p className="text-2xl font-bold text-red-600">
                {devices.filter((d) => d.device.status === "offline").length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🟡</div>
            <div>
              <p className="text-sm text-gray-600">Maintenance</p>
              <p className="text-2xl font-bold text-yellow-600">
                {
                  devices.filter((d) => d.device.status === "maintenance")
                    .length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((deviceData) => {
          const { device, classroom } = deviceData;
          return (
            <div
              key={device.id}
              className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {device.deviceType === "esp32_s3" ? "📱" : "🔧"}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {device.deviceId}
                      </h3>
                      <p className="text-sm text-gray-600">{classroom.name}</p>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      device.status
                    )}`}
                  >
                    {getStatusIcon(device.status)} {device.status}
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div className="px-6 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">
                      <strong>Type:</strong>
                    </p>
                    <p className="text-gray-900">{device.deviceType}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">
                      <strong>Classroom:</strong>
                    </p>
                    <p className="text-gray-900">{classroom.name}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 text-sm">
                    <strong>Last Seen:</strong>
                  </p>
                  <p className="text-gray-900 text-sm">
                    {device.lastSeen
                      ? new Date(device.lastSeen).toLocaleString()
                      : "Never"}
                  </p>
                </div>

                {device.config && (
                  <div>
                    <p className="text-gray-600 text-sm">
                      <strong>Configuration:</strong>
                    </p>
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono">
                      <div>RFID: {device.config.rfidEnabled ? "✅" : "❌"}</div>
                      <div>
                        Ultrasonic:{" "}
                        {device.config.ultrasonicEnabled ? "✅" : "❌"}
                      </div>
                      <div>Heartbeat: {device.config.heartbeatInterval}ms</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSendCommand(device.deviceId, "ping")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Ping
                  </button>
                  <button
                    onClick={() =>
                      handleSendCommand(device.deviceId, "restart")
                    }
                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Restart
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDevice(deviceData);
                      setShowConfigModal(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Configure
                  </button>
                  <button
                    onClick={() =>
                      handleSendCommand(device.deviceId, "diagnostics")
                    }
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    Diagnostics
                  </button>
                  <button
                    onClick={() => handleGetApiKey(device.deviceId)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    🔐 Security
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No IoT devices registered
          </h3>
          <p className="text-gray-600 mb-4">
            Register your first RFID attendance device to get started
          </p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Register Device
          </button>
        </div>
      )}

      {/* Register Device Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white border-gray-300">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Register IoT Device
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device ID
                  </label>
                  <input
                    type="text"
                    value={registrationForm.deviceId}
                    onChange={(e) =>
                      setRegistrationForm({
                        ...registrationForm,
                        deviceId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="ESP32-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classroom
                  </label>
                  <select
                    value={registrationForm.classroomId}
                    onChange={(e) =>
                      setRegistrationForm({
                        ...registrationForm,
                        classroomId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Classroom</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Type
                  </label>
                  <select
                    value={registrationForm.deviceType}
                    onChange={(e) =>
                      setRegistrationForm({
                        ...registrationForm,
                        deviceType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="esp32_s3">ESP32-S3</option>
                    <option value="esp32">ESP32</option>
                    <option value="raspberry_pi">Raspberry Pi</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterDevice}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Register Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configure Device Modal */}
      {showConfigModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white border-gray-300">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Configure {selectedDevice.device.deviceId}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="rfidEnabled"
                    checked={selectedDevice.device.config?.rfidEnabled ?? true}
                    onChange={(e) => {
                      const updatedDevice = { ...selectedDevice };
                      updatedDevice.device.config = {
                        ...updatedDevice.device.config,
                        rfidEnabled: e.target.checked,
                      };
                      setSelectedDevice(updatedDevice);
                    }}
                    className="mr-2"
                  />
                  <label
                    htmlFor="rfidEnabled"
                    className="text-sm font-medium text-gray-700"
                  >
                    Enable RFID Scanning
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ultrasonicEnabled"
                    checked={
                      selectedDevice.device.config?.ultrasonicEnabled ?? true
                    }
                    onChange={(e) => {
                      const updatedDevice = { ...selectedDevice };
                      updatedDevice.device.config = {
                        ...updatedDevice.device.config,
                        ultrasonicEnabled: e.target.checked,
                      };
                      setSelectedDevice(updatedDevice);
                    }}
                    className="mr-2"
                  />
                  <label
                    htmlFor="ultrasonicEnabled"
                    className="text-sm font-medium text-gray-700"
                  >
                    Enable Ultrasonic Sensor
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heartbeat Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={
                      selectedDevice.device.config?.heartbeatInterval ?? 30000
                    }
                    onChange={(e) => {
                      const updatedDevice = { ...selectedDevice };
                      updatedDevice.device.config = {
                        ...updatedDevice.device.config,
                        heartbeatInterval: parseInt(e.target.value),
                      };
                      setSelectedDevice(updatedDevice);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    setSelectedDevice(null);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleUpdateConfig(
                      selectedDevice.device.deviceId,
                      selectedDevice.device.config
                    )
                  }
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Update Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white border-gray-300">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Device Security Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <div className="bg-gray-50 p-3 rounded-md font-mono text-sm break-all">
                    {deviceApiKey || "Loading..."}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use this API key for device authentication via REST API or
                    WebSocket connections.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (selectedDevice) {
                        handleRegenerateApiKey(selectedDevice.device.deviceId);
                      }
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Regenerate API Key
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deviceApiKey || "");
                      alert("API key copied to clipboard!");
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Copy Key
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowSecurityModal(false);
                    setDeviceApiKey(null);
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
