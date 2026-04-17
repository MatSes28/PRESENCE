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

const triggerReportDownload = async (
  payload: ReportDownloadPayload,
  filenameBase?: string,
) => {
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

interface ReportDownloadPayload extends ReportParams {
  quickReportType?: "daily" | "weekly" | "analytics";
  columns?: string[];
  emailToMe?: boolean;
  source?: "manual" | "email" | "quick" | "scheduled" | "download-again";
}

interface SummaryItem {
  label: string;
  value: string;
}

interface SubjectOption {
  id: number;
  code: string;
  name: string;
}

interface ClassroomOption {
  id: number;
  name: string;
  location: string;
}

interface ReportHistoryItem {
  id: number;
  reportType: string;
  generatedAt: string;
  generatedBy?: {
    id: number;
    name: string;
    email: string;
  };
  status: string;
  recordCount: number;
  filePath?: string;
  errorMessage?: string | null;
  parameters?: {
    type?: ReportParams["type"];
    format?: string;
    subjectLabel?: string;
    classroomLabel?: string;
    startDate?: string;
    endDate?: string;
    subjectId?: number;
    classroomId?: number;
    columns?: string[];
    scope?: string;
    source?: string;
    scheduleId?: number;
    scheduleName?: string;
    quickReportType?: string;
  };
}

type ReportDatePreset = "today" | "week" | "month" | "custom";
type ReportPresetVisibility = "personal" | "shared" | "admin";
type ReportScheduleFrequency = "daily" | "weekly" | "monthly";
type ReportHistorySource =
  | "manual"
  | "email"
  | "quick"
  | "scheduled"
  | "download-again";

interface ReportPresetParameters extends ReportParams {
  datePreset?: ReportDatePreset;
  columns?: string[];
}

interface ReportHistoryFilters {
  type: "" | ReportParams["type"];
  format: "" | ReportParams["format"];
  source: "" | ReportHistorySource;
  status: "" | "completed" | "failed" | "pending";
  generatedBy: string;
  startDate: string;
  endDate: string;
}

interface ReportPresetItem {
  id: number | string;
  name: string;
  visibility: ReportPresetVisibility;
  isDefault?: boolean;
  createdBy?: number;
  parameters: ReportPresetParameters;
}

interface ReportScheduleItem {
  id: number;
  name: string;
  presetId: string;
  presetName: string;
  createdBy?: number;
  owner?: {
    id: number;
    name: string;
    email: string;
  };
  frequency: ReportScheduleFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  timeOfDay: string;
  format: ReportParams["format"];
  recipientEmail: string;
  isActive: boolean;
  lastRunAt?: string | null;
  nextRunAt: string;
  lastStatus: string;
  lastError?: string | null;
}

const reportTypeLabels: Record<ReportParams["type"], string> = {
  attendance: "Attendance Report",
  students: "Student Report",
  classroom: "Classroom Report",
};

const emptyReportHistoryFilters: ReportHistoryFilters = {
  type: "",
  format: "",
  source: "",
  status: "",
  generatedBy: "",
  startDate: "",
  endDate: "",
};

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const toTitle = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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

const dateRangeError = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Please choose valid start and end dates.";
  }
  if (start.getTime() > end.getTime()) {
    return "Start date must be before or equal to end date.";
  }
  return "";
};

const getDateRangeForPreset = (preset: ReportDatePreset) => {
  const today = new Date();
  const endDate = today.toISOString().split("T")[0];

  if (preset === "today") {
    return { startDate: endDate, endDate };
  }

  if (preset === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return { startDate: weekAgo.toISOString().split("T")[0], endDate };
  }

  if (preset === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: monthAgo.toISOString().split("T")[0], endDate };
  }

  return {};
};

