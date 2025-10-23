import { useState, useEffect } from "react";
import { getWebSocketClient } from "../lib/websocket";
import { useAuth } from "../hooks/useAuth";

interface AttendanceEvent {
  id: string;
  type: "rfid_scan" | "sensor_trigger" | "attendance_record";
  studentId?: string;
  studentName?: string;
  rfidUid?: string;
  sensorType?: "entry" | "exit";
  distance?: number;
  timestamp: string;
  deviceId: string;
  status?: "valid" | "invalid" | "discrepancy";
}

export const LiveAttendance = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    validEntries: 0,
    discrepancies: 0,
    activeDevices: 0,
  });

  useEffect(() => {
    const wsClient = getWebSocketClient(user?.id);

    // Connection status
    wsClient.on("connect", () => setIsConnected(true));
    wsClient.on("disconnect", () => setIsConnected(false));

    // Real-time attendance events
    wsClient.on("rfidScan", (data) => {
      addEvent({
        id: Date.now().toString(),
        type: "rfid_scan",
        rfidUid: data.rfidUid,
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        status: "valid",
      });
    });

    wsClient.on("sensorTrigger", (data) => {
      addEvent({
        id: Date.now().toString(),
        type: "sensor_trigger",
        sensorType: data.sensorType,
        distance: data.distance,
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        status: data.distance <= 100 ? "valid" : "invalid",
      });
    });

    wsClient.on("attendanceRecord", (data) => {
      addEvent({
        id: Date.now().toString(),
        type: "attendance_record",
        studentId: data.studentId,
        studentName: data.studentName,
        timestamp: data.timestamp,
        deviceId: data.deviceId,
        status: data.isValid ? "valid" : "discrepancy",
      });
      updateStats(data);
    });

    wsClient.on("deviceStatus", (data) => {
      setStats((prev) => ({
        ...prev,
        activeDevices: data.filter((d: any) => d.status === "online").length,
      }));
    });

    // Get initial device status
    wsClient.getDeviceStatus();

    return () => {
      wsClient.off("connect");
      wsClient.off("disconnect");
      wsClient.off("rfidScan");
      wsClient.off("sensorTrigger");
      wsClient.off("attendanceRecord");
      wsClient.off("deviceStatus");
    };
  }, [user?.id]);

  const addEvent = (event: AttendanceEvent) => {
    setEvents((prev) => [event, ...prev.slice(0, 49)]); // Keep last 50 events
    setStats((prev) => ({ ...prev, totalEvents: prev.totalEvents + 1 }));
  };

  const updateStats = (data: any) => {
    setStats((prev) => ({
      ...prev,
      validEntries: data.isValid ? prev.validEntries + 1 : prev.validEntries,
      discrepancies: !data.isValid
        ? prev.discrepancies + 1
        : prev.discrepancies,
    }));
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "rfid_scan":
        return "🎫";
      case "sensor_trigger":
        return "📡";
      case "attendance_record":
        return "✅";
      default:
        return "📝";
    }
  };

  const getEventColor = (status?: string) => {
    switch (status) {
      case "valid":
        return "text-green-400 bg-green-900";
      case "invalid":
        return "text-red-400 bg-red-900";
      case "discrepancy":
        return "text-yellow-400 bg-yellow-900";
      default:
        return "text-gray-400 bg-gray-900";
    }
  };

  const getEventDescription = (event: AttendanceEvent) => {
    switch (event.type) {
      case "rfid_scan":
        return `RFID card scanned: ${event.rfidUid}`;
      case "sensor_trigger":
        return `${event.sensorType} sensor triggered (${event.distance}cm)`;
      case "attendance_record":
        return `${event.studentName} (${event.studentId}) - Attendance recorded`;
      default:
        return "Unknown event";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-white">
            Live Attendance Monitoring
          </h3>
          <p className="text-sm text-gray-300">
            Real-time attendance tracking and system events
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm text-gray-400">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Total Events
              </dt>
              <dd className="text-lg font-semibold text-white">
                {stats.totalEvents}
              </dd>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">✅</span>
              </div>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Valid Entries
              </dt>
              <dd className="text-lg font-semibold text-white">
                {stats.validEntries}
              </dd>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">⚠️</span>
              </div>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Discrepancies
              </dt>
              <dd className="text-lg font-semibold text-white">
                {stats.discrepancies}
              </dd>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">📡</span>
              </div>
            </div>
            <div className="ml-4">
              <dt className="text-sm font-medium text-gray-300 truncate">
                Active Devices
              </dt>
              <dd className="text-lg font-semibold text-white">
                {stats.activeDevices}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Live Events Feed */}
      <div className="bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">Live Events Feed</h4>
          <p className="text-sm text-gray-300">
            Real-time system events and attendance records
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📡</div>
              <p className="text-gray-400">Waiting for attendance events...</p>
              <p className="text-sm text-gray-500 mt-2">
                Events will appear here as students interact with the system
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {events.map((event) => (
                <div key={event.id} className="px-6 py-4 hover:bg-gray-700">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                        <span className="text-lg">
                          {getEventIcon(event.type)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">
                          {getEventDescription(event)}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEventColor(
                              event.status
                            )}`}
                          >
                            {event.status || "unknown"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center space-x-4 text-xs text-gray-400">
                        <span>Device: {event.deviceId}</span>
                        <span>Type: {event.type.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h4 className="text-lg font-medium text-white mb-4">System Status</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <div>
              <p className="text-sm font-medium text-white">
                WebSocket Connection
              </p>
              <p className="text-xs text-gray-400">
                {isConnected
                  ? "Connected to server"
                  : "Disconnected from server"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-white">IoT Devices</p>
              <p className="text-xs text-gray-400">
                {stats.activeDevices} device
                {stats.activeDevices !== 1 ? "s" : ""} online
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-white">
                Attendance System
              </p>
              <p className="text-xs text-gray-400">Active and monitoring</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
