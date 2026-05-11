import { useMemo, useState, useEffect } from "react";
import { useNotifications } from "../components/NotificationSystem";
import { useAuth } from "../hooks/useAuth";
import { ExportGuide } from "./reports/ExportGuide";
import { ReportFilters } from "./reports/ReportFilters";
import { ReportHistory } from "./reports/ReportHistory";
import { ReportHistoryDetailsModal } from "./reports/ReportHistoryDetailsModal";
import { ReportPresetsAndSchedules } from "./reports/ReportPresetsAndSchedules";
import { ReportPreview } from "./reports/ReportPreview";
import { ScheduleErrorModal } from "./reports/ScheduleErrorModal";
import {
  fetchClassrooms,
  fetchSubjects,
  triggerReportDownload,
} from "./reports/reportApi";
import { useReportHistory } from "./reports/useReportHistory";
import { useReportPreview } from "./reports/useReportPreview";
import { useReportPresets } from "./reports/useReportPresets";
import { useReportSchedules } from "./reports/useReportSchedules";
import type {
  ClassroomOption,
  ReportDatePreset,
  ReportDownloadPayload,
  ReportHistoryItem,
  ReportParams,
  SubjectOption,
} from "./reports/types";
import {
  dateRangeError,
  fallbackPreviewColumns,
  formatDateLabel,
  formatDateTimeLabel,
  reportTypeLabels,
} from "./reports/reportUtils";

