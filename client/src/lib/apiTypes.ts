export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type ApiRequestBody = JsonObject | JsonValue[] | FormData | undefined;
export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue>;

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

export interface ApiRequestError extends Error {
  status?: number;
  data?: unknown;
}

export type UserRole = "admin" | "faculty" | "student" | string;

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  facultyId?: string | null;
  department?: string | null;
  gender?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface LoginResult {
  user?: CurrentUser;
  token?: string;
  [key: string]: unknown;
}

export interface UserAccount extends CurrentUser {
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: number;
  studentId: string;
  name: string;
  email?: string | null;
  rfidUid?: string | null;
  parentEmail?: string | null;
  year?: string | number | null;
  section?: string | null;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Subject {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  credits?: number | null;
  [key: string]: unknown;
}

export interface Classroom {
  id: number;
  name: string;
  type?: "lecture" | "laboratory" | string;
  location?: string | null;
  capacity?: number | null;
  [key: string]: unknown;
}

export interface Schedule {
  id: number;
  subjectId: number;
  classroomId: number;
  facultyId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  semester: string;
  academicYear: string;
  subject?: Subject;
  classroom?: Classroom;
  faculty?: UserAccount;
  [key: string]: unknown;
}

export interface ScheduleConflict {
  type?: string;
  message?: string;
  schedule?: Schedule;
  [key: string]: unknown;
}

export interface ClassSession {
  id: number;
  scheduleId?: number;
  date?: string;
  status?: string;
  subject?: Subject;
  classroom?: Classroom;
  [key: string]: unknown;
}

export interface AttendanceRecord {
  id?: number;
  status?: string;
  studentId?: number;
  classSessionId?: number;
  record?: {
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ReportParams {
  type: "attendance" | "students" | "classroom";
  format: "pdf" | "csv" | "xlsx";
  startDate?: string;
  endDate?: string;
  classroomId?: number;
  subjectId?: number;
  columns?: string[];
  emailToMe?: boolean;
  source?: string;
}

export interface ReportHistoryItem {
  id: number;
  reportType: string;
  generatedAt: string;
  status: string;
  recordCount: number;
  filePath?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ReportPresetItem {
  id: number | string;
  name: string;
  visibility: "personal" | "shared" | "admin";
  isDefault?: boolean;
  createdBy?: number;
  parameters: ReportParams & {
    datePreset?: "today" | "week" | "month" | "custom";
  };
  [key: string]: unknown;
}

export interface ReportScheduleItem {
  id: number;
  name: string;
  presetId: string;
  presetName: string;
  frequency: "daily" | "weekly" | "monthly";
  timeOfDay: string;
  format: ReportParams["format"];
  recipientEmail: string;
  isActive: boolean;
  nextRunAt: string;
  lastStatus: string;
  [key: string]: unknown;
}

export interface ReportPreviewRow {
  [column: string]: string;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportPreviewResponse {
  data: ReportPreviewRow[];
  total?: number;
  summary?: ReportSummaryItem[];
}

export interface RealTimeStats {
  todayPresent?: number;
  todayAbsent?: number;
  todayLate?: number;
  activeSessions?: number;
}
