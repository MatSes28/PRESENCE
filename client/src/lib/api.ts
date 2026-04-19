import { triggerOn401 } from "./onUnauthorized";
import type {
  ApiRequestError,
  ApiResponse,
  AttendanceRecord,
  Classroom,
  ClassSession,
  CurrentUser,
  JsonObject,
  JsonValue,
  LoginResult,
  QueryParams,
  ReportParams,
  Schedule,
  ScheduleConflict,
  Student,
  Subject,
  UserAccount,
} from "./apiTypes";

const API_BASE_URL = window.location.origin;

export type { ApiRequestError, ApiResponse } from "./apiTypes";

export function getApiPayload<T>(response: ApiResponse<T>): T;
export function getApiPayload<T>(response: T): T;
export function getApiPayload<T = JsonObject>(response: ApiResponse<T> | T): T {
  if (response && typeof response === "object" && "data" in response) {
    const apiResponse = response as ApiResponse<T>;
    return (apiResponse.data ?? response) as T;
  }

  return response as T;
}

const createApiError = (
  message: string,
  status?: number,
  data?: unknown,
): ApiRequestError => {
  const error = new Error(message) as ApiRequestError;
  error.status = status;
  error.data = data;
  return error;
};

const toQueryString = (params?: QueryParams) => {
  if (!params) return "";

  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.set(key, String(value));
    }
  });

  const query = queryParams.toString();
  return query ? `?${query}` : "";
};