export const Reports = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const {
    reportHistory,
    reportHistoryFilters,
    reportHistoryPagination,
    exportingHistory,
    setReportHistoryFilters,
    loadReportHistory,
    resetReportHistoryFilters,
    clearReportHistoryFilter,
    exportReportHistoryCsv,
  } = useReportHistory(addNotification);
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<ReportHistoryItem | null>(null);
  const [selectedScheduleError, setSelectedScheduleError] = useState<{
    name: string;
    error: string;
  } | null>(null);
  const [downloadingHistoryId, setDownloadingHistoryId] = useState<
    number | null
  >(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [emailReport, setEmailReport] = useState(false);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("custom");
  const [reportParams, setReportParams] = useState<ReportParams>({
    format: "xlsx",
    type: "attendance",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // 30 days ago
    endDate: new Date().toISOString().split("T")[0], // Today
  });
  const {
    previewLoading,
    previewData,
    summary,
    realTimeStats,
    pagination,
    setPagination,
    loadPreviewData,
    loadRealTimeStats,
  } = useReportPreview(reportParams, addNotification);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);

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
  const validationMessage = dateRangeError(
    reportParams.startDate,
    reportParams.endDate,
  );
  const selectedExportColumns =
    selectedColumns.length > 0
      ? selectedColumns.filter((column) => previewColumns.includes(column))
      : previewColumns;
  const {
    reportPresets,
    selectedPresetId,
    selectedPreset,
    canEditSelectedPreset,
    deletingPresetId,
    duplicatingPreset,
    presetName,
    presetVisibility,
    savingPreset,
    updatingPreset,
    setPresetName,
    setPresetVisibility,
    loadReportPresets,
    applyReportPreset,
    handleDeletePreset,
    handleDuplicatePreset,
    handleChangeSelectedPresetVisibility,
    handleSavePreset,
    handleUpdatePreset,
    handleSavePresetCopy,
  } = useReportPresets({
    user,
    reportParams,
    datePreset,
    selectedExportColumns,
    setDatePreset,
    setReportParams,
    setSelectedColumns,
    onPresetApplied: (presetId, preset) => {
      setSchedulePresetId(presetId);
      setScheduleFormat(preset.parameters.format);
      if (!scheduleName) {
        setScheduleName(`${preset.name} Schedule`);
      }
    },
    addNotification,
  });
  const {
    reportSchedules,
    schedulePresetId,
    scheduleName,
    scheduleFrequency,
    scheduleDayOfWeek,
    scheduleDayOfMonth,
    scheduleTime,
    scheduleFormat,
    scheduleRecipient,
    scheduleActive,
    savingSchedule,
    updatingScheduleId,
    runningScheduleId,
    deletingScheduleId,
    setSchedulePresetId,
    setScheduleName,
    setScheduleFrequency,
    setScheduleDayOfWeek,
    setScheduleDayOfMonth,
    setScheduleTime,
    setScheduleFormat,
    setScheduleRecipient,
    setScheduleActive,
    loadReportSchedules,
    handleCreateSchedule,
    handleToggleSchedule,
    handleRunScheduleNow,
    handleDeleteSchedule,
  } = useReportSchedules(
    user?.email,
    reportPresets,
    loadReportHistory,
    addNotification,
  );
  const generatedByLabel =
    user?.name && user?.email
      ? `${user.name} (${user.email})`
      : user?.name || user?.email || "Current user";
  const printTimestampLabel = formatDateTimeLabel(lastUpdated.toISOString());
  const loadFilterOptions = async () => {
    try {
      // Load subjects
      const subjectsData = await fetchSubjects();
      const subjectsRaw = (subjectsData as { data?: unknown })?.data;
      setSubjects(Array.isArray(subjectsRaw) ? subjectsRaw : []);

      const classroomsData = await fetchClassrooms();
      const classroomsRaw = (classroomsData as { data?: unknown })?.data;
      setClassrooms(Array.isArray(classroomsRaw) ? classroomsRaw : []);
    } catch (error) {
      console.error("Failed to load filter options:", error);
      setSubjects([]);
      setClassrooms([]);
    }
  };

  useEffect(() => {
    loadRealTimeStats();
    loadFilterOptions();
    loadReportHistory();
    loadReportPresets();
    loadReportSchedules();
  }, []);

  useEffect(() => {
    if (!selectedHistoryItem) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedHistoryItem(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedHistoryItem]);

  useEffect(() => {
    if (!selectedScheduleError) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedScheduleError(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedScheduleError]);

  useEffect(() => {
    setSelectedColumns([]);
    loadPreviewData(1);
  }, [
    reportParams.type,
    reportParams.startDate,
    reportParams.endDate,
    reportParams.subjectId,
    reportParams.classroomId,
  ]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      const refreshVisiblePreview = () => {
        if (document.visibilityState === "hidden") return;
        loadPreviewData();
        loadRealTimeStats();
        setLastUpdated(new Date());
      };

      interval = setInterval(refreshVisiblePreview, 30000);
      document.addEventListener("visibilitychange", refreshVisiblePreview);

      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", refreshVisiblePreview);
      };
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

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
          source: "quick",
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
    const dateError = dateRangeError(reportParams.startDate, reportParams.endDate);
    if (dateError) {
      addNotification({
        type: "error",
        title: "Invalid Date Range",
        message: dateError,
      });
      return;
    }
    if (pagination.total === 0 && !emailReport) {
      addNotification({
        type: "warning",
        title: "No Records to Export",
        message:
          reportParams.type === "attendance"
            ? "No attendance records found for this date range. Try All Subjects or a wider range."
            : "No records match the selected filters. Adjust the filters before exporting.",
      });
      return;
    }

    setGenerating(true);
    try {
      const payload: ReportDownloadPayload = {
        ...reportParams,
        format,
        columns: selectedExportColumns,
        emailToMe: emailReport,
        source: emailReport ? "email" : "manual",
      };
      const result = await triggerReportDownload(payload);
      if (emailReport && result?.success === false) {
        throw new Error(result.message || "Failed to email report summary");
      }
      await loadReportHistory();

      addNotification({
        type: "success",
        title:
          emailReport
            ? "Report Emailed"
            : format === "pdf"
              ? "PDF Exported"
              : format === "xlsx"
                ? "Excel Exported"
                : "Report Exported",
        message: emailReport
          ? "The report file has been sent to your account email."
          :
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
        title: "Export Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate report. Check the filters, file format, or your permissions and try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadHistoryReport = async (item: ReportHistoryItem) => {
    const type =
      item.parameters?.type === "attendance" ||
      item.parameters?.type === "students" ||
      item.parameters?.type === "classroom"
        ? item.parameters.type
        : (item.reportType as ReportParams["type"]);
    const format =
      item.parameters?.format === "csv" ||
      item.parameters?.format === "xlsx" ||
      item.parameters?.format === "pdf"
        ? item.parameters.format
        : "xlsx";

    setDownloadingHistoryId(item.id);
    try {
      await triggerReportDownload(
        {
          type,
          format,
          startDate: item.parameters?.startDate,
          endDate: item.parameters?.endDate,
          subjectId: item.parameters?.subjectId,
          classroomId: item.parameters?.classroomId,
          columns: item.parameters?.columns,
          emailToMe: false,
          source: "download-again",
        },
        `${type}_report`,
      );
      await loadReportHistory();
      addNotification({
        type: "success",
        title: "Report Downloaded",
        message: "The report was regenerated from the saved history filters.",
      });
    } catch (error) {
      console.error("Failed to download historical report:", error);
      addNotification({
        type: "error",
        title: "Download Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to regenerate this report.",
      });
    } finally {
      setDownloadingHistoryId(null);
    }
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) => {
      const source = current.length > 0 ? current : previewColumns;
      return source.includes(column)
        ? source.filter((item) => item !== column)
        : [...source, column];
    });
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
    <div className="reports-page space-y-6">
      {/* Header */}
      <div className="screen-only flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-medium text-white">Attendance Reports</h3>
          <p className="text-sm text-gray-300">
            Generate and download comprehensive attendance reports
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
      <div className="screen-only grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex min-w-0 items-center gap-4">
            <div className="shrink-0 text-2xl">📊</div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-gray-300">
                Today's Present
              </p>
              <p className="text-2xl font-bold text-green-400">
                {realTimeStats.todayPresent.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex min-w-0 items-center gap-4">
            <div className="shrink-0 text-2xl">⏰</div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-gray-300">Today's Late</p>
              <p className="text-2xl font-bold text-yellow-400">
                {realTimeStats.todayLate.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex min-w-0 items-center gap-4">
            <div className="shrink-0 text-2xl">❌</div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-gray-300">
                Today's Absent
              </p>
              <p className="text-2xl font-bold text-red-400">
                {realTimeStats.todayAbsent.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex min-w-0 items-center gap-4">
            <div className="shrink-0 text-2xl">🏫</div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-gray-300">
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
      <div className="screen-only grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-white">Daily Report</h4>
              <p className="text-xs text-gray-400">
                Today's attendance summary
              </p>
            </div>
            <button
              onClick={() => handleQuickReport("daily")}
              disabled={generating}
              className="w-full rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:bg-blue-800 sm:w-auto sm:shrink-0"
            >
              Download
            </button>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-white">Weekly Report</h4>
              <p className="text-xs text-gray-400">
                This week's attendance trends
              </p>
            </div>
            <button
              onClick={() => handleQuickReport("weekly")}
              disabled={generating}
              className="w-full rounded bg-green-600 px-4 py-1.5 text-xs text-white hover:bg-green-700 disabled:bg-green-800 sm:w-auto sm:shrink-0"
            >
              Download
            </button>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow p-4 border border-gray-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
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
              className="w-full rounded bg-purple-600 px-4 py-1.5 text-xs text-white hover:bg-purple-700 disabled:bg-purple-800 sm:w-auto sm:shrink-0"
            >
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Report Filters */}
      <div className="screen-only bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">Report Filters</h4>
        <div className="mb-4 rounded-md border border-gray-700 bg-gray-900/50 p-4">
          <p className="break-words text-sm leading-6 text-gray-300">{exportContext}</p>
          <p className="text-xs text-gray-500 mt-1">
            Report includes {pagination.total.toLocaleString()} records from{" "}
            {formatDateLabel(reportParams.startDate)} to{" "}
            {formatDateLabel(reportParams.endDate)}. Selected export:{" "}
            {exportFormatLabel}. Previewing {previewData.length.toLocaleString()} rows.
          </p>
          <p className="text-xs text-cyan-400 mt-1">
            Exports all matching records, not just this preview page.
            {user?.role === "faculty" &&
              " Limited to your assigned schedules."}
          </p>
        </div>
        <div className="space-y-6">
          <ReportPresetsAndSchedules
            userRole={user?.role}
            reportPresets={reportPresets}
            selectedPresetId={selectedPresetId}
            selectedPreset={selectedPreset}
            canEditSelectedPreset={canEditSelectedPreset}
            deletingPresetId={deletingPresetId}
            duplicatingPreset={duplicatingPreset}
            presetName={presetName}
            presetVisibility={presetVisibility}
            savingPreset={savingPreset}
            updatingPreset={updatingPreset}
            reportSchedules={reportSchedules}
            schedulePresetId={schedulePresetId}
            scheduleName={scheduleName}
            scheduleFrequency={scheduleFrequency}
            scheduleDayOfWeek={scheduleDayOfWeek}
            scheduleDayOfMonth={scheduleDayOfMonth}
            scheduleTime={scheduleTime}
            scheduleFormat={scheduleFormat}
            scheduleRecipient={scheduleRecipient}
            scheduleActive={scheduleActive}
            savingSchedule={savingSchedule}
            runningScheduleId={runningScheduleId}
            updatingScheduleId={updatingScheduleId}
            deletingScheduleId={deletingScheduleId}
            applyReportPreset={applyReportPreset}
            handleDeletePreset={handleDeletePreset}
            handleDuplicatePreset={handleDuplicatePreset}
            handleChangeSelectedPresetVisibility={
              handleChangeSelectedPresetVisibility
            }
            setPresetName={setPresetName}
            setPresetVisibility={setPresetVisibility}
            handleSavePreset={handleSavePreset}
            handleUpdatePreset={handleUpdatePreset}
            handleSavePresetCopy={handleSavePresetCopy}
            loadReportSchedules={loadReportSchedules}
            setSchedulePresetId={setSchedulePresetId}
            setScheduleName={setScheduleName}
            setScheduleFrequency={setScheduleFrequency}
            setScheduleDayOfWeek={setScheduleDayOfWeek}
            setScheduleDayOfMonth={setScheduleDayOfMonth}
            setScheduleTime={setScheduleTime}
            setScheduleFormat={setScheduleFormat}
            setScheduleRecipient={setScheduleRecipient}
            setScheduleActive={setScheduleActive}
            handleCreateSchedule={handleCreateSchedule}
            handleRunScheduleNow={handleRunScheduleNow}
            handleToggleSchedule={handleToggleSchedule}
            handleDeleteSchedule={handleDeleteSchedule}
            setSelectedScheduleError={setSelectedScheduleError}
            renderStatus={renderStatus}
          />
          <ReportFilters
            datePreset={datePreset}
            reportParams={reportParams}
            subjects={subjects}
            classrooms={classrooms}
            validationMessage={validationMessage}
            previewColumns={previewColumns}
            selectedExportColumns={selectedExportColumns}
            emailReport={emailReport}
            generating={generating}
            paginationTotal={pagination.total}
            previewLoading={previewLoading}
            setDatePreset={setDatePreset}
            setReportParams={setReportParams}
            setSelectedColumns={setSelectedColumns}
            setEmailReport={setEmailReport}
            toggleColumn={toggleColumn}
            handleGenerateReport={handleGenerateReport}
          />
        </div>
      </div>

      <ReportPreview
        reportParams={reportParams}
        selectedSubject={selectedSubject}
        selectedClassroom={selectedClassroom}
        generatedByLabel={generatedByLabel}
        printTimestampLabel={printTimestampLabel}
        previewData={previewData}
        previewColumns={previewColumns}
        previewLoading={previewLoading}
        pagination={pagination}
        overviewCards={overviewCards}
        autoRefresh={autoRefresh}
        userRole={user?.role}
        setLastUpdated={setLastUpdated}
        setPagination={setPagination}
        loadPreviewData={loadPreviewData}
        loadRealTimeStats={loadRealTimeStats}
        renderStatus={renderStatus}
      />
      <ReportHistory
        reportHistory={reportHistory}
        reportHistoryFilters={reportHistoryFilters}
        reportHistoryPagination={reportHistoryPagination}
        userRole={user?.role}
        exportingHistory={exportingHistory}
        downloadingHistoryId={downloadingHistoryId}
        setReportHistoryFilters={setReportHistoryFilters}
        loadReportHistory={loadReportHistory}
        resetReportHistoryFilters={resetReportHistoryFilters}
        clearReportHistoryFilter={clearReportHistoryFilter}
        exportReportHistoryCsv={exportReportHistoryCsv}
        setSelectedHistoryItem={setSelectedHistoryItem}
        handleDownloadHistoryReport={handleDownloadHistoryReport}
      />
      {selectedScheduleError && (
        <ScheduleErrorModal
          error={selectedScheduleError}
          onClose={() => setSelectedScheduleError(null)}
        />
      )}

      {selectedHistoryItem && (
        <ReportHistoryDetailsModal
          item={selectedHistoryItem}
          downloadingHistoryId={downloadingHistoryId}
          onClose={() => setSelectedHistoryItem(null)}
          onDownloadAgain={handleDownloadHistoryReport}
          renderStatus={renderStatus}
        />
      )}

      <ExportGuide />
    </div>
  );
};

