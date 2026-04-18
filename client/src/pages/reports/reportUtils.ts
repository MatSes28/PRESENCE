import type {
  ReportDatePreset,
  ReportDownloadPayload,
  ReportHistoryFilters,
  ReportHistoryItem,
  ReportParams,
  ReportScheduleItem,
} from "./types";

export const reportTypeLabels: Record<ReportParams["type"], string> = {
  attendance: "Attendance Report",
  students: "Student Report",
  classroom: "Classroom Report",
};

export const emptyReportHistoryFilters: ReportHistoryFilters = {
  type: "",
  format: "",
  source: "",
  status: "",
  generatedBy: "",
  startDate: "",
  endDate: "",
};

export const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const fallbackPreviewColumns: Record<ReportParams["type"], string[]> = {
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

export const toTitle = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getFilenameFromDisposition = (disposition: string | null) => {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  }

  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? null;
};

export const triggerReportDownload = async (
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

export const formatDateLabel = (value?: string) => {
  if (!value) return "Any date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const dateRangeError = (startDate?: string, endDate?: string) => {
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

export const getDateRangeForPreset = (preset: ReportDatePreset) => {
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

export const formatDateTimeLabel = (value?: string | null) => {
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

export const formatScheduleCadence = (schedule: ReportScheduleItem) => {
  if (schedule.frequency === "daily") {
    return `Daily at ${schedule.timeOfDay}`;
  }

  if (schedule.frequency === "weekly") {
    return `${dayNames[schedule.dayOfWeek ?? 1]} at ${schedule.timeOfDay}`;
  }

  return `Monthly on day ${schedule.dayOfMonth ?? 1} at ${schedule.timeOfDay}`;
};

export const formatHistorySource = (item: ReportHistoryItem) => {
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

export const getHistoryReportType = (item: ReportHistoryItem) => {
  const type =
    item.parameters?.type === "attendance" ||
    item.parameters?.type === "students" ||
    item.parameters?.type === "classroom"
      ? item.parameters.type
      : (item.reportType as ReportParams["type"]);

  return reportTypeLabels[type] || toTitle(item.reportType);
};

export const getHistoryFormat = (item: ReportHistoryItem) =>
  (
    item.parameters?.format ||
    item.filePath?.split(".").pop() ||
    "unknown"
  ).toUpperCase();

export const getHistoryFilename = (item: ReportHistoryItem) =>
  item.filePath?.split(/[\\/]/).pop() || "Not recorded";
