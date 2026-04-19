import { useState, useEffect, useRef } from "react";
import { getWebSocketClient } from "../lib/websocket";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useLocation } from "wouter";
import { useNotifications } from "../components/NotificationSystem";

const isDocumentHidden = () =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

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
  const { addNotification } = useNotifications();
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
  const [showExcuseModal, setShowExcuseModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntryData, setManualEntryData] = useState({
    studentId: "",
    classSessionId: "",
    entryTime: "",
    notes: "",
  });
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sensorSimulationPending, setSensorSimulationPending] = useState<
    "entry" | "exit" | null
  >(null);

  // Advanced filtering state
  const [filters, setFilters] = useState({
    dateRange: {
      start: new Date().toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    },
    status: "all", // all, present, absent, late
    studentId: "",
    sessionId: "",
    deviceId: "",
    searchTerm: "",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Bulk operations state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(
    new Set()
  );
  const [bulkOperation, setBulkOperation] = useState<
    "excuse" | "contact" | "export" | null
  >(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "entryTime", direction: "desc" });

  const refreshAttendanceDataRef = useRef<() => void>(() => {});

  // Normalize server response: server returns { records: [{ record, student, session }] }
  const normalizeAttendanceRecords = (raw: any[]) => {
    if (!Array.isArray(raw)) return [];
    return raw.map((r: any) => ({
      ...(r.record ?? r),
      student: r.student,
      session: r.session,
    }));
  };

  const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    const fieldErrors = (error as any)?.data?.errors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const firstFieldError = Object.values(fieldErrors)[0];
      if (typeof firstFieldError === "string") {
        return firstFieldError;
      }
    }

    return fallback;
  };

  // Fetch initial attendance data (real API, no mock)
  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (filters.dateRange.start) params.set("date", filters.dateRange.start);
        const response = await api.get(`/attendance?${params.toString()}`);
        const raw = (response as any).records ?? (response as any).data;
        if (response.success && Array.isArray(raw)) {
          setAttendanceData(normalizeAttendanceRecords(raw));
        } else {
          setAttendanceData([]);
        }
      } catch (error) {
        console.error("Failed to fetch attendance data:", error);
        setAttendanceData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [filters.dateRange.start]);

  useEffect(() => {
    if (!user?.id) {
      console.warn("No user ID available for WebSocket connection");
      return;
    }

    const wsClient = getWebSocketClient(user.id);

    const handleConnect = () => {
      setIsConnected(true);
      addNotification({
        type: "success",
        title: "Connected",
        message: "Real-time attendance monitoring active",
      });

      try {
        wsClient.getDeviceStatus();
      } catch (error) {
        console.warn("Failed to get initial device status:", error);
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      addNotification({
        type: "warning",
        title: "Disconnected",
        message: "Real-time updates unavailable. Reconnecting automatically...",
      });
    };

    const handleError = (error: any) => {
      console.error("WebSocket error:", error);
      addNotification({
        type: "error",
        title: "Connection Error",
        message: "WebSocket connection failed. Real-time updates unavailable.",
      });
    };

    const handleRfidScan = (data: any) => {
      if (isDocumentHidden()) return;
      addEvent({
        id: Date.now().toString(),
        type: "rfid_scan",
        rfidUid: data.maskedRfidUid || data.rfidUid,
        timestamp: data.timestamp || new Date().toISOString(),
        deviceId: data.deviceId || "unknown",
        status: "valid",
      });
    };

    const handleSensorTrigger = (data: any) => {
      if (isDocumentHidden()) return;
      addEvent({
        id: Date.now().toString(),
        type: "sensor_trigger",
        sensorType: data.sensorType,
        distance: data.distance,
        timestamp: data.timestamp || new Date().toISOString(),
        deviceId: data.deviceId || "unknown",
        status: data.distance <= 100 ? "valid" : "invalid",
      });
    };

    const handleAttendanceRecord = (data: any) => {
      if (isDocumentHidden()) return;
      addEvent({
        id: Date.now().toString(),
        type: "attendance_record",
        studentId: data.studentId,
        studentName: data.studentName,
        timestamp: data.timestamp || new Date().toISOString(),
        deviceId: data.deviceId || "unknown",
        status: data.isValid ? "valid" : "discrepancy",
      });
      updateStats(data);
      refreshAttendanceDataRef.current();
    };

    const handleDeviceStatus = (data: any) => {
      if (isDocumentHidden()) return;
      if (Array.isArray(data)) {
        setStats((prev) => ({
          ...prev,
          activeDevices: data.filter((d: any) => d.status === "online").length,
        }));
      }
    };

    wsClient.on("connect", handleConnect);
    wsClient.on("disconnect", handleDisconnect);
    wsClient.on("error", handleError);
    wsClient.on("rfidScan", handleRfidScan);
    wsClient.on("sensorTrigger", handleSensorTrigger);
    wsClient.on("attendanceRecord", handleAttendanceRecord);
    wsClient.on("deviceStatus", handleDeviceStatus);

    setIsConnected(wsClient.isConnected());
    wsClient.connect().catch((error) => {
      console.error("Failed to initialize WebSocket:", error);
    });

    const handleVisibilityChange = () => {
      if (isDocumentHidden()) return;
      setIsConnected(wsClient.isConnected());
      try {
        wsClient.getDeviceStatus();
      } catch (error) {
        console.warn("Failed to refresh device status:", error);
      }
      refreshAttendanceDataRef.current();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      try {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        wsClient.off("connect", handleConnect);
        wsClient.off("disconnect", handleDisconnect);
        wsClient.off("error", handleError);
        wsClient.off("rfidScan", handleRfidScan);
        wsClient.off("sensorTrigger", handleSensorTrigger);
        wsClient.off("attendanceRecord", handleAttendanceRecord);
        wsClient.off("deviceStatus", handleDeviceStatus);
      } catch (error) {
        console.warn("Error cleaning up WebSocket listeners:", error);
      }
    };
  }, [user?.id, addNotification]);

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
    if (!rfidInput.trim()) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please enter an RFID card ID",
      });
      return;
    }

    try {
      const response = await api.simulateRFID(rfidInput.trim());

      if (response.success) {
        setRfidInput("");
        addNotification({
          type: "success",
          title: "RFID Simulated",
          message: `RFID scan simulated for card: ${rfidInput.trim()}`,
        });
        refreshAttendanceData();
      } else {
        addNotification({
          type: "error",
          title: "Simulation Failed",
          message: response.message || "RFID simulation failed",
        });
      }
    } catch (error) {
      console.error("Failed to simulate RFID tap:", error);
      addNotification({
        type: "error",
        title: "Simulation Error",
        message: getApiErrorMessage(
          error,
          "Failed to simulate RFID tap. Check your connection.",
        ),
      });
    }
  };

  const simulateSensorTrigger = async (sensorType: "entry" | "exit") => {
    if (sensorSimulationPending) {
      return;
    }

    if (sessions.length === 0) {
      await loadReferenceData();
      addNotification({
        type: "error",
        title: "No Active Session",
        message:
          "Start or activate a class session before simulating entry or exit sensors.",
      });
      return;
    }

    setSensorSimulationPending(sensorType);
    try {
      const response = await api.simulateSensor(sensorType, 50);

      if (response.success) {
        addNotification({
          type: "success",
          title: "Sensor Simulated",
          message: `${
            sensorType.charAt(0).toUpperCase() + sensorType.slice(1)
          } sensor trigger simulated`,
        });
        refreshAttendanceData();
      } else {
        addNotification({
          type: "error",
          title: "Simulation Failed",
          message: response.message || "Sensor simulation failed",
        });
      }
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Failed to simulate sensor trigger. Check your connection.",
      );

      if (message !== "No active class session") {
        console.error("Failed to simulate sensor trigger:", error);
      }

      addNotification({
        type: "error",
        title:
          message === "No active class session"
            ? "No Active Session"
            : "Simulation Error",
        message:
          message === "No active class session"
            ? "Start or activate a class session before simulating entry or exit sensors."
            : message,
      });
    } finally {
      setSensorSimulationPending(null);
    }
  };

  const refreshAttendanceData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filters.dateRange.start) params.set("date", filters.dateRange.start);
      const response = await api.get(`/attendance?${params.toString()}`);
      const raw = (response as any).records ?? (response as any).data;
      if (response.success && Array.isArray(raw)) {
        setAttendanceData(normalizeAttendanceRecords(raw));
      } else {
        setAttendanceData([]);
      }
    } catch (error) {
      console.error("Failed to refresh attendance data:", error);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };

  refreshAttendanceDataRef.current = refreshAttendanceData;

  // Advanced filtering function
  const filteredAttendanceData = attendanceData.filter((record) => {
    // Date range filter
    const recordDate = new Date(record.entryTime || record.createdAt)
      .toISOString()
      .split("T")[0];
    if (
      recordDate < filters.dateRange.start ||
      recordDate > filters.dateRange.end
    ) {
      return false;
    }

    // Status filter
    if (filters.status !== "all") {
      if (filters.status === "present" && record.status !== "present")
        return false;
      if (filters.status === "absent" && record.status !== "absent")
        return false;
      if (filters.status === "late" && record.status !== "late") return false;
    }

    // Student filter
    if (
      filters.studentId &&
      record.student?.id !== parseInt(filters.studentId)
    ) {
      return false;
    }

    // Session filter
    if (
      filters.sessionId &&
      record.classSessionId !== parseInt(filters.sessionId)
    ) {
      return false;
    }

    // Device filter
    if (filters.deviceId && record.deviceId !== filters.deviceId) {
      return false;
    }

    // Search term filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch =
        record.student?.name?.toLowerCase().includes(searchLower) ||
        record.student?.studentId?.toLowerCase().includes(searchLower) ||
        record.student?.email?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Sort value getter (supports nested keys e.g. student.name)
  const getSortValue = (record: any, key: string) => {
    if (key === "student.name") return record.student?.name ?? "";
    if (key === "student.studentId") return record.student?.studentId ?? "";
    return record[key];
  };

  // Sorting function
  const sortedAttendanceData = [...filteredAttendanceData].sort((a, b) => {
    const aValue = getSortValue(a, sortConfig.key);
    const bValue = getSortValue(b, sortConfig.key);

    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Handle sorting
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Bulk operations
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecords(
        new Set(sortedAttendanceData.map((record) => record.id.toString()))
      );
    } else {
      setSelectedRecords(new Set());
    }
  };

  const handleSelectRecord = (recordId: string, checked: boolean) => {
    setSelectedRecords((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(recordId);
      } else {
        newSet.delete(recordId);
      }
      return newSet;
    });
  };

  const handleBulkExcuse = async () => {
    if (selectedRecords.size === 0) return;

    setBulkProcessing(true);
    try {
      const selectedData = sortedAttendanceData.filter((record) =>
        selectedRecords.has(record.id.toString())
      );

      const results = await Promise.allSettled(
        selectedData.map((record) =>
          api.excuseAttendance(record.id, "Bulk excused by administrator")
        )
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failureCount = results.filter(
        (result) => result.status === "rejected"
      ).length;

      addNotification({
        type: "success",
        title: "Bulk Operation Completed",
        message: `Successfully excused ${successCount} students${
          failureCount > 0 ? `, ${failureCount} failed` : ""
        }`,
      });

      setSelectedRecords(new Set());
      refreshAttendanceData();
    } catch (error) {
      console.error("Bulk excuse error:", error);
      addNotification({
        type: "error",
        title: "Bulk Operation Failed",
        message: "Failed to complete bulk excuse operation",
      });
    } finally {
      setBulkProcessing(false);
      setBulkOperation(null);
    }
  };

  const handleBulkContact = async () => {
    if (selectedRecords.size === 0) return;

    setBulkProcessing(true);
    try {
      const selectedData = sortedAttendanceData.filter((record) =>
        selectedRecords.has(record.id.toString())
      );

      const message =
        "This is a bulk notification regarding your child's attendance.";

      const results = await Promise.allSettled(
        selectedData.map((record) =>
          api.contactParent(record.student?.id, message)
        )
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failureCount = results.filter(
        (result) => result.status === "rejected"
      ).length;

      addNotification({
        type: "success",
        title: "Bulk Contact Completed",
        message: `Successfully contacted ${successCount} parents${
          failureCount > 0 ? `, ${failureCount} failed` : ""
        }`,
      });

      setSelectedRecords(new Set());
    } catch (error) {
      console.error("Bulk contact error:", error);
      addNotification({
        type: "error",
        title: "Bulk Operation Failed",
        message: "Failed to complete bulk contact operation",
      });
    } finally {
      setBulkProcessing(false);
      setBulkOperation(null);
    }
  };

  const handleBulkExport = () => {
    if (selectedRecords.size === 0) return;

    const selectedData = sortedAttendanceData.filter((record) =>
      selectedRecords.has(record.id.toString())
    );

    // Convert to CSV
    const csvHeaders = [
      "Student ID",
      "Name",
      "Status",
      "Entry Time",
      "Device",
      "Session",
    ];
    const csvData = selectedData.map((record) => [
      record.student?.studentId || "N/A",
      record.student?.name || "N/A",
      record.status || "N/A",
      record.entryTime ? new Date(record.entryTime).toLocaleString() : "N/A",
      record.deviceId || "N/A",
      record.classSessionId || "N/A",
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `attendance_export_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification({
      type: "success",
      title: "Export Completed",
      message: `Successfully exported ${selectedRecords.size} records`,
    });

    setSelectedRecords(new Set());
    setBulkOperation(null);
  };

  const handleExcuseAttendance = async () => {
    if (!selectedRecord || !excuseReason.trim()) return;

    try {
      const response = await api.excuseAttendance(
        selectedRecord.id,
        excuseReason
      );
      if (response.success) {
        setShowExcuseModal(false);
        setExcuseReason("");
        setSelectedRecord(null);
        refreshAttendanceData();
        addNotification({
          type: "success",
          title: "Student Excused",
          message: "Student has been marked as excused.",
        });
      } else {
        console.error("Failed to excuse attendance:", response.message);
        addNotification({
          type: "error",
          title: "Excuse Failed",
          message: response.message || "Failed to excuse student",
        });
      }
    } catch (error) {
      console.error("Failed to excuse attendance:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to excuse student. Please try again.",
      });
    }
  };

  const handleContactParent = async () => {
    if (!selectedRecord || !contactMessage.trim()) return;

    try {
      const response = await api.contactParent(
        selectedRecord.student?.id,
        contactMessage
      );
      if (response.success) {
        setShowContactModal(false);
        setContactMessage("");
        setSelectedRecord(null);
        addNotification({
          type: "success",
          title: "Parent Contacted",
          message: "Notification sent to student's parent.",
        });
      } else {
        console.error("Failed to contact parent:", response.message);
        addNotification({
          type: "error",
          title: "Contact Failed",
          message: response.message || "Failed to contact parent",
        });
      }
    } catch (error) {
      console.error("Failed to contact parent:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message: "Failed to contact parent. Please try again.",
      });
    }
  };

  const openExcuseModal = (record: any) => {
    setSelectedRecord(record);
    setExcuseReason("");
    setShowExcuseModal(true);
  };

  const openContactModal = (record: any) => {
    setSelectedRecord(record);
    setContactMessage("");
    setShowContactModal(true);
  };


  // Load students and sessions for manual entry and filters
  const loadReferenceData = async () => {
    try {
      const [studentsRes, sessionsRes] = await Promise.all([
        api.getStudents(),
        api.get("/attendance/sessions/active"),
      ]);
      if (studentsRes.success) {
        setStudents(((studentsRes as any).data as any[]) || []);
      }
      // Server returns { success, sessions } (not data.sessions)
      if ((sessionsRes as any).success) {
        const list = (sessionsRes as any).sessions ?? [];
        setSessions(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      console.error("Failed to load manual entry data:", error);
    }
  };

  const hasActiveSessions = sessions.length > 0;

  useEffect(() => {
    if (user) {
      loadReferenceData();
    }
  }, [user?.id]);

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
      // Use the correct API method for manual attendance entry
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
          message:
            response.message ||
            "Failed to record attendance. Manual entry may require backend implementation.",
        });
      }
    } catch (error) {
      console.error("Manual entry error:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to record attendance. Manual entry functionality may not be fully implemented.",
      });
    }
  };

  // Load data when modal opens
  useEffect(() => {
    if (showManualEntry) {
      loadReferenceData();
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
        return event.rfidUid
          ? `RFID card scanned: ${event.rfidUid}`
          : "RFID card scanned";
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
        <div className="space-y-4">
          <div className="flex space-x-4">
            <label htmlFor="attendance-rfid-simulation" className="sr-only">
              RFID card ID for simulation
            </label>
            <input
              id="attendance-rfid-simulation"
              name="rfidSimulationId"
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
              Simulate RFID Tap
            </button>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => simulateSensorTrigger("entry")}
              disabled={sensorSimulationPending !== null || !hasActiveSessions}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 text-white font-medium rounded-lg"
            >
              {sensorSimulationPending === "entry"
                ? "Simulating..."
                : "Simulate Entry Sensor"}
            </button>
            <button
              onClick={() => simulateSensorTrigger("exit")}
              disabled={sensorSimulationPending !== null || !hasActiveSessions}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 text-white font-medium rounded-lg"
            >
              {sensorSimulationPending === "exit"
                ? "Simulating..."
                : "Simulate Exit Sensor"}
            </button>
          </div>
          {!hasActiveSessions && (
            <div className="rounded border border-yellow-700 bg-yellow-900/30 p-3 text-sm text-yellow-100">
              No active class session is available for sensor simulation. Start
              a session from Dashboard or create one in Schedule before using
              the entry and exit sensor buttons.
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-medium text-cyan-400">Filters</h4>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-cyan-400 hover:text-cyan-300 text-sm"
          >
            {showAdvancedFilters ? "Hide Filters" : "Show Advanced Filters"}
          </button>
        </div>

        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="attendance-search" className="block text-sm font-medium text-gray-300 mb-1">
              Search
            </label>
            <input
              id="attendance-search"
              name="searchTerm"
              type="text"
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))
              }
              placeholder="Search by name, ID, or email"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
            />
          </div>
          <div>
            <label htmlFor="attendance-status" className="block text-sm font-medium text-gray-300 mb-1">
              Status
            </label>
            <select
              id="attendance-status"
              name="status"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-300 mb-1">
              Date Range
            </p>
            <div className="flex space-x-2">
              <label htmlFor="attendance-date-start" className="sr-only">
                Attendance start date
              </label>
              <input
                id="attendance-date-start"
                name="dateStart"
                aria-label="Attendance start date"
                type="date"
                value={filters.dateRange.start}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value },
                  }))
                }
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
              <label htmlFor="attendance-date-end" className="sr-only">
                Attendance end date
              </label>
              <input
                id="attendance-date-end"
                name="dateEnd"
                aria-label="Attendance end date"
                type="date"
                value={filters.dateRange.end}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value },
                  }))
                }
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-600">
            <div>
              <label htmlFor="attendance-student-filter" className="block text-sm font-medium text-gray-300 mb-1">
                Student
              </label>
              <select
                id="attendance-student-filter"
                name="studentId"
                value={filters.studentId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, studentId: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="">All Students</option>
                {students.map((student: any) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.studentId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="attendance-session-filter" className="block text-sm font-medium text-gray-300 mb-1">
                Session
              </label>
              <select
                id="attendance-session-filter"
                name="sessionId"
                value={filters.sessionId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, sessionId: e.target.value }))
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
              >
                <option value="">All Sessions</option>
                {sessions.map((session: any) => (
                  <option key={session.session?.id ?? session.id} value={session.session?.id ?? session.id}>
                    {[session.schedule?.subject, session.schedule?.classroom].filter(Boolean).join(" - ") || "Session"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="attendance-device-filter" className="block text-sm font-medium text-gray-300 mb-1">
                Device
              </label>
              <input
                id="attendance-device-filter"
                name="deviceId"
                type="text"
                value={filters.deviceId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, deviceId: e.target.value }))
                }
                placeholder="Device ID"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
              />
            </div>
          </div>
        )}

        {/* Clear Filters */}
        <div className="flex justify-end mt-4">
          <button
            onClick={() =>
              setFilters({
                dateRange: {
                  start: new Date().toISOString().split("T")[0],
                  end: new Date().toISOString().split("T")[0],
                },
                status: "all",
                studentId: "",
                sessionId: "",
                deviceId: "",
                searchTerm: "",
              })
            }
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Bulk Operations */}
      {selectedRecords.size > 0 && (
        <div className="bg-blue-900 border border-blue-600 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-blue-400 font-medium">
                {selectedRecords.size} record
                {selectedRecords.size !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setBulkOperation("excuse")}
                disabled={bulkProcessing}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white text-sm font-medium rounded disabled:cursor-not-allowed"
              >
                Bulk Excuse
              </button>
              <button
                onClick={() => setBulkOperation("contact")}
                disabled={bulkProcessing}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white text-sm font-medium rounded disabled:cursor-not-allowed"
              >
                Bulk Contact
              </button>
              <button
                onClick={() => setBulkOperation("export")}
                disabled={bulkProcessing}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white text-sm font-medium rounded disabled:cursor-not-allowed"
              >
                Export Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Attendance Table */}
      <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-lg font-medium text-cyan-400">
                Live Attendance Table
              </h4>
              <p className="text-sm text-gray-300">
                {sortedAttendanceData.length} record
                {sortedAttendanceData.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                id="attendance-select-all"
                name="selectAllAttendance"
                aria-label="Select all attendance records"
                type="checkbox"
                checked={
                  selectedRecords.size === sortedAttendanceData.length &&
                  sortedAttendanceData.length > 0
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-300">Select All</span>
            </div>
          </div>
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
                    <input
                      type="checkbox"
                      checked={
                        selectedRecords.size === sortedAttendanceData.length &&
                        sortedAttendanceData.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-cyan-400"
                    onClick={() => handleSort("student.name")}
                  >
                    Student{" "}
                    {sortConfig.key === "student.name" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-cyan-400"
                    onClick={() => handleSort("student.studentId")}
                  >
                    Student ID{" "}
                    {sortConfig.key === "student.studentId" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-cyan-400"
                    onClick={() => handleSort("status")}
                  >
                    Status{" "}
                    {sortConfig.key === "status" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-cyan-400"
                    onClick={() => handleSort("entryTime")}
                  >
                    Check-in Time{" "}
                    {sortConfig.key === "entryTime" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
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
                {!loading && sortedAttendanceData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  sortedAttendanceData.map((record: any) => (
                    <tr key={record.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id.toString())}
                          onChange={(e) =>
                            handleSelectRecord(
                              record.id.toString(),
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
                        />
                      </td>
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
                                setLocation(`/students/${record.student?.id}`)
                              }
                              className="text-cyan-400 hover:text-cyan-300"
                            >
                              Monitor
                            </button>
                          )}
                          {record.status === "absent" && (
                            <>
                              <button
                                onClick={() => openExcuseModal(record)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                Excuse
                              </button>
                              <button
                                onClick={() => openContactModal(record)}
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
                <label htmlFor="manual-attendance-student" className="block text-sm font-medium text-gray-300 mb-2">
                  Student
                </label>
                <select
                  id="manual-attendance-student"
                  name="studentId"
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
                <label htmlFor="manual-attendance-session" className="block text-sm font-medium text-gray-300 mb-2">
                  Class Session
                </label>
                <select
                  id="manual-attendance-session"
                  name="classSessionId"
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
                    <option key={session.session?.id ?? session.id} value={session.session?.id ?? session.id}>
                      {[session.schedule?.subject, session.schedule?.classroom].filter(Boolean).join(" - ") || "Session"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="manual-attendance-entry-time" className="block text-sm font-medium text-gray-300 mb-2">
                  Entry Time
                </label>
                <input
                  id="manual-attendance-entry-time"
                  name="entryTime"
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
                <label htmlFor="manual-attendance-notes" className="block text-sm font-medium text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  id="manual-attendance-notes"
                  name="notes"
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

      {/* Excuse Modal */}
      {showExcuseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Excuse Student Absence
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300 mb-2">
                  Student:{" "}
                  <span className="text-white">
                    {selectedRecord?.student?.name}
                  </span>
                </p>
                <label htmlFor="attendance-excuse-reason" className="block text-sm font-medium text-gray-300 mb-2">
                  Reason for Excuse *
                </label>
                <textarea
                  id="attendance-excuse-reason"
                  name="excuseReason"
                  value={excuseReason}
                  onChange={(e) => setExcuseReason(e.target.value)}
                  placeholder="Enter reason for excusing the absence..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowExcuseModal(false);
                  setExcuseReason("");
                  setSelectedRecord(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleExcuseAttendance}
                disabled={!excuseReason.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed"
              >
                Excuse Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Contact Parent
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300 mb-2">
                  Student:{" "}
                  <span className="text-white">
                    {selectedRecord?.student?.name}
                  </span>
                </p>
                <p className="text-sm text-gray-300 mb-2">
                  Parent Email:{" "}
                  <span className="text-white">
                    {selectedRecord?.student?.parentEmail}
                  </span>
                </p>
                <label htmlFor="attendance-contact-message" className="block text-sm font-medium text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  id="attendance-contact-message"
                  name="contactMessage"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Enter message to send to parent..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowContactModal(false);
                  setContactMessage("");
                  setSelectedRecord(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleContactParent}
                disabled={!contactMessage.trim()}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Operation Confirmation Modals */}
      {bulkOperation === "excuse" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Confirm Bulk Excuse
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Are you sure you want to excuse {selectedRecords.size} absent
              student{selectedRecords.size !== 1 ? "s" : ""}? This will mark all
              selected records as excused.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setBulkOperation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkExcuse}
                disabled={bulkProcessing}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed"
              >
                {bulkProcessing ? "Processing..." : "Confirm Bulk Excuse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOperation === "contact" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Confirm Bulk Contact
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Are you sure you want to contact {selectedRecords.size} parent
              {selectedRecords.size !== 1 ? "s" : ""}? This will send a
              notification to all selected students' parents.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setBulkOperation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkContact}
                disabled={bulkProcessing}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:cursor-not-allowed"
              >
                {bulkProcessing ? "Processing..." : "Confirm Bulk Contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOperation === "export" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-medium text-cyan-400 mb-4">
              Confirm Export
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              Export {selectedRecords.size} record
              {selectedRecords.size !== 1 ? "s" : ""} to CSV file?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setBulkOperation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkExport}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Export to CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
