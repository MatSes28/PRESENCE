import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

interface IoTDevice {
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline";
  lastHeartbeat: string;
  config: {
    classroom: string;
    deviceType: string;
  };
}

export const IoTDevices: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const response = await api.get("/iot/devices");
      setDevices(response.data);
    } catch (error) {
      console.error("Failed to load IoT devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcastMessage = async () => {
    if (user?.role !== "admin") return;

    try {
      await api.post("/iot/broadcast", {
        message: "System maintenance scheduled",
        type: "info",
      });
      // Show success notification
    } catch (error) {
      console.error("Failed to broadcast message:", error);
    }
  };

  const handleRequestDiagnostics = async (deviceId: string) => {
    try {
      await api.post(`/iot/devices/${deviceId}/diagnostics`);
      // Show success notification
    } catch (error) {
      console.error("Failed to request diagnostics:", error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading IoT devices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">IoT Devices</h2>
        {user?.role === "admin" && (
          <button
            onClick={handleBroadcastMessage}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Broadcast Message
          </button>
        )}
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div key={device.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {device.name}
              </h3>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  device.status === "online"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {device.status}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>IP Address:</strong> {device.ipAddress}
              </p>
              <p>
                <strong>Classroom:</strong> {device.config.classroom}
              </p>
              <p>
                <strong>Type:</strong> {device.config.deviceType}
              </p>
              <p>
                <strong>Last Heartbeat:</strong>{" "}
                {new Date(device.lastHeartbeat).toLocaleString()}
              </p>
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                onClick={() => handleRequestDiagnostics(device.id)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Diagnostics
              </button>
              {user?.role === "admin" && (
                <button className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
                  Configure
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No IoT devices found
        </div>
      )}
    </div>
  );
};
