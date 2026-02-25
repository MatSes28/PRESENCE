import { useState, useEffect } from "react";
import { useNotifications } from "../components/NotificationSystem";

interface ReportParams {
  format: "csv" | "pdf";
  startDate?: string;
  endDate?: string;
  subjectId?: number;
  classroomId?: number;
  type: "attendance" | "students" | "classroom";
}

export const Reports = () => {
  const { addNotification } = useNotifications();
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    present: 0,
    late: 0,
    absent: 0,
  });
  const [reportParams, setReportParams] = useState<ReportParams>({
    format: "csv",
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

  useEffect(() => {
    loadPreviewData();
    loadRealTimeStats();
    loadFilterOptions();
  }, []);

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
    try {
      const offset = (page - 1) * pagination.limit;
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: offset.toString(),
      });
      if (reportParams.startDate) queryParams.set("startDate", reportParams.startDate);
      if (reportParams.endDate) queryParams.set("endDate", reportParams.endDate);
      if (reportParams.subjectId) queryParams.set("subjectId", reportParams.subjectId.toString());

      const response = await fetch(
        `/api/reports/attendance-records?${queryParams}`,
        { credentials: "include" },
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setPreviewData(data.data);
        calculateStatistics(data.data);
        setPagination((prev) => ({
          ...prev,
          page,
          total: typeof data.total === "number" ? data.total : data.data.length,
        }));
      } else {
        setPreviewData([]);
        setStatistics({ totalRecords: 0, present: 0, late: 0, absent: 0 });
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
      setStatistics({ totalRecords: 0, present: 0, late: 0, absent: 0 });
      setPagination((prev) => ({ ...prev, total: 0 }));
    }
  };

  const calculateStatistics = (records: any[]) => {
    if (!Array.isArray(records)) return;
    const stats = {
      totalRecords: records.length,
      present: records.filter((r) => r?.record?.status === "present").length,
      late: records.filter((r) => r?.record?.status === "late").length,
      absent: records.filter((r) => r?.record?.status === "absent").length,
    };
    setStatistics(stats);
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

      const response = await fetch("/api/reports/generate-report", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "attendance",
          format: "csv",
          startDate,
          endDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification({
          type: "success",
          title: "Report Generated",
          message: `${
            type.charAt(0).toUpperCase() + type.slice(1)
          } report has been generated successfully.`,
        });
      } else {
        addNotification({
          type: "error",
          title: "Report Generation Failed",
          message:
            data.message || "Failed to generate report. Please try again.",
        });
      }
    } catch (error) {
      console.error("Failed to generate quick report:", error);
      addNotification({
        type: "error",
        title: "Report Generation Failed",
        message:
          "Failed to generate report. Please check your connection and try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateReport = async (formatOverride?: "csv" | "pdf") => {
    const format = formatOverride ?? reportParams.format;
    setGenerating(true);
    try {
      const payload = { ...reportParams, format };
      if (format === "csv") {
        const response = await fetch("/api/reports/generate-report", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          // Handle CSV file download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `attendance_report_${new Date().toISOString().split("T")[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          addNotification({
            type: "success",
            title: "Report Exported",
            message: "Your CSV report has been downloaded.",
          });
        } else {
          const data = await response.json();
          addNotification({
            type: "error",
            title: "Export Failed",
            message: data.message || "Failed to export report",
          });
        }
      } else {
        const response = await fetch("/api/reports/generate-report", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.success) {
          addNotification({
            type: "success",
            title: "Report Generated",
            message: "Your report has been generated successfully.",
          });
        } else {
          addNotification({
            type: "error",
            title: "Report Generation Failed",
            message: data.message || "Failed to generate report",
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
      addNotification({
        type: "error",
        title: "Network Error",
        message:
          "Failed to generate report. Please check your connection and try again.",
      });
    } finally {
      setGenerating(false);
    }
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
        <div className="flex items-center space-x-4">
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
        <div className="space-y-6">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date Range
              </label>
              <select
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start Date
              </label>
              <input
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                End Date
              </label>
              <input
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Subject
              </label>
              <select
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Class Section
              </label>
              <select
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Report Type
              </label>
              <select
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
                CSV / Excel
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
                Real-time attendance data with {statistics.totalRecords} records
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Student ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Check-out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {previewData.map((record, index) => (
                <tr key={record?.record?.id ?? index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {record?.student?.name ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record?.student?.studentId ?? "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record?.record?.entryTime
                      ? new Date(record.record.entryTime).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record?.record?.exitTime
                      ? new Date(record.record.exitTime).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record?.record?.entryTime && record?.record?.exitTime
                      ? (() => {
                          const entry = new Date(record.record.entryTime);
                          const exit = new Date(record.record.exitTime);
                          const diffMs = exit.getTime() - entry.getTime();
                          const hours = Math.floor(diffMs / (1000 * 60 * 60));
                          const minutes = Math.floor(
                            (diffMs % (1000 * 60 * 60)) / (1000 * 60),
                          );
                          return `${hours}h ${minutes}m`;
                        })()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record?.record?.status === "present"
                          ? "bg-green-900 text-green-300"
                          : record?.record?.status === "late"
                            ? "bg-yellow-900 text-yellow-300"
                            : "bg-red-900 text-red-300"
                      }`}
                    >
                      {record?.record?.status === "present"
                        ? "Present"
                        : record?.record?.status === "late"
                          ? "Late"
                          : "Absent"}
                    </span>
                  </td>
                </tr>
              ))}
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
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {statistics.totalRecords.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Total Records</div>
            <div className="text-xs text-gray-500 mt-1">Preview Data</div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {statistics.present.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Present</div>
            <div className="text-xs text-gray-500 mt-1">
              {statistics.totalRecords > 0
                ? `${(
                    (statistics.present / statistics.totalRecords) *
                    100
                  ).toFixed(1)}%`
                : "0%"}
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {statistics.late.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Late</div>
            <div className="text-xs text-gray-500 mt-1">
              {statistics.totalRecords > 0
                ? `${(
                    (statistics.late / statistics.totalRecords) *
                    100
                  ).toFixed(1)}%`
                : "0%"}
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {statistics.absent.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Absent</div>
            <div className="text-xs text-gray-500 mt-1">
              {statistics.totalRecords > 0
                ? `${(
                    (statistics.absent / statistics.totalRecords) *
                    100
                  ).toFixed(1)}%`
                : "0%"}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Rate Trend */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">
          Attendance Overview
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-cyan-400 mb-2">
              {statistics.totalRecords > 0
                ? `${(
                    ((statistics.present + statistics.late) /
                      statistics.totalRecords) *
                    100
                  ).toFixed(1)}%`
                : "0%"}
            </div>
            <div className="text-sm text-gray-400">Overall Attendance Rate</div>
            <div className="text-xs text-gray-500 mt-1">
              Present + Late / Total
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {realTimeStats.todayPresent + realTimeStats.todayLate}
            </div>
            <div className="text-sm text-gray-400">Today's Active Students</div>
            <div className="text-xs text-gray-500 mt-1">
              Present + Late Today
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">
              {realTimeStats.activeSessions}
            </div>
            <div className="text-sm text-gray-400">Active Sessions</div>
            <div className="text-xs text-gray-500 mt-1">Currently Running</div>
          </div>
        </div>
      </div>
    </div>
  );
};
