import type {
  ClassroomOption,
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
} from "./types";
import { getFilenameFromDisposition } from "./reportUtils";

interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  total?: number;
  summary?: SummaryItem[];
}

interface ReportPresetMutation {
  name: string;
  visibility: ReportPresetVisibility;
  parameters?: ReportPresetParameters;
}

interface ReportScheduleMutation {
  name: string;
  presetId: string;
  presetName: string;
  frequency: ReportScheduleFrequency;
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  format: ReportParams["format"];
  recipientEmail: string;
  isActive: boolean;
}

const requestJson = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> => {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
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

export const fetchReportPreview = (
  queryParams: URLSearchParams,
): Promise<ApiResponse<Record<string, string>[]>> =>
  requestJson(`/api/reports/preview?${queryParams}`);

export const fetchReportHistory = (
  queryParams: URLSearchParams,
): Promise<ApiResponse<ReportHistoryItem[]>> =>
  requestJson(`/api/reports/history?${queryParams}`);

export const fetchReportHistoryExport = (
  queryParams: URLSearchParams,
): Promise<Response> =>
  fetch(`/api/reports/history/export?${queryParams}`, {
    credentials: "include",
  });

export const fetchReportPresets = (): Promise<
  ApiResponse<ReportPresetItem[]>
> => requestJson("/api/reports/presets");

export const fetchReportSchedules = (): Promise<
  ApiResponse<ReportScheduleItem[]>
> => requestJson("/api/reports/schedules");

export const fetchRealTimeStats = (): Promise<
  ApiResponse<{
    todayPresent?: number;
    todayAbsent?: number;
    todayLate?: number;
    activeSessions?: number;
  }>
> => requestJson("/api/reports/real-time-stats");

export const fetchSubjects = (): Promise<ApiResponse<SubjectOption[]>> =>
  requestJson("/api/subjects");

export const fetchClassrooms = (): Promise<ApiResponse<ClassroomOption[]>> =>
  requestJson("/api/classrooms");

export const seedDemoData = (): Promise<ApiResponse> =>
  requestJson("/api/reports/seed-demo-data", { method: "POST" });

export const resetDemoData = (): Promise<ApiResponse> =>
  requestJson("/api/reports/seed-demo-data", { method: "DELETE" });

export const createReportPreset = (
  body: ReportPresetMutation,
): Promise<ApiResponse<ReportPresetItem>> =>
  requestJson("/api/reports/presets", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateReportPreset = (
  presetId: number,
  body: ReportPresetMutation,
): Promise<ApiResponse> =>
  requestJson(`/api/reports/presets/${presetId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const duplicateReportPreset = (
  presetId: number,
  body: Omit<ReportPresetMutation, "parameters">,
): Promise<ApiResponse<ReportPresetItem>> =>
  requestJson(`/api/reports/presets/${presetId}/duplicate`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteReportPreset = (presetId: number): Promise<ApiResponse> =>
  requestJson(`/api/reports/presets/${presetId}`, { method: "DELETE" });

export const createReportSchedule = (
  body: ReportScheduleMutation,
): Promise<ApiResponse> =>
  requestJson("/api/reports/schedules", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateReportSchedule = (
  scheduleId: number,
  body: Partial<Pick<ReportScheduleItem, "isActive">>,
): Promise<ApiResponse> =>
  requestJson(`/api/reports/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const triggerReportSchedule = (
  scheduleId: number,
): Promise<ApiResponse> =>
  requestJson(`/api/reports/schedules/${scheduleId}/trigger`, {
    method: "POST",
  });

export const deleteReportSchedule = (
  scheduleId: number,
): Promise<ApiResponse> =>
  requestJson(`/api/reports/schedules/${scheduleId}`, { method: "DELETE" });
