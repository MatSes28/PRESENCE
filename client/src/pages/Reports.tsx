import { useState } from "react";
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
  const [reportParams, setReportParams] = useState<ReportParams>({
    format: "csv",
    type: "attendance",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // 30 days ago
    endDate: new Date().toISOString().split("T")[0], // Today
  });

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await api.generateReport(reportParams);

      if (response.success) {
        // Handle file download
        if (response.data && (response.data as any).downloadUrl) {
          window.open((response.data as any).downloadUrl, "_blank");
          addNotification({
            type: "success",
            title: "Report Generated",
            message: "Your report has been generated and is downloading.",
          });
        } else {
          addNotification({
            type: "success",
            title: "Report Generated",
            message: "Report generated successfully!",
          });
        }
      } else {
        addNotification({
          type: "error",
          title: "Report Generation Failed",
          message: response.message || "Failed to generate report",
        });
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
      <div>
        <h3 className="text-lg font-medium text-white">Attendance Reports</h3>
        <p className="text-sm text-gray-300">
          Generate and download comprehensive attendance reports
        </p>
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
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
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
            <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
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
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs">
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
          <h4 className="text-lg font-medium text-white">Report Preview</h4>
          <p className="text-sm text-gray-300">
            Sample data from the last 24 hours
          </p>
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
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  John Doe
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  2021001
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  08:30 AM
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  10:15 AM
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  1h 45m
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                    Present
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  Jane Smith
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  2021002
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  08:45 AM
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">
                    Late
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">1,247</div>
            <div className="text-sm text-gray-400">Total Records</div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">1,089</div>
            <div className="text-sm text-gray-400">Present</div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">98</div>
            <div className="text-sm text-gray-400">Late</div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">60</div>
            <div className="text-sm text-gray-400">Absent</div>
          </div>
        </div>
      </div>
    </div>
  );
};
