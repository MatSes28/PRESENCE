import type { Dispatch, SetStateAction } from "react";
import type {
  ClassroomOption,
  ReportDatePreset,
  ReportParams,
  SubjectOption,
} from "./types";

interface ReportFiltersProps {
  datePreset: ReportDatePreset;
  reportParams: ReportParams;
  subjects: SubjectOption[];
  classrooms: ClassroomOption[];
  validationMessage: string;
  previewColumns: string[];
  selectedExportColumns: string[];
  emailReport: boolean;
  generating: boolean;
  paginationTotal: number;
  previewLoading: boolean;
  setDatePreset: Dispatch<SetStateAction<ReportDatePreset>>;
  setReportParams: Dispatch<SetStateAction<ReportParams>>;
  setSelectedColumns: Dispatch<SetStateAction<string[]>>;
  setEmailReport: Dispatch<SetStateAction<boolean>>;
  toggleColumn: (column: string) => void;
  handleGenerateReport: (
    formatOverride?: "csv" | "xlsx" | "pdf",
  ) => Promise<void>;
}

export const ReportFilters = ({
  datePreset,
  reportParams,
  subjects,
  classrooms,
  validationMessage,
  previewColumns,
  selectedExportColumns,
  emailReport,
  generating,
  paginationTotal,
  previewLoading,
  setDatePreset,
  setReportParams,
  setSelectedColumns,
  setEmailReport,
  toggleColumn,
  handleGenerateReport,
}: ReportFiltersProps) => {
  const applyDatePreset = (value: ReportDatePreset) => {
    setDatePreset(value);
    if (value === "today") {
      const today = new Date().toISOString().split("T")[0];
      setReportParams({
        ...reportParams,
        startDate: today,
        endDate: today,
      });
    } else if (value === "week") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      setReportParams({
        ...reportParams,
        startDate: weekAgo,
        endDate: today,
      });
    } else if (value === "month") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      setReportParams({
        ...reportParams,
        startDate: monthAgo,
        endDate: today,
      });
    }
  };

  return (
    <>
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
            value={datePreset}
            onChange={(event) =>
              applyDatePreset(event.target.value as ReportDatePreset)
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            onChange={(event) => {
              setDatePreset("custom");
              setReportParams({
                ...reportParams,
                startDate: event.target.value,
              });
            }}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            onChange={(event) => {
              setDatePreset("custom");
              setReportParams({ ...reportParams, endDate: event.target.value });
            }}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

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
            onChange={(event) =>
              setReportParams({
                ...reportParams,
                subjectId: event.target.value
                  ? parseInt(event.target.value)
                  : undefined,
              })
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            onChange={(event) =>
              setReportParams({
                ...reportParams,
                classroomId: event.target.value
                  ? parseInt(event.target.value)
                  : undefined,
              })
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
            onChange={(event) =>
              setReportParams({
                ...reportParams,
                type: event.target.value as ReportParams["type"],
              })
            }
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="attendance">Attendance Report</option>
            <option value="students">Student Report</option>
            <option value="classroom">Classroom Report</option>
          </select>
        </div>
      </div>

      {validationMessage && (
        <div className="rounded-md border border-red-800 bg-red-950/40 p-4 text-sm text-red-100">
          {validationMessage}
        </div>
      )}

      <div className="rounded-md border border-gray-700 bg-gray-900/40 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h5 className="text-sm font-medium text-white">Export Columns</h5>
            <p className="text-xs text-gray-400">
              Choose which preview columns are included in CSV, Excel, and PDF
              exports.
            </p>
          </div>
          <button
            onClick={() => setSelectedColumns(previewColumns)}
            className="text-xs text-cyan-300 hover:text-cyan-200"
          >
            Select all
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {previewColumns.map((column) => (
            <label
              key={column}
              className="flex items-center gap-2 text-sm text-gray-300"
            >
              <input
                type="checkbox"
                checked={selectedExportColumns.includes(column)}
                onChange={() => toggleColumn(column)}
                className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
              />
              {column}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={emailReport}
            onChange={(event) => setEmailReport(event.target.checked)}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
          />
          Email report file to me
        </label>
        <button
          onClick={() => handleGenerateReport()}
          disabled={generating || Boolean(validationMessage)}
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
              setReportParams((current) => ({ ...current, format: "csv" }));
              handleGenerateReport("csv");
            }}
            disabled={generating || Boolean(validationMessage)}
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
              setReportParams((current) => ({ ...current, format: "xlsx" }));
              handleGenerateReport("xlsx");
            }}
            disabled={generating || Boolean(validationMessage)}
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
              setReportParams((current) => ({ ...current, format: "pdf" }));
              handleGenerateReport("pdf");
            }}
            disabled={generating || Boolean(validationMessage)}
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
      {paginationTotal === 0 && !previewLoading && (
        <div className="rounded-md border border-yellow-800 bg-yellow-950/40 p-4 text-sm text-yellow-100">
          No rows match these filters yet. Record attendance first, or adjust
          the date, subject, or class section before exporting.
          {reportParams.type === "attendance" &&
            " Try All Subjects or a wider date range if you expected attendance records."}
        </div>
      )}
    </>
  );
};

