import { useState, useEffect } from "react";
import { api } from "../lib/api";
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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadPreviewData();
    loadRealTimeStats();
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

  const loadPreviewData = async () => {
    try {
      setLoading(true);

      // Report generation requires backend implementation
      // For now, show empty state with proper messaging
      console.log(
        "Report preview data loading - backend implementation required"
      );

      addNotification({
        type: "info",
        title: "Preview Unavailable",
        message:
          "Report preview requires backend implementation. Showing empty state.",
      });

      // Set empty data since backend methods don't exist yet
      setPreviewData([]);
      setStatistics({
        totalRecords: 0,
        present: 0,
        late: 0,
        absent: 0,
      });
    } catch (error) {
      console.error("Failed to load preview data:", error);
      addNotification({
        type: "error",
        title: "Preview Error",
        message:
          "Failed to load report preview. Backend implementation required.",
      });
      setPreviewData([]);
      setStatistics({
        totalRecords: 0,
        present: 0,
        late: 0,
        absent: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (records: any[]) => {
    const stats = {
      totalRecords: records.length,
      present: records.filter((r) => r.record.status === "present").length,
      late: records.filter((r) => r.record.status === "late").length,
      absent: records.filter((r) => r.record.status === "absent").length,
    };
    setStatistics(stats);
  };

  const loadRealTimeStats = async () => {
    try {
      // Real-time stats require backend implementation
      // For now, show placeholder data
      console.log("Real-time stats loading - backend implementation required");

      // Set placeholder stats since backend methods don't exist yet
      setRealTimeStats({
        todayPresent: 0,
        todayAbsent: 0,
        todayLate: 0,
        activeSessions: 0,
      });
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

  const handleQuickReport = async (type: "daily" | "weekly" | "analytics") => {
    setGenerating(true);
    try {
      // Report generation requires backend implementation
      console.log(
        `Attempting to generate ${type} report - backend implementation required`
      );

      addNotification({
        type: "warning",
        title: "Report Generation Unavailable",
        message: `Report generation requires backend implementation. ${
          type.charAt(0).toUpperCase() + type.slice(1)
        } report cannot be generated at this time.`,
      });
    } catch (error) {
      console.error("Failed to generate quick report:", error);
      addNotification({
        type: "error",
        title: "Report Generation Failed",
        message:
          "Report generation requires backend implementation. Please contact administrator.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      // Report generation requires backend implementation
      console.log(
        "Attempting to generate report - backend implementation required"
      );

      addNotification({
        type: "warning",
        title: "Report Generation Unavailable",
        message:
          "Report generation requires backend implementation. Please contact administrator.",
      });
    } catch (error) {
      console.error("Failed to generate report:", error);
      addNotification({
        type: "error",
        title: "Report Generation Failed",
        message:
          "Report generation requires backend implementation. Please contact administrator.",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-yellow-400 text-lg">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-400">
              Report Generation Not Available
            </h3>
            <p className="text-sm text-yellow-200 mt-1">
              Report generation and download functionality requires backend
              implementation. Currently showing preview data only.
            </p>
          </div>
        </div>
      </div>

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
                      Date.now() - 7 * 24 * 60 * 60 * 1000
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
                      Date.now() - 30 * 24 * 60 * 60 * 1000
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
                <option value="1">CS101 - Introduction to Programming</option>
                <option value="2">CS102 - Data Structures</option>
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
                <option value="1">Section A</option>
                <option value="2">Section B</option>
                <option value="3">Section C</option>
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

          {/* Generate Report Button */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleGenerateReport}
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
                onClick={() =>
                  setReportParams({ ...reportParams, format: "csv" })
                }
                className={`px-4 py-2 rounded text-sm font-medium ${
                  reportParams.format === "csv"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                Excel (XLSX)
              </button>
              <button
                onClick={() =>
                  setReportParams({ ...reportParams, format: "pdf" })
                }
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
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {record.student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record.student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record.record.entryTime
                      ? new Date(record.record.entryTime).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record.record.exitTime
                      ? new Date(record.record.exitTime).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {record.record.entryTime && record.record.exitTime
                      ? (() => {
                          const entry = new Date(record.record.entryTime);
                          const exit = new Date(record.record.exitTime);
                          const diffMs = exit.getTime() - entry.getTime();
                          const hours = Math.floor(diffMs / (1000 * 60 * 60));
                          const minutes = Math.floor(
                            (diffMs % (1000 * 60 * 60)) / (1000 * 60)
                          );
                          return `${hours}h ${minutes}m`;
                        })()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.record.status === "present"
                          ? "bg-green-900 text-green-300"
                          : record.record.status === "late"
                          ? "bg-yellow-900 text-yellow-300"
                          : "bg-red-900 text-red-300"
                      }`}
                    >
                      {record.record.status === "present"
                        ? "Present"
                        : record.record.status === "late"
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
