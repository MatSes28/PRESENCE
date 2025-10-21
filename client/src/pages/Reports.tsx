import { useState } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";

interface ReportParams {
  type: "attendance" | "students" | "classroom";
  format: "pdf" | "csv";
  startDate?: string;
  endDate?: string;
  classroomId?: number;
  subjectId?: number;
}

export const Reports = () => {
  const { addNotification } = useNotifications();
  const [generating, setGenerating] = useState(false);
  const [reportParams, setReportParams] = useState<ReportParams>({
    type: "attendance",
    format: "pdf",
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

  const reportTypes = [
    {
      value: "attendance",
      label: "Attendance Report",
      description: "Student attendance records with timestamps",
    },
    {
      value: "students",
      label: "Student Report",
      description: "Student information and RFID assignments",
    },
    {
      value: "classroom",
      label: "Classroom Report",
      description: "Classroom usage and device status",
    },
  ];

  const formatOptions = [
    {
      value: "pdf",
      label: "PDF Document",
      description: "Formatted report document",
    },
    {
      value: "csv",
      label: "CSV Spreadsheet",
      description: "Data export for analysis",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          Reports & Analytics
        </h3>
        <p className="text-sm text-gray-500">
          Generate comprehensive reports and data exports
        </p>
      </div>

      {/* Report Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-medium mb-6">Generate Report</h4>

        <div className="space-y-6">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Report Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reportTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() =>
                    setReportParams({
                      ...reportParams,
                      type: type.value as any,
                    })
                  }
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    reportParams.type === type.value
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={reportParams.type === type.value}
                      onChange={() => {}}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-gray-900">
                        {type.label}
                      </div>
                      <div className="text-sm text-gray-500">
                        {type.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formatOptions.map((format) => (
                <div
                  key={format.value}
                  onClick={() =>
                    setReportParams({
                      ...reportParams,
                      format: format.value as any,
                    })
                  }
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    reportParams.format === format.value
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      checked={reportParams.format === format.value}
                      onChange={() => {}}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div className="ml-3">
                      <div className="font-medium text-gray-900">
                        {format.label}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={reportParams.endDate}
                onChange={(e) =>
                  setReportParams({ ...reportParams, endDate: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Additional Filters */}
          {(reportParams.type === "attendance" ||
            reportParams.type === "classroom") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classroom ID (Optional)
                </label>
                <input
                  type="number"
                  value={reportParams.classroomId || ""}
                  onChange={(e) =>
                    setReportParams({
                      ...reportParams,
                      classroomId: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Filter by classroom"
                />
              </div>
              {reportParams.type === "attendance" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject ID (Optional)
                  </label>
                  <input
                    type="number"
                    value={reportParams.subjectId || ""}
                    onChange={(e) =>
                      setReportParams({
                        ...reportParams,
                        subjectId: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Filter by subject"
                  />
                </div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-6 py-3 rounded-md text-sm font-medium flex items-center space-x-2"
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
          </div>
        </div>
      </div>

      {/* Quick Reports */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-medium mb-4">Quick Reports</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() =>
              setReportParams({
                type: "attendance",
                format: "pdf",
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
              })
            }
            className="p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
          >
            <div className="font-medium text-gray-900">📅 This Week</div>
            <div className="text-sm text-gray-500">
              Attendance report for the current week
            </div>
          </button>

          <button
            onClick={() =>
              setReportParams({
                type: "students",
                format: "csv",
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
              })
            }
            className="p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
          >
            <div className="font-medium text-gray-900">👥 Student List</div>
            <div className="text-sm text-gray-500">
              Complete student roster with RFID status
            </div>
          </button>

          <button
            onClick={() =>
              setReportParams({
                type: "classroom",
                format: "pdf",
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0],
                endDate: new Date().toISOString().split("T")[0],
              })
            }
            className="p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors text-left"
          >
            <div className="font-medium text-gray-900">🏫 Room Usage</div>
            <div className="text-sm text-gray-500">
              Classroom utilization and device status
            </div>
          </button>
        </div>
      </div>

      {/* Report History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-medium mb-4">Recent Reports</h4>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📄</div>
          <p className="text-gray-500">Report history will be available here</p>
          <p className="text-sm text-gray-400 mt-2">
            Generated reports will appear in this section for easy access
          </p>
        </div>
      </div>
    </div>
  );
};