const formatDateTimeLabel = (value?: string | null) => {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatScheduleCadence = (schedule: ReportScheduleItem) => {
  if (schedule.frequency === "daily") {
    return `Daily at ${schedule.timeOfDay}`;
  }

  if (schedule.frequency === "weekly") {
    return `${dayNames[schedule.dayOfWeek ?? 1]} at ${schedule.timeOfDay}`;
  }

  return `Monthly on day ${schedule.dayOfMonth ?? 1} at ${schedule.timeOfDay}`;
};

const formatHistorySource = (item: ReportHistoryItem) => {
  const source =
    item.parameters?.source ||
    (item.parameters?.quickReportType ? "quick" : "manual");
  const labels: Record<string, string> = {
    manual: "Manual export",
    email: "Email export",
    quick: "Quick report",
    scheduled: "Scheduled report",
    "download-again": "Download again",
  };

  return labels[source] || toTitle(source);
};

const getHistoryReportType = (item: ReportHistoryItem) => {
  const type =
    item.parameters?.type === "attendance" ||
    item.parameters?.type === "students" ||
    item.parameters?.type === "classroom"
      ? item.parameters.type
      : (item.reportType as ReportParams["type"]);

  return reportTypeLabels[type] || toTitle(item.reportType);
};

const getHistoryFormat = (item: ReportHistoryItem) =>
  (
    item.parameters?.format ||
    item.filePath?.split(".").pop() ||
    "unknown"
  ).toUpperCase();

const getHistoryFilename = (item: ReportHistoryItem) =>
  item.filePath?.split(/[\\/]/).pop() || "Not recorded";

export const Reports = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [reportHistoryFilters, setReportHistoryFilters] =
    useState<ReportHistoryFilters>(emptyReportHistoryFilters);
  const [reportHistoryPagination, setReportHistoryPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
  });
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
  const reportHistoryPageCount = Math.max(
    1,
    Math.ceil(reportHistoryPagination.total / reportHistoryPagination.limit),
  );
  const reportHistoryStart =
    reportHistoryPagination.total === 0
      ? 0
      : (reportHistoryPagination.page - 1) * reportHistoryPagination.limit + 1;
  const reportHistoryEnd = Math.min(
    reportHistoryPagination.page * reportHistoryPagination.limit,
    reportHistoryPagination.total,
  );

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
    setSelectedColumns([]);
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

  const loadReportHistory = async (
    filters: ReportHistoryFilters = reportHistoryFilters,
    page = reportHistoryPagination.page,
  ) => {
    try {
      const offset = (page - 1) * reportHistoryPagination.limit;
      const queryParams = new URLSearchParams({
        limit: reportHistoryPagination.limit.toString(),
        offset: offset.toString(),
      });
      if (filters.type) queryParams.set("type", filters.type);
      if (filters.format) queryParams.set("format", filters.format);
      if (filters.source) queryParams.set("source", filters.source);
      if (filters.status) queryParams.set("status", filters.status);
      if (filters.generatedBy.trim()) {
        queryParams.set("generatedBy", filters.generatedBy.trim());
      }
      if (filters.startDate) queryParams.set("startDate", filters.startDate);
      if (filters.endDate) queryParams.set("endDate", filters.endDate);

      const response = await fetch(`/api/reports/history?${queryParams}`, {
        credentials: "include",
      });
      const data = await response.json();
      setReportHistory(data.success && Array.isArray(data.data) ? data.data : []);
      setReportHistoryPagination((prev) => ({
        ...prev,
        page,
        total: data.success ? Number(data.total || 0) : 0,
      }));
    } catch (error) {
      console.error("Failed to load report history:", error);
      setReportHistory([]);
      setReportHistoryPagination((prev) => ({
        ...prev,
        page,
        total: 0,
      }));
    }
  };

  const resetReportHistoryFilters = () => {
    setReportHistoryFilters(emptyReportHistoryFilters);
    loadReportHistory(emptyReportHistoryFilters, 1);
  };

  const loadReportPresets = async () => {
    try {
      const response = await fetch("/api/reports/presets", {
        credentials: "include",
      });
      const data = await response.json();
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
      const response = await fetch("/api/reports/schedules", {
        credentials: "include",
      });
      const data = await response.json();
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
      const subjectsRaw = (subjectsData as { data?: unknown })?.data;
      setSubjects(Array.isArray(subjectsRaw) ? subjectsRaw : []);

      const classroomsResponse = await fetch("/api/classrooms", {
        credentials: "include",
      });
      const classroomsData = await classroomsResponse.json();
      const classroomsRaw = (classroomsData as { data?: unknown })?.data;
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

  const handleResetDemoData = async () => {
    setResettingDemo(true);
    try {
      const response = await fetch("/api/reports/seed-demo-data", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
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
      const response = await fetch("/api/reports/presets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          visibility: user?.role === "admin" ? presetVisibility : "personal",
          parameters: {
            ...reportParams,
            datePreset,
            columns: selectedExportColumns,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
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
      const response = await fetch(`/api/reports/presets/${preset.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
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
      const response = await fetch("/api/reports/schedules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
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
      const response = await fetch(`/api/reports/schedules/${schedule.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
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
      const response = await fetch(
        `/api/reports/schedules/${schedule.id}/trigger`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
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
      const response = await fetch(`/api/reports/schedules/${schedule.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
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
          <div className="rounded-md border border-gray-700 bg-gray-900/40 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="report-preset"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Load Preset
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="report-preset"
                    value={selectedPresetId}
                    onChange={(e) => applyReportPreset(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Choose a preset</option>
                    {reportPresets.map((preset) => (
                      <option key={preset.id} value={String(preset.id)}>
                        {preset.name}
                        {preset.isDefault
                          ? " - Default"
                          : ` - ${preset.visibility}`}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleDeletePreset}
                    disabled={
                      !selectedPresetId ||
                      deletingPresetId === selectedPresetId ||
                      reportPresets.find(
                        (preset) => String(preset.id) === selectedPresetId,
                      )?.isDefault
                    }
                    className="px-3 py-2 rounded text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 whitespace-nowrap"
                  >
                    {deletingPresetId === selectedPresetId
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Defaults are available to everyone. Saved presets keep filters,
                  format, and columns.
                </p>
              </div>
              <div>
                <label
                  htmlFor="report-preset-name"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Save Current Filters
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="report-preset-name"
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Weekly Attendance - All Subjects"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {user?.role === "admin" && (
                    <select
                      value={presetVisibility}
                      onChange={(e) =>
                        setPresetVisibility(
                          e.target.value as ReportPresetVisibility,
                        )
                      }
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="personal">Personal</option>
                      <option value="shared">Shared</option>
                      <option value="admin">Admin Only</option>
                    </select>
                  )}
                  <button
                    onClick={handleSavePreset}
                    disabled={savingPreset}
                    className="px-4 py-2 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-cyan-800 whitespace-nowrap"
                  >
                    {savingPreset ? "Saving..." : "Save Preset"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-gray-700 bg-gray-900/40 p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h5 className="text-sm font-medium text-white">
                  Scheduled Reports
                </h5>
                <p className="text-xs text-gray-400">
                  Send a saved preset automatically by email.
                  {user?.role === "admin" &&
                    " Admins can run schedules immediately."}
                </p>
              </div>
              <button
                onClick={loadReportSchedules}
                className="self-start bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                Refresh Schedules
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 mb-5">
              <div className="lg:col-span-2">
                <label
                  htmlFor="schedule-preset"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Preset
                </label>
                <select
                  id="schedule-preset"
                  value={schedulePresetId}
                  onChange={(e) => {
                    const presetId = e.target.value;
                    const preset = reportPresets.find(
                      (item) => String(item.id) === presetId,
                    );
                    setSchedulePresetId(presetId);
                    if (preset) {
                      setScheduleFormat(preset.parameters.format);
                      if (!scheduleName) {
                        setScheduleName(`${preset.name} Schedule`);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Choose a preset</option>
                  {reportPresets.map((preset) => (
                    <option key={preset.id} value={String(preset.id)}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label
                  htmlFor="schedule-name"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Schedule Name
                </label>
                <input
                  id="schedule-name"
                  type="text"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  placeholder="Monday Attendance Email"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label
                  htmlFor="schedule-frequency"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Frequency
                </label>
                <select
                  id="schedule-frequency"
                  value={scheduleFrequency}
                  onChange={(e) =>
                    setScheduleFrequency(
                      e.target.value as ReportScheduleFrequency,
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="schedule-time"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Time
                </label>
                <input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              {scheduleFrequency === "weekly" && (
                <div>
                  <label
                    htmlFor="schedule-day-week"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Day
                  </label>
                  <select
                    id="schedule-day-week"
                    value={scheduleDayOfWeek}
                    onChange={(e) => setScheduleDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {dayNames.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {scheduleFrequency === "monthly" && (
                <div>
                  <label
                    htmlFor="schedule-day-month"
                    className="block text-sm font-medium text-gray-300 mb-1"
                  >
                    Day
                  </label>
                  <input
                    id="schedule-day-month"
                    type="number"
                    min={1}
                    max={31}
                    value={scheduleDayOfMonth}
                    onChange={(e) =>
                      setScheduleDayOfMonth(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="schedule-format"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Format
                </label>
                <select
                  id="schedule-format"
                  value={scheduleFormat}
                  onChange={(e) =>
                    setScheduleFormat(e.target.value as ReportParams["format"])
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              <div className="lg:col-span-2">
                <label
                  htmlFor="schedule-recipient"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Recipient
                </label>
                <input
                  id="schedule-recipient"
                  type="email"
                  value={scheduleRecipient}
                  onChange={(e) => setScheduleRecipient(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300 pb-2">
                  <input
                    type="checkbox"
                    checked={scheduleActive}
                    onChange={(e) => setScheduleActive(e.target.checked)}
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                  />
                  Active
                </label>
                <button
                  onClick={handleCreateSchedule}
                  disabled={savingSchedule}
                  className="px-4 py-2 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-cyan-800 whitespace-nowrap"
                >
                  {savingSchedule ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    {[
                      "Name",
                      "Preset",
                      "Cadence",
                      "Next Run",
                      "Recipient",
                      "Status",
                      "Actions",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {reportSchedules.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm text-gray-400"
                      >
                        No scheduled reports yet.
                      </td>
                    </tr>
                  ) : (
                    reportSchedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td className="px-4 py-3 text-sm text-white">
                          {schedule.name}
                          {schedule.owner?.name && user?.role === "admin" && (
                            <div className="text-xs text-gray-500">
                              {schedule.owner.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {schedule.presetName}
                          <div className="text-xs text-cyan-300 uppercase">
                            {schedule.format}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {formatScheduleCadence(schedule)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          {formatDateTimeLabel(schedule.nextRunAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {schedule.recipientEmail}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {renderStatus(
                            schedule.isActive
                              ? schedule.lastStatus || "scheduled"
                              : "inactive",
                          )}
                          {schedule.lastError && (
                            <div className="mt-1 max-w-xs text-xs text-red-300">
                              {schedule.lastError}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          <div className="flex gap-2">
                            {user?.role === "admin" && (
                              <button
                                onClick={() => handleRunScheduleNow(schedule)}
                                disabled={runningScheduleId === schedule.id}
                                className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-cyan-900 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                              >
                                {runningScheduleId === schedule.id
                                  ? "Running..."
                                  : "Run Now"}
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleSchedule(schedule)}
                              disabled={updatingScheduleId === schedule.id}
                              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                            >
                              {updatingScheduleId === schedule.id
                                ? "Updating..."
                                : schedule.isActive
                                  ? "Pause"
                                  : "Resume"}
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule)}
                              disabled={deletingScheduleId === schedule.id}
                              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                            >
                              {deletingScheduleId === schedule.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

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
                value={datePreset}
                onChange={(e) => {
                  const value = e.target.value as ReportDatePreset;
                  setDatePreset(value);
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
                onChange={(e) => {
                  setDatePreset("custom");
                  setReportParams({
                    ...reportParams,
                    startDate: e.target.value,
                  });
                }}
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
                onChange={(e) => {
                  setDatePreset("custom");
                  setReportParams({ ...reportParams, endDate: e.target.value });
                }}
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

          {validationMessage && (
            <div className="rounded-md border border-red-800 bg-red-950/40 p-4 text-sm text-red-100">
              {validationMessage}
            </div>
          )}

          <div className="rounded-md border border-gray-700 bg-gray-900/40 p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <div>
                <h5 className="text-sm font-medium text-white">
                  Export Columns
                </h5>
                <p className="text-xs text-gray-400">
                  Choose which preview columns are included in CSV, Excel, and PDF exports.
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

          {/* Generate Report & Export (real API, no mock) */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={emailReport}
                onChange={(e) => setEmailReport(e.target.checked)}
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
                  setReportParams((p) => ({ ...p, format: "csv" }));
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
                  setReportParams((p) => ({ ...p, format: "xlsx" }));
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
                  setReportParams((p) => ({ ...p, format: "pdf" }));
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
      <div className="print-report-preview bg-gray-800 rounded-lg shadow border border-gray-700">
        <div className="print-only print-report-header">
          <div className="print-report-brand">CLIRDEC:PRESENCE</div>
          <h1 className="print-report-title">
            {reportTypeLabels[reportParams.type]}
          </h1>
          <div className="print-report-meta">
            <div className="print-report-meta-item">
              <span>Report Type</span>
              <strong>{reportTypeLabels[reportParams.type]}</strong>
            </div>
            <div className="print-report-meta-item">
              <span>Date Range</span>
              <strong>
                {formatDateLabel(reportParams.startDate)} to{" "}
                {formatDateLabel(reportParams.endDate)}
              </strong>
            </div>
            <div className="print-report-meta-item">
              <span>Subject</span>
              <strong>
                {selectedSubject
                  ? `${selectedSubject.code} - ${selectedSubject.name}`
                  : "All Subjects"}
              </strong>
            </div>
            <div className="print-report-meta-item">
              <span>Class Section</span>
              <strong>
                {selectedClassroom
                  ? `${selectedClassroom.name} - ${selectedClassroom.location}`
                  : "All Sections"}
              </strong>
            </div>
            <div className="print-report-meta-item">
              <span>Generated</span>
              <strong>{printTimestampLabel}</strong>
            </div>
            <div className="print-report-meta-item">
              <span>Generated By</span>
              <strong>{generatedByLabel}</strong>
            </div>
          </div>
          <p className="print-report-summary">
            Live preview contains {previewData.length.toLocaleString()} rows from{" "}
            {pagination.total.toLocaleString()} matching records.
          </p>
          {user?.role === "faculty" && (
            <p className="print-report-scope">
              Faculty scope: limited to your assigned schedules.
            </p>
          )}
        </div>
        <div className="print-only-grid print-overview-grid">
          {overviewCards.map((item) => (
            <div key={item.label} className="print-overview-card">
              <div className="print-overview-value">{item.value}</div>
              <div className="print-overview-label">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="screen-only px-6 py-4 border-b border-gray-700">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLastUpdated(new Date());
                  window.setTimeout(() => window.print(), 0);
                }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-medium"
              >
                Print Preview
              </button>
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
        </div>
        <div className="print-report-table-wrap overflow-x-auto">
          <table className="print-report-table min-w-full divide-y divide-gray-700">
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
        <div className="print-only print-report-footer">
          <span>Confidential Academic Record</span>
          <span>Page printed {printTimestampLabel}</span>
          <span>Generated from live preview; exports may include all matching records.</span>
        </div>
      </div>

      {/* Pagination Controls */}
      {pagination.total > pagination.limit && (
        <div className="screen-only flex items-center justify-between px-6 py-3 bg-gray-800 border-t border-gray-700">
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
      <div className="screen-only grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="screen-only bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-lg font-medium text-white">Report History</h4>
            <p className="text-sm text-gray-400">
              {reportHistoryPagination.total.toLocaleString()} matching reports
              with filters, format, owner, and row count.
            </p>
          </div>
          <button
            onClick={() =>
              loadReportHistory(
                reportHistoryFilters,
                reportHistoryPagination.page,
              )
            }
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
        <div className="mb-4 rounded-md border border-gray-700 bg-gray-900/40 p-4">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h5 className="text-sm font-medium text-white">
                History Filters
              </h5>
              <p className="text-xs text-gray-500">
                Find reports by type, format, source, status, owner, or date.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadReportHistory(reportHistoryFilters, 1)}
                className="rounded bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-700"
              >
                Apply Filters
              </button>
              <button
                onClick={resetReportHistoryFilters}
                className="rounded bg-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-600"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label
                htmlFor="history-filter-type"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Report Type
              </label>
              <select
                id="history-filter-type"
                value={reportHistoryFilters.type}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    type: event.target.value as ReportHistoryFilters["type"],
                  }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All types</option>
                <option value="attendance">Attendance</option>
                <option value="students">Students</option>
                <option value="classroom">Classroom</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="history-filter-format"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Format
              </label>
              <select
                id="history-filter-format"
                value={reportHistoryFilters.format}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    format: event.target.value as ReportHistoryFilters["format"],
                  }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All formats</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="history-filter-source"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Source
              </label>
              <select
                id="history-filter-source"
                value={reportHistoryFilters.source}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    source:
                      event.target.value as ReportHistoryFilters["source"],
                  }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All sources</option>
                <option value="manual">Manual export</option>
                <option value="email">Email export</option>
                <option value="quick">Quick report</option>
                <option value="scheduled">Scheduled report</option>
                <option value="download-again">Download again</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="history-filter-status"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Status
              </label>
              <select
                id="history-filter-status"
                value={reportHistoryFilters.status}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    status:
                      event.target.value as ReportHistoryFilters["status"],
                  }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="history-filter-start"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                From
              </label>
              <input
                id="history-filter-start"
                type="date"
                value={reportHistoryFilters.startDate}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label
                htmlFor="history-filter-end"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                To
              </label>
              <input
                id="history-filter-end"
                type="date"
                value={reportHistoryFilters.endDate}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="md:col-span-3 xl:col-span-6">
              <label
                htmlFor="history-filter-generated-by"
                className="mb-1 block text-xs font-medium text-gray-400"
              >
                Generated By
              </label>
              <input
                id="history-filter-generated-by"
                type="text"
                value={reportHistoryFilters.generatedBy}
                onChange={(event) =>
                  setReportHistoryFilters((current) => ({
                    ...current,
                    generatedBy: event.target.value,
                  }))
                }
                placeholder="Name, email, or user ID"
                className="w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                {[
                  "Type",
                  "Filters",
                  "Format",
                  "Generated By",
                  "Timestamp",
                  "Records",
                  "Actions",
                ].map((column) => (
                  <th
                    key={column}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {reportHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No reports match the current history filters.
                  </td>
                </tr>
              ) : (
                reportHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-white capitalize">
                      {item.reportType}
                      <div className="text-xs text-gray-500">
                        {formatHistorySource(item)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {[
                        item.parameters?.subjectLabel || "All Subjects",
                        item.parameters?.classroomLabel || "All Sections",
                        item.parameters?.startDate && item.parameters?.endDate
                          ? `${item.parameters.startDate} to ${item.parameters.endDate}`
                          : "All Dates",
                      ].join(" | ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-cyan-300 uppercase">
                      {item.parameters?.format || item.filePath?.split(".").pop() || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {item.generatedBy?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                      {new Date(item.generatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {Number(item.recordCount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedHistoryItem(item)}
                          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleDownloadHistoryReport(item)}
                          disabled={downloadingHistoryId === item.id}
                          className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-3 py-1 rounded text-xs font-medium whitespace-nowrap"
                        >
                          {downloadingHistoryId === item.id
                            ? "Downloading..."
                            : "Download Again"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-700 pt-4 text-sm text-gray-400 md:flex-row md:items-center md:justify-between">
          <div>
            Showing {reportHistoryStart.toLocaleString()} to{" "}
            {reportHistoryEnd.toLocaleString()} of{" "}
            {reportHistoryPagination.total.toLocaleString()} matching reports
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                loadReportHistory(
                  reportHistoryFilters,
                  reportHistoryPagination.page - 1,
                )
              }
              disabled={reportHistoryPagination.page <= 1}
              className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
            >
              Previous
            </button>
            <span>
              Page {reportHistoryPagination.page} of {reportHistoryPageCount}
            </span>
            <button
              onClick={() =>
                loadReportHistory(
                  reportHistoryFilters,
                  reportHistoryPagination.page + 1,
                )
              }
              disabled={reportHistoryPagination.page >= reportHistoryPageCount}
              className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedHistoryItem && (
        <div
          className="screen-only fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-history-details-title"
          onClick={() => setSelectedHistoryItem(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-700 p-5">
              <div>
                <h4
                  id="report-history-details-title"
                  className="text-lg font-semibold text-white"
                >
                  Report History Details
                </h4>
                <p className="mt-1 text-sm text-gray-400">
                  Audit details for report #{selectedHistoryItem.id}.
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="rounded bg-gray-700 px-3 py-1 text-sm font-medium text-white hover:bg-gray-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  {
                    label: "Report Type",
                    value: getHistoryReportType(selectedHistoryItem),
                  },
                  {
                    label: "Format",
                    value: getHistoryFormat(selectedHistoryItem),
                  },
                  {
                    label: "Source",
                    value: formatHistorySource(selectedHistoryItem),
                  },
                  {
                    label: "Generated",
                    value: formatDateTimeLabel(selectedHistoryItem.generatedAt),
                  },
                  {
                    label: "Generated By",
                    value:
                      selectedHistoryItem.generatedBy?.name ||
                      selectedHistoryItem.generatedBy?.email ||
                      "Unknown",
                  },
                  {
                    label: "Records",
                    value: Number(
                      selectedHistoryItem.recordCount || 0,
                    ).toLocaleString(),
                  },
                ].map((detail) => (
                  <div
                    key={detail.label}
                    className="rounded border border-gray-700 bg-gray-900/50 p-3"
                  >
                    <div className="text-xs font-medium uppercase text-gray-500">
                      {detail.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-100">
                      {detail.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded border border-gray-700 bg-gray-900/40 p-4">
                  <h5 className="text-sm font-medium text-white">
                    Saved Filters
                  </h5>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Date range</dt>
                      <dd className="text-right text-gray-200">
                        {selectedHistoryItem.parameters?.startDate &&
                        selectedHistoryItem.parameters?.endDate
                          ? `${formatDateLabel(
                              selectedHistoryItem.parameters.startDate,
                            )} to ${formatDateLabel(
                              selectedHistoryItem.parameters.endDate,
                            )}`
                          : "All Dates"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Subject</dt>
                      <dd className="text-right text-gray-200">
                        {selectedHistoryItem.parameters?.subjectLabel ||
                          "All Subjects"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Class section</dt>
                      <dd className="text-right text-gray-200">
                        {selectedHistoryItem.parameters?.classroomLabel ||
                          "All Sections"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Scope</dt>
                      <dd className="text-right text-gray-200">
                        {selectedHistoryItem.parameters?.scope ||
                          (selectedHistoryItem.generatedBy?.id
                            ? "User-accessible records"
                            : "Not recorded")}
                      </dd>
                    </div>
                    {selectedHistoryItem.parameters?.scheduleName && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-gray-500">Schedule</dt>
                        <dd className="text-right text-gray-200">
                          {selectedHistoryItem.parameters.scheduleName}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="rounded border border-gray-700 bg-gray-900/40 p-4">
                  <h5 className="text-sm font-medium text-white">
                    File and Status
                  </h5>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Status</dt>
                      <dd>{renderStatus(selectedHistoryItem.status)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Filename</dt>
                      <dd className="text-right text-gray-200">
                        {getHistoryFilename(selectedHistoryItem)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Stored path</dt>
                      <dd className="mt-1 break-all rounded bg-gray-950 p-2 text-xs text-gray-300">
                        {selectedHistoryItem.filePath || "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Status note</dt>
                      <dd className="mt-1 rounded bg-gray-950 p-2 text-xs text-gray-300">
                        {selectedHistoryItem.errorMessage ||
                          "No error or status note recorded."}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded border border-gray-700 bg-gray-900/40 p-4">
                <h5 className="text-sm font-medium text-white">
                  Selected Columns
                </h5>
                {selectedHistoryItem.parameters?.columns?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedHistoryItem.parameters.columns.map((column) => (
                      <span
                        key={column}
                        className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">
                    No custom column list was recorded for this report.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleDownloadHistoryReport(selectedHistoryItem)}
                  disabled={downloadingHistoryId === selectedHistoryItem.id}
                  className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:bg-cyan-800"
                >
                  {downloadingHistoryId === selectedHistoryItem.id
                    ? "Downloading..."
                    : "Download Again"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="screen-only bg-gray-800 rounded-lg p-4 border border-gray-700">
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
