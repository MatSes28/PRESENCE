const API_BASE_URL = window.location.origin;

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
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
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const { triggerOn401 } = await import("./onUnauthorized");
          triggerOn401();
        }
        const error = new Error(
          data.message || `Request failed with status ${response.status}`,
        );
        (error as any).status = response.status;
        (error as any).data = data;
        throw error;
      }

      return data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request("/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser() {
    return this.request("/auth/me");
  }

  async forgotPassword(email: string) {
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
  ) {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, email, newPassword, confirmPassword }),
    });
  }

  async updateProfile(profileData: { name: string; email: string }) {
    return this.request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  }

  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }) {
    return this.request("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify(passwordData),
    });
  }

  async updateUserSettings(settings: {
    emailNotifications: boolean;
    darkMode: boolean;
    language: string;
  }) {
    return this.request("/auth/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // Users endpoints (admin only)
  async getUsers() {
    return this.request("/users");
  }

  async createUser(userData: {
    email: string;
    name: string;
    role: string;
    password: string;
    facultyId?: string;
    department?: string;
    gender?: string;
  }) {
    return this.request("/users", {
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
  ) {
    return this.request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: number) {
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
    parts?: any;
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
      parts?: any;
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
  async getStudents() {
    return this.request("/students");
  }

  async getStudent(id: number) {
    return this.request(`/students/${id}`);
  }

  // Subjects endpoints
  async getSubjects() {
    return this.request("/subjects");
  }

  async getSubject(id: number) {
    return this.request(`/subjects/${id}`);
  }

  async createSubject(subject: {
    name: string;
    code: string;
    description?: string;
    credits?: number;
  }) {
    return this.request("/subjects", {
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
  ) {
    return this.request(`/subjects/${id}`, {
      method: "PUT",
      body: JSON.stringify(subject),
    });
  }

  async deleteSubject(id: number) {
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
  }) {
    return this.request("/students", {
      method: "POST",
      body: JSON.stringify(student),
    });
  }

  async updateStudent(
    id: number,
    student: Partial<{
      name: string;
      email: string;
      rfidUid: string;
      parentEmail: string;
    }>,
  ) {
    return this.request(`/students/${id}`, {
      method: "PUT",
      body: JSON.stringify(student),
    });
  }

  async deleteStudent(id: number) {
    return this.request(`/students/${id}`, {
      method: "DELETE",
    });
  }

  async getStudentAttendance(
    id: number,
    params?: { limit?: number; offset?: number },
  ) {
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
    return this.request(`/students/${id}/attendance${query}`);
  }

  async assignRFID(id: number, rfidUid: string) {
    return this.request(`/students/${id}/assign-rfid`, {
      method: "POST",
      body: JSON.stringify({ rfidUid }),
    });
  }

  // Enrollments endpoints
  async getEnrollments() {
    return this.request("/enrollments");
  }

  async createEnrollment(enrollment: {
    studentId: number;
    subjectId: number;
    semester: string;
    academicYear: string;
  }) {
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
  }) {
    return this.request("/enrollments/bulk", {
      method: "POST",
      body: JSON.stringify(enrollments),
    });
  }

  async deleteEnrollment(id: number) {
    return this.request(`/enrollments/${id}`, {
      method: "DELETE",
    });
  }

  async unenrollStudent(studentId: number, subjectId: number) {
    return this.request(`/enrollments/${studentId}/${subjectId}`, {
      method: "DELETE",
    });
  }

  async getSubjectStudents(subjectId: number) {
    return this.request(`/enrollments/subject/${subjectId}/students`);
  }

  async getEnrollmentsForStudent(studentId: number) {
    return this.request(`/enrollments/student/${studentId}`);
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
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
    return this.request(`/attendance${query}`);
  }

  async getAttendanceStats(sessionId: number) {
    return this.request(`/attendance/stats/${sessionId}`);
  }

  // Classrooms endpoints
  async getClassrooms() {
    return this.request("/classrooms");
  }

  async createClassroom(classroom: {
    name: string;
    type: "lecture" | "laboratory";
    location?: string;
    capacity?: number;
  }) {
    return this.request("/classrooms", {
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
  ) {
    return this.request(`/classrooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(classroom),
    });
  }

  async deleteClassroom(id: number) {
    return this.request(`/classrooms/${id}`, {
      method: "DELETE",
    });
  }

  // Schedules endpoints
  async getSchedules() {
    return this.request("/schedules");
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
  }) {
    return this.request("/schedules", {
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
  ) {
    return this.request(`/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(schedule),
    });
  }

  async deleteSchedule(id: number) {
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
  }) {
    return this.request("/schedules/check-conflicts", {
      method: "POST",
      body: JSON.stringify(conflictData),
    });
  }

  // Class Sessions endpoints
  async getClassSessions() {
    return this.request("/sessions");
  }

  async getClassSession(id: number) {
    return this.request(`/sessions/${id}`);
  }

  async createClassSessionsForDate(date: string) {
    return this.request("/sessions/auto-create", {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  }

  async activateSessions() {
    return this.request("/sessions/auto-activate", {
      method: "POST",
    });
  }

  async endSessions() {
    return this.request("/sessions/auto-end", {
      method: "POST",
    });
  }

  async updateSessionStatus(id: number, status: string) {
    return this.request(`/sessions/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  // Reports endpoints
  async generateReport(params: {
    type: "attendance" | "students" | "classroom";
    format: "pdf" | "csv";
    startDate?: string;
    endDate?: string;
    classroomId?: number;
    subjectId?: number;
  }) {
    return this.request("/reports/generate", {
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

  async sendDeviceCommand(deviceId: string, command: string, params?: any) {
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

  async assignCustom(sessionId: number, criteria: any) {
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
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
    return this.request(`/ai-analytics/learning-analytics${query}`);
  }

  async getAIInsights(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
    return this.request(`/ai-analytics/insights${query}`);
  }

  async getPerformanceTrends(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
    return this.request(`/ai-analytics/performance-trends${query}`);
  }

  async getAttendancePatterns(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
    return this.request(`/ai-analytics/attendance-patterns${query}`);
  }

  async getSeatingEffectiveness(params?: {
    facultyId?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const query = params ? `?${new URLSearchParams(params as any)}` : "";
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
