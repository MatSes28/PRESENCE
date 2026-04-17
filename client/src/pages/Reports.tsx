import { useMemo, useState, useEffect } from "react";
import { useNotifications } from "../components/NotificationSystem";
import { useAuth } from "../hooks/useAuth";

const getFilenameFromDisposition = (disposition: string | null) => {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  }

  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? null;
};

const triggerReportDownload = async (payload: any, filenameBase?: string) => {
  const response = await fetch("/api/reports/generate-report", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const errorData = contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() };
    throw new Error(errorData.message || "Failed to generate report");
  }

  if (
    contentType.includes("text/csv") ||
    contentType.includes("application/pdf") ||
    contentType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
  ) {
    const blob = await response.blob();
    const format = contentType.includes("application/pdf")
      ? "pdf"
      : contentType.includes("spreadsheetml")
        ? "xlsx"
        : "csv";
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const baseName = filenameBase || `${payload.type}_report`;
    anchor.download =
      getFilenameFromDisposition(response.headers.get("content-disposition")) ||
      `${baseName}_${new Date().toISOString().split("T")[0]}.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
    return { success: true, format };
  }

  return response.json();
};

interface ReportParams {
  format: "csv" | "xlsx" | "pdf";
  startDate?: string;
  endDate?: string;
  subjectId?: number;
  classroomId?: number;
  type: "attendance" | "students" | "classroom";
}

interface SummaryItem {
  label: string;
  value: string;
}

const reportTypeLabels: Record<ReportParams["type"], string> = {
  attendance: "Attendance Report",
  students: "Student Report",
  classroom: "Classroom Report",
};

const fallbackPreviewColumns: Record<ReportParams["type"], string[]> = {
  attendance: [
    "Student Name",
    "Student ID",
    "Subject",
    "Status",
    "Entry Time",
    "Exit Time",
    "Recorded At",
  ],
  students: [
    "Student Name",
    "Student ID",
    "Email",
    "Program",
    "Year",
    "Section",
    "Active Enrollments",
    "Status",
  ],
  classroom: [
    "Session ID",
    "Date",
    "Status",
    "Subject",
    "Class Section",
    "Attendance Records",
    "Present",
    "Presence Rate",
  ],
};

const formatDateLabel = (value?: string) => {
  if (!value) return "Any date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const Reports = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [reportParams, setReportParams] = useState<ReportParams>({
    format: "xlsx",
    type: "attendance",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // 30 days ago
    endDate: new Date().toISOString().split("T")[0], // Today
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [realTimeStats, setRealTimeStats] = useState({
    todayPresent: 0,
    todayAbsent: 0,
    todayLate: 0,
    activeSessions: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);

  const previewColumns =
    previewData.length > 0
      ? Object.keys(previewData[0])
      : fallbackPreviewColumns[reportParams.type];
  const selectedSubject = subjects.find(
    (subject) => subject.id === reportParams.subjectId,
  );
  const selectedClassroom = classrooms.find(
    (classroom) => classroom.id === reportParams.classroomId,
  );
  const overviewCards = useMemo(
    () =>
      summary.length > 0
        ? summary.slice(0, 4)
        : [
            { label: "Rows", value: pagination.total.toLocaleString() },
            { label: "Preview", value: previewData.length.toLocaleString() },
            { label: "Format", value: reportParams.format.toUpperCase() },
            { label: "Auto-refresh", value: autoRefresh ? "On" : "Off" },
          ],
    [
      autoRefresh,
      pagination.total,
      previewData.length,
      reportParams.format,
      summary,
    ],
  );
  const exportContext = [
    reportTypeLabels[reportParams.type],
    `${formatDateLabel(reportParams.startDate)} to ${formatDateLabel(
      reportParams.endDate,
    )}`,
    selectedSubject
      ? `${selectedSubject.code} - ${selectedSubject.name}`
      : "All Subjects",
    selectedClassroom
      ? `${selectedClassroom.name} - ${selectedClassroom.location}`
      : "All Sections",
  ].join(" | ");
  const exportFormatLabel =
    reportParams.format === "csv"
      ? "Raw CSV"
      : reportParams.format === "xlsx"
        ? "Styled Excel"
        : "PDF";

  useEffect(() => {
    loadRealTimeStats();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadPreviewData(1);
  }, [
    reportParams.type,
    reportParams.startDate,
    reportParams.endDate,
    reportParams.subjectId,
    reportParams.classroomId,
  ]);

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadPreviewData();
        loadRealTimeStats();
        setLastUpdated(new Date());
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadPreviewData = async (page = pagination.page) => {
    setPreviewLoading(true);
    try {
      const offset = (page - 1) * pagination.limit;
      const queryParams = new URLSearchParams({
        type: reportParams.type,
        limit: pagination.limit.toString(),
        offset: offset.toString(),
      });
      if (reportParams.startDate)
        queryParams.set("startDate", reportParams.startDate);
      if (reportParams.endDate)
        queryParams.set("endDate", reportParams.endDate);
      if (reportParams.subjectId)
        queryParams.set("subjectId", reportParams.subjectId.toString());
      if (reportParams.classroomId)
        queryParams.set("classroomId", reportParams.classroomId.toString());

      const response = await fetch(`/api/reports/preview?${queryParams}`, {
        credentials: "include",
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setPreviewData(data.data);
        setSummary(Array.isArray(data.summary) ? data.summary : []);
        setPagination((prev) => ({
          ...prev,
          page,
          total: typeof data.total === "number" ? data.total : data.data.length,
        }));
      } else {
        setPreviewData([]);
        setSummary([]);
        setPagination((prev) => ({ ...prev, page, total: 0 }));
      }
    } catch (error) {
      console.error("Failed to load preview data:", error);
      addNotification({
        type: "error",
        title: "Preview Error",
        message: "Failed to load report preview. Please check your connection.",
      });
      setPreviewData([]);
      setSummary([]);
      setPagination((prev) => ({ ...prev, total: 0 }));
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadRealTimeStats = async () => {
    try {
      const response = await fetch("/api/reports/real-time-stats", {
        credentials: "include",
      });

      const data = await response.json();

      if (data.success && data.data && typeof data.data === "object") {
        setRealTimeStats({
          todayPresent: Number(data.data.todayPresent) ?? 0,
          todayAbsent: Number(data.data.todayAbsent) ?? 0,
          todayLate: Number(data.data.todayLate) ?? 0,
          activeSessions: Number(data.data.activeSessions) ?? 0,
        });
      } else {
        setRealTimeStats({
          todayPresent: 0,
          todayAbsent: 0,
          todayLate: 0,
          activeSessions: 0,
        });
      }
    } catch (error) {
      console.error("Failed to load real-time stats:", error);
      setRealTimeStats({
        todayPresent: 0,
        todayAbsent: 0,
        todayLate: 0,
        activeSessions: 0,
      });
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Load subjects
      const subjectsResponse = await fetch("/api/subjects", {
        credentials: "include",
      });
      const subjectsData = await subjectsResponse.json();
      const subjectsRaw = (subjectsData as any)?.data;
      setSubjects(Array.isArray(subjectsRaw) ? subjectsRaw : []);

      const classroomsResponse = await fetch("/api/classrooms", {
        credentials: "include",
      });
      const classroomsData = await classroomsResponse.json();
      const classroomsRaw = (classroomsData as any)?.data;
      setClassrooms(Array.isArray(classroomsRaw) ? classroomsRaw : []);
    } catch (error) {
      console.error("Failed to load filter options:", error);
      setSubjects([]);
      setClassrooms([]);
    }
  };

  const handleQuickReport = async (type: "daily" | "weekly" | "analytics") => {
    setGenerating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      let startDate = today;
      const endDate = today;

      if (type === "weekly") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString().split("T")[0];
      } else if (type === "analytics") {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString().split("T")[0];
      }

      const downloadName = `${type}_report`;
      await triggerReportDownload(
        {
          type: "attendance",
          format: "xlsx",
          startDate,
          endDate,
          quickReportType: type,
        },
        downloadName,
      );

      addNotification({
        type: "success",
        title: "Report Generated",
        message: `${
          type.charAt(0).toUpperCase() + type.slice(1)
        } report has been downloaded successfully.`,
      });
    } catch (error) {
      console.error("Failed to generate quick report:", error);
      addNotification({
        type: "error",
        title: "Report Generation Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate report. Please check your connection and try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateReport = async (formatOverride?: "csv" | "xlsx" | "pdf") => {
    const format = formatOverride ?? reportParams.format;
    setGenerating(true);
    try {
      const payload = { ...reportParams, format };
      await triggerReportDownload(payload);

      addNotification({
        type: "success",
        title:
          format === "pdf"
            ? "PDF Exported"
            : format === "xlsx"
              ? "Excel Exported"
              : "Report Exported",
        message:
          format === "pdf"
            ? "Your PDF report has been downloaded."
            : format === "xlsx"
              ? "Your styled Excel workbook has been downloaded."
              : "Your CSV report has been downloaded.",
      });
    } catch (error) {
      console.error("Failed to generate report:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate report. Please check your connection and try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSeedDemoData = async () => {
    setSeedingDemo(true);
    try {
      const response = await fetch("/api/reports/seed-demo-data", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to seed demo data");
      }

      await Promise.all([
        loadFilterOptions(),
        loadPreviewData(1),
        loadRealTimeStats(),
      ]);

      addNotification({
        type: "success",
        title: "Demo Data Ready",
        message:
          "Reports now have realistic students, sessions, and attendance records.",
      });
    } catch (error) {
      console.error("Failed to seed demo data:", error);
      addNotification({
        type: "error",
        title: "Demo Seed Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to seed demo report data.",
      });
    } finally {
      setSeedingDemo(false);
    }
  };

  const renderStatus = (value: string) => {
    const normalized = String(value || "").toLowerCase();
    const tone =
      normalized === "present" ||
      normalized === "active" ||
      normalized === "completed"
        ? "bg-green-900 text-green-300"
        : normalized === "late" || normalized === "scheduled"
          ? "bg-yellow-900 text-yellow-300"
          : "bg-red-900 text-red-300";

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tone}`}
      >
        {value || "Unknown"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-medium text-white">Attendance Reports</h3>
          <p className="text-sm text-gray-300">
            Generate and download comprehensive attendance reports
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === "admin" && (
            <button
              onClick={handleSeedDemoData}
              disabled={seedingDemo}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-2 rounded text-sm font-medium"
            >
              {seedingDemo ? "Seeding..." : "Seed Demo Data"}
            </button>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
            />
            <label htmlFor="auto-refresh" className="text-sm text-gray-300">
              Auto-refresh (30s)
            </label>
          </div>
          <div className="text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Real-time Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="text-2xl mr-3">📊</div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                Today's Present
              </p>
              <p className="text-2xl font-bold text-green-400">
                {realTimeStats.todayPresent.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="text-2xl mr-3">⏰</div>
            <div>
              <p className="text-sm font-medium text-gray-300">Today's Late</p>
              <p className="text-2xl font-bold text-yellow-400">
                {realTimeStats.todayLate.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="text-2xl mr-3">❌</div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                Today's Absent
              </p>
              <p className="text-2xl font-bold text-red-400">
                {realTimeStats.todayAbsent.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center">
            <div className="text-2xl mr-3">🏫</div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                Active Sessions
              </p>
              <p className="text-2xl font-bold text-cyan-400">
                {realTimeStats.activeSessions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">Daily Report</h4>
              <p className="text-xs text-gray-400">
                Today's attendance summary
              </p>
            </div>
            <button
              onClick={() => handleQuickReport("daily")}
              disabled={generating}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-3 py-1 rounded text-xs"
            >
              Download
            </button>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">Weekly Report</h4>
              <p className="text-xs text-gray-400">
                This week's attendance trends
              </p>
            </div>
            <button
              onClick={() => handleQuickReport("weekly")}
              disabled={generating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-3 py-1 rounded text-xs"
            >
              Download
            </button>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">
                Analytics Report
              </h4>
              <p className="text-xs text-gray-400">
                Detailed attendance analytics
              </p>
            </div>
            <button
              onClick={() => handleQuickReport("analytics")}
              disabled={generating}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-3 py-1 rounded text-xs"
            >
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">Report Filters</h4>
        <div className="mb-4 rounded-md border border-gray-700 bg-gray-900/50 p-3">
          <p className="text-sm text-gray-300">{exportContext}</p>
          <p className="text-xs text-gray-500 mt-1">
            Report includes {pagination.total.toLocaleString()} records from{" "}
            {formatDateLabel(reportParams.startDate)} to{" "}
            {formatDateLabel(reportParams.endDate)}. Selected export:{" "}
            {exportFormatLabel}. Previewing {previewData.length.toLocaleString()} rows.
          </p>
        </div>
        <div className="space-y-6">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="report-date-range"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Date Range
              </label>
              <select
                id="report-date-range"
                name="dateRangePreset"
                value="custom"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "today") {
                    const today = new Date().toISOString().split("T")[0];
                    setReportParams({
                      ...reportParams,
                      startDate: today,
                      endDate: today,
                    });
                  } else if (value === "week") {
                    const weekAgo = new Date(
                      Date.now() - 7 * 24 * 60 * 60 * 1000,
                    )
                      .toISOString()
                      .split("T")[0];
                    const today = new Date().toISOString().split("T")[0];
                    setReportParams({
                      ...reportParams,
                      startDate: weekAgo,
                      endDate: today,
                    });
                  } else if (value === "month") {
                    const monthAgo = new Date(
                      Date.now() - 30 * 24 * 60 * 60 * 1000,
                    )
                      .toISOString()
                      .split("T")[0];
                    const today = new Date().toISOString().split("T")[0];
                    setReportParams({
                      ...reportParams,
                      startDate: monthAgo,
                      endDate: today,
                    });
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="report-start-date"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Start Date
              </label>
              <input
                id="report-start-date"
                name="startDate"
                type="date"
                value={reportParams.startDate}
                onChange={(e) =>
                  setReportParams({
                    ...reportParams,
                    startDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label
                htmlFor="report-end-date"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                End Date
              </label>
              <input
                id="report-end-date"
                name="endDate"
                type="date"
                value={reportParams.endDate}
                onChange={(e) =>
                  setReportParams({ ...reportParams, endDate: e.target.value })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="report-subject"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Subject
              </label>
              <select
                id="report-subject"
                name="subjectId"
                value={reportParams.subjectId || ""}
                onChange={(e) =>
                  setReportParams({
                    ...reportParams,
                    subjectId: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} - {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="report-classroom"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Class Section
              </label>
              <select
                id="report-classroom"
                name="classroomId"
                value={reportParams.classroomId || ""}
                onChange={(e) =>
                  setReportParams({
                    ...reportParams,
                    classroomId: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All Sections</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name} - {classroom.location}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="report-type"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Report Type
              </label>
              <select
                id="report-type"
                name="type"
                value={reportParams.type}
                onChange={(e) =>
                  setReportParams({
                    ...reportParams,
                    type: e.target.value as
                      | "attendance"
                      | "students"
                      | "classroom",
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="attendance">Attendance Report</option>
                <option value="students">Student Report</option>
                <option value="classroom">Classroom Report</option>
              </select>
            </div>
          </div>

          {/* Generate Report & Export (real API, no mock) */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <button
              onClick={() => handleGenerateReport()}
              disabled={generating}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-6 py-3 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>📊</span>
                  <span>Generate Report</span>
                </>
              )}
            </button>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setReportParams((p) => ({ ...p, format: "csv" }));
                  handleGenerateReport("csv");
                }}
                disabled={generating}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  reportParams.format === "csv"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                Raw CSV
              </button>
              <button
                onClick={() => {
                  setReportParams((p) => ({ ...p, format: "xlsx" }));
                  handleGenerateReport("xlsx");
                }}
                disabled={generating}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  reportParams.format === "xlsx"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                Styled Excel
              </button>
              <button
                onClick={() => {
                  setReportParams((p) => ({ ...p, format: "pdf" }));
                  handleGenerateReport("pdf");
                }}
                disabled={generating}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  reportParams.format === "pdf"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                PDF
              </button>
            </div>
          </div>
          {pagination.total === 0 && !previewLoading && (
            <div className="rounded-md border border-yellow-800 bg-yellow-950/40 p-4 text-sm text-yellow-100">
              No rows match these filters yet. Seed demo data or adjust the date,
              subject, or class section before exporting.
              {reportParams.type === "attendance" &&
                " Try All Subjects or a wider date range if you expected attendance records."}
            </div>
          )}
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="bg-gray-800 rounded-lg shadow border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-medium text-white">
                Live Report Preview
              </h4>
              <p className="text-sm text-gray-300">
                {reportTypeLabels[reportParams.type]} with{" "}
                {pagination.total.toLocaleString()} matching rows
                {autoRefresh && (
                  <span className="ml-2 text-cyan-400">• Auto-refreshing</span>
                )}
              </p>
            </div>
            <button
              onClick={() => {
                loadPreviewData();
                loadRealTimeStats();
                setLastUpdated(new Date());
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-medium flex items-center space-x-1"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                {previewColumns.map((column) => (
                  <th
                    key={column}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {previewLoading ? (
                <tr>
                  <td
                    colSpan={previewColumns.length}
                    className="px-6 py-10 text-center text-sm text-gray-400"
                  >
                    Loading preview...
                  </td>
                </tr>
              ) : previewData.length === 0 ? (
                <tr>
                  <td
                    colSpan={previewColumns.length}
                    className="px-6 py-10 text-center text-sm text-gray-400"
                  >
                    No preview rows available for the selected filters.
                  </td>
                </tr>
              ) : (
                previewData.map((record, index) => (
                  <tr
                    key={`${record["Session ID"] || record["Student ID"] || "row"}-${index}`}
                  >
                    {previewColumns.map((column) => (
                      <td
                        key={column}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
                      >
                        {column === "Status"
                          ? renderStatus(record[column])
                          : record[column] || "-"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const newPage = pagination.page - 1;
                setPagination((prev) => ({ ...prev, page: newPage }));
                loadPreviewData(newPage);
              }}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {pagination.page} of{" "}
              {Math.ceil(pagination.total / pagination.limit)}
            </span>
            <button
              onClick={() => {
                const newPage = pagination.page + 1;
                setPagination((prev) => ({ ...prev, page: newPage }));
                loadPreviewData(newPage);
              }}
              disabled={
                pagination.page >=
                Math.ceil(pagination.total / pagination.limit)
              }
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((item) => (
          <div
            key={item.label}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{item.value}</div>
              <div className="text-sm text-gray-400">{item.label}</div>
              <div className="text-xs text-gray-500 mt-1">
                Selected filters
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">
          Export Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm font-medium text-white mb-1">Raw CSV</div>
            <div className="text-sm text-gray-400">
              Plain data for imports, scripts, and database checks.
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-white mb-1">
              Styled Excel
            </div>
            <div className="text-sm text-gray-400">
              Formatted spreadsheet with borders, filters, and summary rows.
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-white mb-1">PDF</div>
            <div className="text-sm text-gray-400">
              Print-ready summary for sharing and filing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
