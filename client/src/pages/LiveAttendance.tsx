import { useState, useEffect } from "react";
import { getWebSocketClient } from "../lib/websocket";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useLocation } from "wouter";

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
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [rfidInput, setRfidInput] = useState("");
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    validEntries: 0,
    discrepancies: 0,
    activeDevices: 0,
  });
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntryData, setManualEntryData] = useState({
    studentId: "",
    classSessionId: "",
    entryTime: "",
    notes: "",
  });
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Fetch initial attendance data
  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setLoading(true);
        const response = await api.get("/attendance");
        if (response.success && Array.isArray(response.data)) {
          setAttendanceData(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch attendance data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, []);

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
      // Update attendance data
      setAttendanceData((prev) => [data, ...prev.slice(0, 99)]);
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

  const simulateRfidTap = async () => {
    if (!rfidInput.trim()) return;

    try {
      const response = await api.post("/attendance/simulate-rfid", {
        rfidUid: rfidInput.trim(),
      });

      if (response.success) {
        setRfidInput("");
        // The WebSocket will handle updating the UI
      } else {
        console.error("RFID simulation failed:", response.message);
      }
    } catch (error) {
      console.error("Failed to simulate RFID tap:", error);
    }
  };

  const refreshAttendanceData = async () => {
    try {
      const response = await api.get("/attendance");
      if (response.success && Array.isArray(response.data)) {
        setAttendanceData(response.data);
      }
    } catch (error) {
      console.error("Failed to refresh attendance data:", error);
    }
  };

  const handleAttendanceAction = async (action: string, studentId: number) => {
    try {
      switch (action) {
        case "excuse":
          // Mark as excused (placeholder - would update attendance record)
          addNotification({
            type: "success",
            title: "Student Excused",
            message: "Student has been marked as excused.",
          });
          break;
        case "contact":
          // Send notification to parent (placeholder - would send email/SMS)
          addNotification({
            type: "info",
            title: "Parent Contacted",
            message: "Notification sent to student's parent.",
          });
          break;
        case "monitor":
          // Open monitoring view for this student
          setLocation(`/students/${studentId}`);
          break;
      }
      refreshAttendanceData();
    } catch (error) {
      console.error(`Failed to ${action} student:`, error);
      addNotification({
        type: "error",
        title: "Action Failed",
        message: `Failed to ${action} student. Please try again.`,
      });
    }
  };

  // Add notification helper
  const addNotification = (notification: any) => {
    console.log("Notification:", notification);
  };

  // Load students and sessions for manual entry
  const loadManualEntryData = async () => {
    try {
      const [studentsRes, sessionsRes] = await Promise.all([
        api.getStudents(),
        api.get("/attendance/sessions/active"),
      ]);
      if (studentsRes.success) {
        setStudents((studentsRes.data as any[]) || []);
      }
      if (sessionsRes.success) {
        setSessions(((sessionsRes.data as any)?.sessions as any[]) || []);
      }
    } catch (error) {
      console.error("Failed to load manual entry data:", error);
    }
  };

  // Handle manual attendance entry
  const handleManualEntry = async () => {
    if (!manualEntryData.studentId || !manualEntryData.classSessionId) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please select a student and session",
      });
      return;
    }

    try {
      const response = await api.post("/attendance/manual", {
        studentId: parseInt(manualEntryData.studentId),
        classSessionId: parseInt(manualEntryData.classSessionId),
        entryTime: manualEntryData.entryTime || new Date().toISOString(),
        notes: manualEntryData.notes,
      });

      if (response.success) {
        addNotification({
          type: "success",
          title: "Attendance Recorded",
          message: "Manual attendance entry has been recorded successfully.",
        });
        setShowManualEntry(false);
        setManualEntryData({
          studentId: "",
          classSessionId: "",
          entryTime: "",
          notes: "",
        });
        refreshAttendanceData();
      } else {
        addNotification({
          type: "error",
          title: "Entry Failed",
          message: response.message || "Failed to record attendance",
        });
      }
    } catch (error) {
      console.error("Manual entry error:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to record attendance. Please try again.",
      });
    }
  };

  // Load data when modal opens
  useEffect(() => {
    if (showManualEntry) {
      loadManualEntryData();
    }
  }, [showManualEntry]);

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
          <h3 className="text-lg font-medium text-cyan-400">
            Live Attendance Monitoring
          </h3>
          <p className="text-sm text-gray-300">
            Real-time attendance tracking and system events
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={refreshAttendanceData}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg"
          >
            Refresh
          </button>
          {user?.role === "admin" && (
            <button
              onClick={() => setShowManualEntry(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
            >
              Manual Entry
            </button>
          )}
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm text-gray-400">
              RFID Scanner {isConnected ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* RFID Scanner Simulation */}
      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          RFID Scanner Simulation
        </h4>
        <div className="flex space-x-4">
          <input
            type="text"
            value={rfidInput}
            onChange={(e) => setRfidInput(e.target.value)}
            placeholder="Enter RFID card ID"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
          />
          <button
            onClick={simulateRfidTap}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg"
          >
            Simulate Tap
          </button>
        </div>
      </div>

      {/* Live Attendance Table */}
      <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400">
            Live Attendance Table
          </h4>
          <p className="text-sm text-gray-300">
            Current session attendance records
          </p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-white">Loading attendance data...</div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Student ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Check-in Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Computer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {attendanceData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  attendanceData.slice(0, 10).map((record: any) => (
                    <tr key={record.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white">
                              {record.student?.name?.charAt(0) || "?"}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-white">
                              {record.student?.name || "Unknown"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {record.student?.studentId || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            record.status === "present"
                              ? "bg-green-100 text-green-800"
                              : record.status === "late"
                              ? "bg-yellow-100 text-yellow-800"
                              : record.status === "absent"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {record.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {record.entryTime
                          ? new Date(record.entryTime).toLocaleTimeString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {record.computerAssignment?.computer?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {record.status === "present" && (
                            <button
                              onClick={() =>
                                handleAttendanceAction(
                                  "monitor",
                                  record.student?.id || 0
                                )
                              }
                              className="text-cyan-400 hover:text-cyan-300"
                            >
                              Monitor
                            </button>
                          )}
                          {record.status === "absent" && (
                            <>
                              <button
                                onClick={() =>
                                  handleAttendanceAction(
                                    "excuse",
                                    record.student?.id || 0
                                  )
                                }
                                className="text-blue-400 hover:text-blue-300"
                              >
                                Excuse
                              </button>
                              <button
                                onClick={() =>
                                  handleAttendanceAction(
                                    "contact",
                                    record.student?.id || 0
                                  )
                                }
                                className="text-gray-400 hover:text-gray-300"
                              >
                                Contact
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
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

        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
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

        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
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

        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
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
      <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h4 className="text-lg font-medium text-cyan-400">
            Live Events Feed
          </h4>
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
      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-cyan-400 mb-4">
          System Status
        </h4>
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

      {/* Manual Attendance Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Manual Attendance Entry
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Student
                </label>
                <select
                  value={manualEntryData.studentId}
                  onChange={(e) =>
                    setManualEntryData({
                      ...manualEntryData,
                      studentId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select Student</option>
                  {students.map((student: any) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.studentId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Class Session
                </label>
                <select
                  value={manualEntryData.classSessionId}
                  onChange={(e) =>
                    setManualEntryData({
                      ...manualEntryData,
                      classSessionId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select Session</option>
                  {sessions.map((session: any) => (
                    <option key={session.session.id} value={session.session.id}>
                      {session.schedule?.subject?.name} -{" "}
                      {session.schedule?.classroom?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Entry Time
                </label>
                <input
                  type="datetime-local"
                  value={manualEntryData.entryTime}
                  onChange={(e) =>
                    setManualEntryData({
                      ...manualEntryData,
                      entryTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={manualEntryData.notes}
                  onChange={(e) =>
                    setManualEntryData({
                      ...manualEntryData,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowManualEntry(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleManualEntry}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Record Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
