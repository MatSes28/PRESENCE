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
import { api, type ApiResponse } from "../../lib/api";
import { triggerOn401 } from "../../lib/onUnauthorized";
import { getFilenameFromDisposition } from "./reportUtils";

interface ReportApiResponse<T = unknown> extends ApiResponse<T> {
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

const asReportResponse = <T>(
  response: ApiResponse<T>,
): ReportApiResponse<T> => response as ReportApiResponse<T>;

const parseDownloadError = async (
  response: Response,
  fallbackMessage: string,
) => {
  if (response.status === 401) {
    triggerOn401();
  }

  const contentType = response.headers.get("content-type") || "";
  const errorData = contentType.includes("application/json")
    ? ((await response.json()) as { message?: string })
    : { message: await response.text() };

  return new Error(errorData.message || fallbackMessage);
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
    throw await parseDownloadError(response, "Failed to generate report");
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

export const fetchReportPreview = async (
  queryParams: URLSearchParams,
): Promise<ReportApiResponse<Record<string, string>[]>> =>
  asReportResponse(
    await api.get<Record<string, string>[]>(
      `/reports/preview?${queryParams}`,
    ),
  );

export const fetchReportHistory = async (
  queryParams: URLSearchParams,
): Promise<ReportApiResponse<ReportHistoryItem[]>> =>
  asReportResponse(
    await api.get<ReportHistoryItem[]>(`/reports/history?${queryParams}`),
  );

export const fetchReportHistoryExport = async (
  queryParams: URLSearchParams,
): Promise<Response> => {
  const response = await fetch(`/api/reports/history/export?${queryParams}`, {
    credentials: "include",
  });
  if (response.status === 401) {
    triggerOn401();
  }
  return response;
};

export const fetchReportPresets = (): Promise<
  ReportApiResponse<ReportPresetItem[]>
> => api.get<ReportPresetItem[]>("/reports/presets").then(asReportResponse);

export const fetchReportSchedules = (): Promise<
  ReportApiResponse<ReportScheduleItem[]>
> => api.get<ReportScheduleItem[]>("/reports/schedules").then(asReportResponse);

export const fetchRealTimeStats = (): Promise<
  ReportApiResponse<{
    todayPresent?: number;
    todayAbsent?: number;
    todayLate?: number;
    activeSessions?: number;
  }>
> =>
  api
    .get<{
      todayPresent?: number;
      todayAbsent?: number;
      todayLate?: number;
      activeSessions?: number;
    }>("/reports/real-time-stats")
    .then(asReportResponse);

export const fetchSubjects = (): Promise<ReportApiResponse<SubjectOption[]>> =>
  api.get<SubjectOption[]>("/subjects").then(asReportResponse);

export const fetchClassrooms = (): Promise<ApiResponse<ClassroomOption[]>> =>
  api.get<ClassroomOption[]>("/classrooms").then(asReportResponse);

export const createReportPreset = (
  body: ReportPresetMutation,
): Promise<ReportApiResponse<ReportPresetItem>> =>
  api.post<ReportPresetItem>("/reports/presets", body).then(asReportResponse);

export const updateReportPreset = (
  presetId: number,
  body: ReportPresetMutation,
): Promise<ApiResponse> =>
  api.put(`/reports/presets/${presetId}`, body);

export const duplicateReportPreset = (
  presetId: number,
  body: Omit<ReportPresetMutation, "parameters">,
): Promise<ReportApiResponse<ReportPresetItem>> =>
  api
    .post<ReportPresetItem>(`/reports/presets/${presetId}/duplicate`, body)
    .then(asReportResponse);

export const deleteReportPreset = (presetId: number): Promise<ApiResponse> =>
  api.delete(`/reports/presets/${presetId}`);

export const createReportSchedule = (
  body: ReportScheduleMutation,
): Promise<ApiResponse> =>
  api.post("/reports/schedules", body);

export const updateReportSchedule = (
  scheduleId: number,
  body: Partial<Pick<ReportScheduleItem, "isActive">>,
): Promise<ApiResponse> =>
  api.put(`/reports/schedules/${scheduleId}`, body);

export const triggerReportSchedule = (
  scheduleId: number,
): Promise<ApiResponse> =>
  api.post(`/reports/schedules/${scheduleId}/trigger`);

export const deleteReportSchedule = (
  scheduleId: number,
): Promise<ApiResponse> =>
  api.delete(`/reports/schedules/${scheduleId}`);
