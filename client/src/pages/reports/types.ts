export interface ReportParams {
  format: "csv" | "xlsx" | "pdf";
  startDate?: string;
  endDate?: string;
  subjectId?: number;
  classroomId?: number;
  type: "attendance" | "students" | "classroom";
}

export interface ReportDownloadPayload extends ReportParams {
  quickReportType?: "daily" | "weekly" | "analytics";
  columns?: string[];
  emailToMe?: boolean;
  source?: "manual" | "email" | "quick" | "scheduled" | "download-again";
}

export interface SummaryItem {
  label: string;
  value: string;
}

export interface SubjectOption {
  id: number;
  code: string;
  name: string;
}

export interface ClassroomOption {
  id: number;
  name: string;
  location: string;
}

export interface ReportHistoryItem {
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

export type ReportDatePreset = "today" | "week" | "month" | "custom";
export type ReportPresetVisibility = "personal" | "shared" | "admin";
export type ReportScheduleFrequency = "daily" | "weekly" | "monthly";
export type ReportHistorySource =
  | "manual"
  | "email"
  | "quick"
  | "scheduled"
  | "download-again";

export interface ReportPresetParameters extends ReportParams {
  datePreset?: ReportDatePreset;
  columns?: string[];
}

export interface ReportHistoryFilters {
  type: "" | ReportParams["type"];
  format: "" | ReportParams["format"];
  source: "" | ReportHistorySource;
  status: "" | "completed" | "failed" | "pending";
  generatedBy: string;
  startDate: string;
  endDate: string;
}

export interface ReportPresetItem {
  id: number | string;
  name: string;
  visibility: ReportPresetVisibility;
  isDefault?: boolean;
  createdBy?: number;
  parameters: ReportPresetParameters;
}

export interface ReportScheduleItem {
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
