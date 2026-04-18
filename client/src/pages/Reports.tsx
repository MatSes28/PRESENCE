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
  createReportPreset,
  createReportSchedule,
  deleteReportPreset,
  deleteReportSchedule,
  duplicateReportPreset,
  fetchClassrooms,
  fetchRealTimeStats,
  fetchReportPresets,
  fetchReportPreview,
  fetchReportSchedules,
  fetchSubjects,
  resetDemoData,
  seedDemoData,
  triggerReportDownload,
  triggerReportSchedule,
  updateReportPreset,
  updateReportSchedule,
} from "./reports/reportApi";
import { useReportHistory } from "./reports/useReportHistory";
import type {
  ClassroomOption,
  ReportDatePreset,
  ReportDownloadPayload,
  ReportHistoryItem,
  ReportParams,
  ReportPresetItem,
  ReportPresetParameters,
  ReportPresetVisibility,
  ReportScheduleFrequency,
  ReportScheduleItem,
  SubjectOption,
  SummaryItem,
} from "./reports/types";
import {
  dateRangeError,
  fallbackPreviewColumns,
  formatDateLabel,
  formatDateTimeLabel,
  getDateRangeForPreset,
  reportTypeLabels,
  toTitle,
} from "./reports/reportUtils";

export const Reports = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
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
  const [reportPresets, setReportPresets] = useState<ReportPresetItem[]>([]);
  const [reportSchedules, setReportSchedules] = useState<ReportScheduleItem[]>(
    [],
  );
  const [presetName, setPresetName] = useState("");
  const [presetVisibility, setPresetVisibility] =
    useState<ReportPresetVisibility>("personal");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [updatingPreset, setUpdatingPreset] = useState(false);
  const [duplicatingPreset, setDuplicatingPreset] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [schedulePresetId, setSchedulePresetId] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] =
    useState<ReportScheduleFrequency>("weekly");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [scheduleFormat, setScheduleFormat] =
    useState<ReportParams["format"]>("xlsx");
  const [scheduleRecipient, setScheduleRecipient] = useState(user?.email || "");
  const [scheduleActive, setScheduleActive] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [updatingScheduleId, setUpdatingScheduleId] = useState<number | null>(
    null,
  );
  const [runningScheduleId, setRunningScheduleId] = useState<number | null>(
    null,
  );
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(
    null,
  );
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
  const selectedPreset = reportPresets.find(
    (preset) => String(preset.id) === selectedPresetId,
  );
  const canEditSelectedPreset =
    !!selectedPreset &&
    !selectedPreset.isDefault &&
    typeof selectedPreset.id === "number" &&
    (user?.role === "admin" || selectedPreset.createdBy === user?.id);
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
  const generatedByLabel =
    user?.name && user?.email
      ? `${user.name} (${user.email})`
      : user?.name || user?.email || "Current user";
  const printTimestampLabel = formatDateTimeLabel(lastUpdated.toISOString());
  const currentPresetParameters = (): ReportPresetParameters => ({
    ...reportParams,
    datePreset,
    columns: selectedExportColumns,
  });
  const loadPreviewData = async (page = pagination.page) => {
    const dateError = dateRangeError(reportParams.startDate, reportParams.endDate);
    if (dateError) {
      setPreviewData([]);
      setSummary([]);
      setPagination((prev) => ({ ...prev, page: 1, total: 0 }));
      return;
    }

    setPreviewLoading(true);
    try {
      const offset = (page - 1) * pagination.limit;
      const queryParams = new URLSearchParams({
        type: reportParams.type,
        limit: pagination.limit.toString(),
        offset: offset.toString(),
      });
      if (reportParams.startDate) {
        queryParams.set("startDate", reportParams.startDate);
      }
      if (reportParams.endDate) {
        queryParams.set("endDate", reportParams.endDate);
      }
      if (reportParams.subjectId) {
        queryParams.set("subjectId", reportParams.subjectId.toString());
      }
      if (reportParams.classroomId) {
        queryParams.set("classroomId", reportParams.classroomId.toString());
      }

      const data = await fetchReportPreview(queryParams);

      if (data.success && Array.isArray(data.data)) {
        const rows = data.data;
        setPreviewData(rows);
        setSummary(Array.isArray(data.summary) ? data.summary : []);
        setPagination((prev) => ({
          ...prev,
          page,
          total: typeof data.total === "number" ? data.total : rows.length,
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

  const loadReportPresets = async () => {
    try {
      const data = await fetchReportPresets();
      setReportPresets(
        data.success && Array.isArray(data.data) ? data.data : [],
      );
    } catch (error) {
      console.error("Failed to load report presets:", error);
      setReportPresets([]);
    }
  };

  const loadReportSchedules = async () => {
    try {
      const data = await fetchReportSchedules();
      setReportSchedules(
        data.success && Array.isArray(data.data) ? data.data : [],
      );
    } catch (error) {
      console.error("Failed to load report schedules:", error);
      setReportSchedules([]);
    }
  };

  const loadRealTimeStats = async () => {
    try {
      const data = await fetchRealTimeStats();

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
    if (!scheduleRecipient && user?.email) {
      setScheduleRecipient(user.email);
    }
  }, [scheduleRecipient, user?.email]);

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
      interval = setInterval(() => {
        loadPreviewData();
        loadRealTimeStats();
        setLastUpdated(new Date());
      }, 30000);
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

  const handleSeedDemoData = async () => {
    setSeedingDemo(true);
    try {
      const data = await seedDemoData();

      if (!data.success) {
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

  const handleResetDemoData = async () => {
    setResettingDemo(true);
    try {
      const data = await resetDemoData();

      if (!data.success) {
        throw new Error(data.message || "Failed to reset demo data");
      }

      await Promise.all([
        loadFilterOptions(),
        loadPreviewData(1),
        loadRealTimeStats(),
      ]);

      addNotification({
        type: "success",
        title: "Demo Data Reset",
        message: "Demo report data has been cleared.",
      });
    } catch (error) {
      console.error("Failed to reset demo data:", error);
      addNotification({
        type: "error",
        title: "Demo Reset Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to reset demo report data.",
      });
    } finally {
      setResettingDemo(false);
    }
  };

  const handleSavePreset = async () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      addNotification({
        type: "warning",
        title: "Preset Name Required",
        message: "Name this preset before saving it.",
      });
      return;
    }

    setSavingPreset(true);
    try {
      const data = await createReportPreset({
        name: trimmedName,
        visibility: user?.role === "admin" ? presetVisibility : "personal",
        parameters: {
          ...reportParams,
          datePreset,
          columns: selectedExportColumns,
        },
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save preset");
      }

      setPresetName("");
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Saved",
        message: `${trimmedName} is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to save report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Save Failed",
        message:
          error instanceof Error ? error.message : "Failed to save preset.",
      });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPreset || !canEditSelectedPreset) return;
    if (typeof selectedPreset.id !== "number") return;

    setUpdatingPreset(true);
    try {
      const data = await updateReportPreset(selectedPreset.id, {
        name: selectedPreset.name,
        visibility:
          user?.role === "admin" ? selectedPreset.visibility : "personal",
        parameters: currentPresetParameters(),
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to update preset");
      }

      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Updated",
        message: `${selectedPreset.name} now uses the current report setup.`,
      });
    } catch (error) {
      console.error("Failed to update report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Update Failed",
        message:
          error instanceof Error ? error.message : "Failed to update preset.",
      });
    } finally {
      setUpdatingPreset(false);
    }
  };

  const handleSavePresetCopy = async () => {
    const sourceName = selectedPreset?.name || "Report Preset";
    const copyName = presetName.trim() || `${sourceName} Copy`;

    setSavingPreset(true);
    try {
      const data = await createReportPreset({
        name: copyName,
        visibility: user?.role === "admin" ? presetVisibility : "personal",
        parameters: currentPresetParameters(),
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save preset copy");
      }
      if (!data.data?.id) {
        throw new Error("Preset copy response did not include an id");
      }

      setPresetName("");
      setSelectedPresetId(String(data.data.id));
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Copied",
        message: `${copyName} is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to save report preset copy:", error);
      addNotification({
        type: "error",
        title: "Preset Copy Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save preset copy.",
      });
    } finally {
      setSavingPreset(false);
    }
  };

  const handleDuplicatePreset = async () => {
    if (!selectedPreset) return;

    setDuplicatingPreset(true);
    try {
      const duplicateName = presetName.trim() || `${selectedPreset.name} Copy`;
      const body = {
        name: duplicateName,
        visibility: user?.role === "admin" ? presetVisibility : "personal",
      };
      const data =
        typeof selectedPreset.id === "number"
          ? await duplicateReportPreset(selectedPreset.id, body)
          : await createReportPreset({
                name: duplicateName,
                visibility:
                  user?.role === "admin" ? presetVisibility : "personal",
                parameters: selectedPreset.parameters,
            });

      if (!data.success) {
        throw new Error(data.message || "Failed to duplicate preset");
      }
      if (!data.data?.id) {
        throw new Error("Duplicated preset response did not include an id");
      }

      setPresetName("");
      setSelectedPresetId(String(data.data.id));
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Duplicated",
        message: `${duplicateName} is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to duplicate report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Duplicate Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to duplicate preset.",
      });
    } finally {
      setDuplicatingPreset(false);
    }
  };

  const handleChangeSelectedPresetVisibility = async (
    visibility: ReportPresetVisibility,
  ) => {
    if (!selectedPreset || !canEditSelectedPreset || user?.role !== "admin") {
      return;
    }
    if (typeof selectedPreset.id !== "number") return;

    setUpdatingPreset(true);
    try {
      const data = await updateReportPreset(selectedPreset.id, {
        name: selectedPreset.name,
        visibility,
        parameters: selectedPreset.parameters,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to update preset visibility");
      }

      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Visibility Updated",
        message: `${selectedPreset.name} is now ${toTitle(visibility)}.`,
      });
    } catch (error) {
      console.error("Failed to update preset visibility:", error);
      addNotification({
        type: "error",
        title: "Visibility Update Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update preset visibility.",
      });
    } finally {
      setUpdatingPreset(false);
    }
  };

  const applyReportPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;

    const preset = reportPresets.find((item) => String(item.id) === presetId);
    if (!preset) return;

    const presetDate = preset.parameters.datePreset || "custom";
    const computedDates = getDateRangeForPreset(presetDate);
    setDatePreset(presetDate);
    setReportParams({
      type: preset.parameters.type,
      format: preset.parameters.format,
      startDate: computedDates.startDate ?? preset.parameters.startDate,
      endDate: computedDates.endDate ?? preset.parameters.endDate,
      subjectId: preset.parameters.subjectId,
      classroomId: preset.parameters.classroomId,
    });
    setSelectedColumns(preset.parameters.columns || []);
    setSchedulePresetId(presetId);
    setScheduleFormat(preset.parameters.format);
    if (!scheduleName) {
      setScheduleName(`${preset.name} Schedule`);
    }
    addNotification({
      type: "success",
      title: "Preset Loaded",
      message: `${preset.name} has been applied.`,
    });
  };

  const handleDeletePreset = async () => {
    const preset = reportPresets.find(
      (item) => String(item.id) === selectedPresetId,
    );
    if (!preset || preset.isDefault || typeof preset.id !== "number") {
      return;
    }

    setDeletingPresetId(String(preset.id));
    try {
      const data = await deleteReportPreset(preset.id);

      if (!data.success) {
        throw new Error(data.message || "Failed to delete preset");
      }

      setSelectedPresetId("");
      await loadReportPresets();
      addNotification({
        type: "success",
        title: "Preset Deleted",
        message: `${preset.name} has been removed.`,
      });
    } catch (error) {
      console.error("Failed to delete report preset:", error);
      addNotification({
        type: "error",
        title: "Preset Delete Failed",
        message:
          error instanceof Error ? error.message : "Failed to delete preset.",
      });
    } finally {
      setDeletingPresetId(null);
    }
  };

  const handleCreateSchedule = async () => {
    const preset = reportPresets.find(
      (item) => String(item.id) === schedulePresetId,
    );
    const trimmedName = scheduleName.trim();
    const trimmedRecipient = scheduleRecipient.trim();

    if (!preset) {
      addNotification({
        type: "warning",
        title: "Preset Required",
        message: "Choose the preset this schedule should send.",
      });
      return;
    }

    if (!trimmedName) {
      addNotification({
        type: "warning",
        title: "Schedule Name Required",
        message: "Name this scheduled report before saving it.",
      });
      return;
    }

    if (!trimmedRecipient) {
      addNotification({
        type: "warning",
        title: "Recipient Required",
        message: "Add the email address that should receive this report.",
      });
      return;
    }

    setSavingSchedule(true);
    try {
      const data = await createReportSchedule({
        name: trimmedName,
        presetId: String(preset.id),
        presetName: preset.name,
        frequency: scheduleFrequency,
        dayOfWeek: scheduleDayOfWeek,
        dayOfMonth: scheduleDayOfMonth,
        timeOfDay: scheduleTime,
        format: scheduleFormat,
        recipientEmail: trimmedRecipient,
        isActive: scheduleActive,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to save report schedule");
      }

      setScheduleName("");
      await loadReportSchedules();
      addNotification({
        type: "success",
        title: "Schedule Saved",
        message: `${trimmedName} will send automatically.`,
      });
    } catch (error) {
      console.error("Failed to save report schedule:", error);
      addNotification({
        type: "error",
        title: "Schedule Save Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save report schedule.",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleSchedule = async (schedule: ReportScheduleItem) => {
    setUpdatingScheduleId(schedule.id);
    try {
      const data = await updateReportSchedule(schedule.id, {
        isActive: !schedule.isActive,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to update report schedule");
      }

      await loadReportSchedules();
    } catch (error) {
      console.error("Failed to update report schedule:", error);
      addNotification({
        type: "error",
        title: "Schedule Update Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update report schedule.",
      });
    } finally {
      setUpdatingScheduleId(null);
    }
  };

  const handleRunScheduleNow = async (schedule: ReportScheduleItem) => {
    setRunningScheduleId(schedule.id);
    try {
      const data = await triggerReportSchedule(schedule.id);

      if (!data.success) {
        throw new Error(data.message || "Failed to run report schedule");
      }

      await Promise.all([loadReportSchedules(), loadReportHistory()]);
      addNotification({
        type: "success",
        title: "Schedule Ran",
        message: `${schedule.name} generated and emailed a report.`,
      });
    } catch (error) {
      console.error("Failed to run report schedule:", error);
      await loadReportSchedules();
      addNotification({
        type: "error",
        title: "Run Now Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to run this report schedule.",
      });
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleDeleteSchedule = async (schedule: ReportScheduleItem) => {
    setDeletingScheduleId(schedule.id);
    try {
      const data = await deleteReportSchedule(schedule.id);

      if (!data.success) {
        throw new Error(data.message || "Failed to delete report schedule");
      }

      await loadReportSchedules();
      addNotification({
        type: "success",
        title: "Schedule Deleted",
        message: `${schedule.name} has been removed.`,
      });
    } catch (error) {
      console.error("Failed to delete report schedule:", error);
      addNotification({
        type: "error",
        title: "Schedule Delete Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete report schedule.",
      });
    } finally {
      setDeletingScheduleId(null);
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
      <div className="screen-only flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg font-medium text-white">Attendance Reports</h3>
          <p className="text-sm text-gray-300">
            Generate and download comprehensive attendance reports
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === "admin" && (
            <>
              <button
                onClick={handleSeedDemoData}
                disabled={seedingDemo || resettingDemo}
                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-2 rounded text-sm font-medium"
              >
                {seedingDemo ? "Seeding..." : "Seed Demo Data"}
              </button>
              <button
                onClick={handleResetDemoData}
                disabled={seedingDemo || resettingDemo}
                className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-2 rounded text-sm font-medium"
              >
                {resettingDemo ? "Resetting..." : "Reset Demo Data"}
              </button>
            </>
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
      <div className="screen-only grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <div className="screen-only grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div className="screen-only bg-gray-800 rounded-lg shadow p-6 border border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">Report Filters</h4>
        <div className="mb-4 rounded-md border border-gray-700 bg-gray-900/50 p-3">
          <p className="text-sm text-gray-300">{exportContext}</p>
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