const createRequestBody = (data?: unknown) => {
  if (data === undefined) return undefined;
  return data instanceof FormData ? data : JSON.stringify(data);
};

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async get<T = JsonObject>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request(endpoint, { method: "GET" });
  }

  async post<T = JsonObject, TBody = unknown>(
    endpoint: string,
    data?: TBody,
  ): Promise<ApiResponse<T>> {
    return this.request(endpoint, {
      method: "POST",
      body: createRequestBody(data),
    });
  }

  async put<T = JsonObject, TBody = unknown>(
    endpoint: string,
    data?: TBody,
  ): Promise<ApiResponse<T>> {
    return this.request(endpoint, {
      method: "PUT",
      body: createRequestBody(data),
    });
  }

  async delete<T = JsonObject>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request(endpoint, { method: "DELETE" });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}/api${endpoint}`;

    const config: RequestInit = {
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await response.json()) as ApiResponse<T>)
        : ({ success: response.ok, message: await response.text() } as ApiResponse<T>);

      if (!response.ok) {
        if (response.status === 401) {
          triggerOn401();
        }
        throw createApiError(
          data.message || `Request failed with status ${response.status}`,
          response.status,
          data,
        );
      }

      return data;
    } catch (error) {
      const apiError = error as ApiRequestError;
      if (!(apiError.status === 401 && endpoint === "/auth/me")) {
        console.error("API request failed:", error);
      }
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse<LoginResult>> {
    return this.request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<ApiResponse> {
    return this.request("/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser(): Promise<ApiResponse<CurrentUser>> {
    return this.request<CurrentUser>("/auth/me");
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(
    token: string,
    email: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<ApiResponse> {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, email, newPassword, confirmPassword }),
    });
  }

  async updateProfile(profileData: {
    name: string;
    email: string;
  }): Promise<ApiResponse<CurrentUser>> {
    return this.request<CurrentUser>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  }

  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse> {
    return this.request("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify(passwordData),
    });
  }

  async updateUserSettings(settings: {
    emailNotifications: boolean;
    darkMode: boolean;
    language: string;
  }): Promise<ApiResponse> {
    return this.request("/auth/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // Users endpoints (admin only)
  async getUsers(): Promise<ApiResponse<UserAccount[]>> {
    return this.request<UserAccount[]>("/users");
  }

  async createUser(userData: {
    email: string;
    name: string;
    role: string;
    password: string;
    facultyId?: string;
    department?: string;
    gender?: string;
  }): Promise<ApiResponse<UserAccount>> {
    return this.request<UserAccount>("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(
    id: number,
    userData: Partial<{
      email: string;
      name: string;
      role: string;
      facultyId?: string;
      department?: string;
      gender?: string;
    }>,
  ): Promise<ApiResponse<UserAccount>> {
    return this.request<UserAccount>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: number): Promise<ApiResponse> {
    return this.request(`/users/${id}`, {
      method: "DELETE",
    });
  }

  // Computers endpoints
  async getComputers() {
    return this.request("/computers");
  }

  async getComputer(id: number) {
    return this.request(`/computers/${id}`);
  }

  async createComputers(classroomId: number, computerCount: number) {
    return this.request("/computers", {
      method: "POST",
      body: JSON.stringify({ classroomId, computerCount }),
    });
  }

  async updateComputer(
    id: number,
    computer: Partial<{
      name: string;
      ipAddress: string;
      macAddress: string;
      status: string;
    }>,
  ) {
    return this.request(`/computers/${id}`, {
      method: "PUT",
      body: JSON.stringify(computer),
    });
  }

  async deleteComputer(id: number) {
    return this.request(`/computers/${id}`, {
      method: "DELETE",
    });
  }

  async getComputerAssignments() {
    return this.request("/computers/assignments");
  }

  async getComputerStatus() {
    return this.request("/computers/status");
  }

  async getMaintenanceRecords() {
    return this.request("/computers/maintenance");
  }

  async scheduleMaintenance(maintenance: {
    computerId: number;
    maintenanceType: string;
    description: string;
    scheduledDate?: string;
    cost?: number;
    parts?: JsonValue;
    notes?: string;
  }) {
    return this.request("/computers/maintenance", {
      method: "POST",
      body: JSON.stringify(maintenance),
    });
  }

  async updateMaintenance(
    id: number,
    maintenance: Partial<{
      status: string;
      completedDate?: string;
      cost?: number;
      parts?: JsonValue;
      notes?: string;
    }>,
  ) {
    return this.request(`/computers/maintenance/${id}`, {
      method: "PUT",
      body: JSON.stringify(maintenance),
    });
  }

  async deleteMaintenance(id: number) {
    return this.request(`/computers/maintenance/${id}`, {
      method: "DELETE",
    });
  }

  async getComputerMaintenance(computerId: number) {
    return this.request(`/computers/${computerId}/maintenance`);
  }

  async assignComputer(assignment: {
    computerId: number;
    studentId: number;
    classSessionId: number;
  }) {
    return this.request("/computers/assign", {
      method: "POST",
      body: JSON.stringify(assignment),
    });
  }

  async releaseComputer(assignmentId: number) {
    return this.request(`/computers/release/${assignmentId}`, {
      method: "POST",
    });
  }

  async releaseAllComputers(sessionId: number) {
    return this.request(`/computers/release-all`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
  }

  async assignNextAvailable(computerIds: number[], sessionId: number) {
    return this.request(`/computers/assign-next`, {
      method: "POST",
      body: JSON.stringify({ computerIds, sessionId }),
    });
  }

  // Students endpoints
  async getStudents(): Promise<ApiResponse<Student[]>> {
    return this.request<Student[]>("/students");
  }

  async getStudent(id: number): Promise<ApiResponse<Student>> {
    const response = await this.request<Student>(`/students/${id}`);
    const student = response.data ?? (response.student as Student | undefined);
    return {
      ...response,
      data: student,
    };
  }

  // Subjects endpoints
  async getSubjects(): Promise<ApiResponse<Subject[]>> {
    return this.request<Subject[]>("/subjects");
  }

  async getSubject(id: number): Promise<ApiResponse<Subject>> {
    return this.request<Subject>(`/subjects/${id}`);
  }

  async createSubject(subject: {
    name: string;
    code: string;
    description?: string;
    credits?: number;
  }): Promise<ApiResponse<Subject>> {
    return this.request<Subject>("/subjects", {
      method: "POST",
      body: JSON.stringify(subject),
    });
  }

  async updateSubject(
    id: number,
    subject: Partial<{
      name: string;
      code: string;
      description: string;
      credits: number;
    }>,
  ): Promise<ApiResponse<Subject>> {
    return this.request<Subject>(`/subjects/${id}`, {
      method: "PUT",
      body: JSON.stringify(subject),
    });
  }

  async deleteSubject(id: number): Promise<ApiResponse> {
    return this.request(`/subjects/${id}`, {
      method: "DELETE",
    });
  }

  async createStudent(student: {
    studentId: string;
    name: string;
    email?: string;
    rfidUid?: string;
    parentEmail?: string;
  }): Promise<ApiResponse<Student>> {
    const response = await this.request<Student>("/students", {
      method: "POST",
      body: JSON.stringify(student),
    });
    const createdStudent =
      response.data ?? (response.student as Student | undefined);
    return {
      ...response,
      data: createdStudent,
    };
  }

  async updateStudent(
    id: number,
    student: Partial<{
      name: string;
      email: string;
      rfidUid: string;
      parentEmail: string;
      year: string | number;
      section: string;
      isActive: boolean;
    }>,
  ): Promise<ApiResponse<Student>> {
    const response = await this.request<Student>(`/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(student),
    });
    const updatedStudent =
      response.data ?? (response.student as Student | undefined);
    return {
      ...response,
      data: updatedStudent,
    };
  }

  async deleteStudent(id: number): Promise<ApiResponse> {
    return this.request(`/students/${id}`, {
      method: "DELETE",
    });
  }

  async getStudentAttendance(
    id: number,
    params?: { limit?: number; offset?: number },
  ): Promise<ApiResponse<AttendanceRecord[]> & { attendance: AttendanceRecord[] }> {
    const query = toQueryString(params);
    const response = await this.request<AttendanceRecord[]>(
      `/students/${id}/attendance${query}`,
    );
    const fallbackAttendance =
      "attendance" in response && Array.isArray(response.attendance)
        ? (response.attendance as AttendanceRecord[])
        : [];
    const attendance = response.data ?? fallbackAttendance;
    return {
      ...response,
      data: attendance,
      attendance,
    };
  }

  async assignRFID(id: number, rfidUid: string): Promise<ApiResponse<Student>> {
    return this.request<Student>(`/students/${id}/assign-rfid`, {
      method: "POST",
      body: JSON.stringify({ rfidUid }),
    });
  }

  // Enrollments endpoints
  async getEnrollments(): Promise<ApiResponse<unknown[]>> {
    return this.request<unknown[]>("/enrollments");
  }

  async createEnrollment(enrollment: {
    studentId: number;
    subjectId: number;
    semester: string;
    academicYear: string;
  }): Promise<ApiResponse> {
    return this.request("/enrollments", {
      method: "POST",
      body: JSON.stringify(enrollment),
    });
  }

  async bulkEnrollStudents(enrollments: {
    studentIds: number[];
    subjectId: number;
    semester: string;
    academicYear: string;
  }): Promise<ApiResponse> {
    return this.request("/enrollments/bulk", {
      method: "POST",
      body: JSON.stringify(enrollments),
    });
  }

  async deleteEnrollment(id: number): Promise<ApiResponse> {
    return this.request(`/enrollments/${id}`, {
      method: "DELETE",
    });
  }

  async unenrollStudent(
    studentId: number,
    subjectId: number,
  ): Promise<ApiResponse> {
    return this.request(`/enrollments/${studentId}/${subjectId}`, {
      method: "DELETE",
    });
  }

  async getSubjectStudents(
    subjectId: number,
  ): Promise<ApiResponse<unknown[]> & { enrollments: unknown[] }> {
    const response = await this.request<unknown[]>(
      `/enrollments/subject/${subjectId}`,
    );
    const fallbackEnrollments =
      "enrollments" in response && Array.isArray(response.enrollments)
        ? response.enrollments
        : [];
    const enrollments = response.data ?? fallbackEnrollments;
    return {
      ...response,
      data: enrollments,
      enrollments,
    };
  }

  async getEnrollmentsForStudent(
    studentId: number,
  ): Promise<ApiResponse<unknown[]> & { enrollments: unknown[] }> {
    const response = await this.request<unknown[]>(
      `/enrollments/student/${studentId}`,
    );
    const fallbackEnrollments =
      "enrollments" in response && Array.isArray(response.enrollments)
        ? response.enrollments
        : [];
    const enrollments = response.data ?? fallbackEnrollments;
    return {
      ...response,
      data: enrollments,
      enrollments,
    };
  }

  async simulateRFID(rfidUid: string) {
    return this.request("/attendance/simulate-rfid", {
      method: "POST",
      body: JSON.stringify({ rfidUid }),
    });
  }

  // RFID Tools (dashboard admin actions)
  async testRfidReader() {
    return this.request("/dashboard/rfid/test-reader", { method: "POST" });
  }
  async calibrateRfidSensors() {
    return this.request("/dashboard/rfid/calibrate-sensors", {
      method: "POST",
    });
  }
  async checkCardDatabase() {
    return this.request("/dashboard/rfid/check-card-database");
  }
  async resetDeviceCache() {
    return this.request("/dashboard/rfid/reset-device-cache", {
      method: "POST",
    });
  }
  async emergencyStopRfid() {
    return this.request("/dashboard/rfid/emergency-stop", { method: "POST" });
  }
  async resumeRfid() {
    return this.request("/dashboard/rfid/resume", { method: "POST" });
  }
  async getRfidEmergencyStatus() {
    return this.request("/dashboard/rfid/emergency-status");
  }
  async runRfidCalibration() {
    return this.request("/dashboard/rfid/run-calibration", { method: "POST" });
  }
  async getRfidCalibrationStatus() {
    return this.request("/dashboard/rfid/calibration-status");
  }

  async simulateSensor(sensorType: "entry" | "exit", distance?: number) {
    return this.request("/attendance/simulate-sensor", {
      method: "POST",
      body: JSON.stringify({ sensorType, distance }),
    });
  }

  async excuseAttendance(recordId: number, reason: string) {
    return this.request(`/attendance/${recordId}/excuse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async contactParent(studentId: number, message: string) {
    return this.request(`/attendance/${studentId}/contact`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  // Attendance endpoints
  async getAttendanceRecords(params?: {
    studentId?: number;
    classSessionId?: number;
    date?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<AttendanceRecord[]>> {
    const query = toQueryString(params);
    return this.request<AttendanceRecord[]>(`/attendance${query}`);
  }

  async getAttendanceStats(sessionId: number): Promise<ApiResponse> {
    return this.request(`/attendance/stats/${sessionId}`);
  }

  // Classrooms endpoints
  async getClassrooms(): Promise<ApiResponse<Classroom[]>> {
    return this.request<Classroom[]>("/classrooms");
  }

  async createClassroom(classroom: {
    name: string;
    type: "lecture" | "laboratory";
    location?: string;
    capacity?: number;
  }): Promise<ApiResponse<Classroom>> {
    return this.request<Classroom>("/classrooms", {
      method: "POST",
      body: JSON.stringify(classroom),
    });
  }

  async updateClassroom(
    id: number,
    classroom: Partial<{
      name: string;
      location: string;
      capacity?: number;
    }>,
  ): Promise<ApiResponse<Classroom>> {
    return this.request<Classroom>(`/classrooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(classroom),
    });
  }

  async deleteClassroom(id: number): Promise<ApiResponse> {
    return this.request(`/classrooms/${id}`, {
      method: "DELETE",
    });
  }

  // Schedules endpoints
  async getSchedules(): Promise<ApiResponse<Schedule[]>> {
    return this.request<Schedule[]>("/schedules");
  }

  async createSchedule(schedule: {
    subjectId: number;
    classroomId: number;
    facultyId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    semester: string;
    academicYear: string;
  }): Promise<ApiResponse<Schedule>> {
    return this.request<Schedule>("/schedules", {
      method: "POST",
      body: JSON.stringify(schedule),
    });
  }

  async updateSchedule(
    id: number,
    schedule: Partial<{
      subjectId: number;
      classroomId: number;
      facultyId: number;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      semester: string;
      academicYear: string;
    }>,
  ): Promise<ApiResponse<Schedule>> {
    return this.request<Schedule>(`/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(schedule),
    });
  }

  async deleteSchedule(id: number): Promise<ApiResponse> {
    return this.request(`/schedules/${id}`, {
      method: "DELETE",
    });
  }

  async checkScheduleConflicts(conflictData: {
    subjectId: number;
    classroomId: number;
    facultyId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    semester: string;
    academicYear: string;
    excludeId?: number;
  }): Promise<
    ApiResponse<ScheduleConflict[]> & {
      hasConflicts?: boolean;
      conflicts?: ScheduleConflict[];
    }
  > {
    return this.request<ScheduleConflict[]>("/schedules/check-conflicts", {
      method: "POST",
      body: JSON.stringify(conflictData),
    });
  }

  // Class Sessions endpoints
  async getClassSessions(): Promise<ApiResponse<ClassSession[]>> {
    return this.request<ClassSession[]>("/sessions");
  }

  async getClassSession(id: number): Promise<ApiResponse<ClassSession>> {
    return this.request<ClassSession>(`/sessions/${id}`);
  }

  async createClassSessionsForDate(
    date: string,
    scheduleId?: number,
  ): Promise<ApiResponse<ClassSession[]>> {
    return this.request<ClassSession[]>("/sessions/auto-create", {
      method: "POST",
      body: JSON.stringify({ date, scheduleId }),
    });
  }

  async activateSessions(scheduleId?: number): Promise<ApiResponse> {
    return this.request("/sessions/auto-activate", {
      method: "POST",
      body: JSON.stringify({ scheduleId }),
    });
  }

  async endSessions(): Promise<ApiResponse> {
    return this.request("/sessions/auto-end", {
      method: "POST",
    });
  }

  async updateSessionStatus(
    id: number,
    status: string,
  ): Promise<ApiResponse<ClassSession>> {
    return this.request<ClassSession>(`/sessions/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  // Reports endpoints
  async generateReport(params: ReportParams): Promise<ApiResponse> {
    return this.request("/reports/generate-report", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // IoT endpoints
  async getIoTDevices() {
    return this.request("/iot/devices");
  }

  async getDeviceStatus(deviceId: string) {
    return this.request(`/iot/devices/${deviceId}`);
  }

  async sendDeviceCommand(
    deviceId: string,
    command: string,
    params?: JsonObject,
  ) {
    return this.request(`/iot/devices/${deviceId}/command`, {
      method: "POST",
      body: JSON.stringify({ command, params }),
    });
  }

  // Smart Assignment endpoints
  async assignByPerformance(sessionId: number) {
    return this.request(`/computers/smart-assign/performance/${sessionId}`, {
      method: "POST",
    });
  }

  async assignByLearningStyle(sessionId: number) {
    return this.request(`/computers/smart-assign/learning-style/${sessionId}`, {
      method: "POST",
    });
  }

  async assignConflictFree(sessionId: number) {
    return this.request(`/computers/smart-assign/conflict-free/${sessionId}`, {
      method: "POST",
    });
  }

  async assignRandom(sessionId: number) {
    return this.request(`/computers/smart-assign/random/${sessionId}`, {
      method: "POST",
    });
  }

  async assignCustom(sessionId: number, criteria: JsonObject) {
    return this.request(`/computers/smart-assign/custom/${sessionId}`, {
      method: "POST",
      body: JSON.stringify(criteria),
    });
  }

  // AI Analytics endpoints
  async optimizeSeating(sessionId: number) {
    return this.request(`/ai-analytics/optimize-seating/${sessionId}`, {
      method: "POST",
    });
  }

  async predictPerformance(
    studentId: number,
    computerId: number,
    sessionId: number,
  ) {
    return this.request(
      `/ai-analytics/predict-performance/${studentId}/${computerId}/${sessionId}`,
    );
  }

  async detectConflicts(sessionId: number) {
    return this.request(`/ai-analytics/detect-conflicts/${sessionId}`, {
      method: "POST",
    });
  }

  async getLearningAnalytics(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = toQueryString(params);
    return this.request(`/ai-analytics/learning-analytics${query}`);
  }

  async getAIInsights(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = toQueryString(params);
    return this.request(`/ai-analytics/insights${query}`);
  }

  async getPerformanceTrends(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = toQueryString(params);
    return this.request(`/ai-analytics/performance-trends${query}`);
  }

  async getAttendancePatterns(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = toQueryString(params);
    return this.request(`/ai-analytics/attendance-patterns${query}`);
  }

  async getSeatingEffectiveness(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = toQueryString(params);
    return this.request(`/ai-analytics/seating-effectiveness${query}`);
  }

  // Dashboard analytics
  async getAnalytics(period: string = "7d") {
    return this.request(`/dashboard/analytics?period=${period}`);
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.request("/dashboard/stats");
  }

  async getDashboardActivity() {
    return this.request("/dashboard/activity");
  }

  async getActiveSessions() {
    return this.request("/dashboard/sessions/active");
  }

  async getDashboardAlerts() {
    return this.request("/dashboard/alerts");
  }

  async sendAttendanceAlert(data: {
    studentId: number;
    sessionId: number;
    alertType: string;
  }) {
    return this.request("/dashboard/alerts/attendance/send", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Send automated attendance alerts to parents of absent students (admin only). */
  async sendAutomatedAttendanceAlerts() {
    return this.request("/dashboard/alerts/attendance/send", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async sendParentNotification(data: {
    studentId: number;
    message: string;
    notificationType: string;
  }) {
    return this.request("/dashboard/notifications/parent", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async sendBulkParentNotification(data: {
    studentIds: number[];
    message: string;
    notificationType: string;
  }) {
    return this.request("/dashboard/notifications/parent/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSecurityMetrics() {
    return this.request("/dashboard/security/metrics");
  }

  async getPerformanceMetrics() {
    return this.request("/dashboard/system-metrics");
  }
}

export const api = new ApiClient();
