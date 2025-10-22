import { useState } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";

interface ReportParams {
  format: "csv";
  startDate?: string;
  endDate?: string;
  subjectId?: number;
}

export const Reports = () => {
  const { addNotification } = useNotifications();
  const [generating, setGenerating] = useState(false);
  const [reportParams, setReportParams] = useState<ReportParams>({
    format: "csv",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // 30 days ago
    endDate: new Date().toISOString().split("T")[0], // Today
  });

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await api.generateReport({
        type: "attendance",
        ...reportParams,
      });

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
          Attendance Reports
        </h3>
        <p className="text-sm text-gray-500">
          Download attendance reports with timestamps and entry/exit status
        </p>
      </div>

      {/* Report Configuration */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
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

          {/* Subject Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject Filter
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

          {/* Download Button */}
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
                  <span>Download CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
