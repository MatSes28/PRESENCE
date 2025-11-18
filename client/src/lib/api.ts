const API_BASE_URL = (import.meta as any).env?.DEV
  ? "http://localhost:3000"
  : window.location.origin;

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
    options: RequestInit = {}
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
        const error = new Error(
          data.message || `Request failed with status ${response.status}`
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
    confirmPassword: string
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
    firstName: string;
    lastName: string;
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
    userData: Partial<{ email: string; name: string; role: string }>
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

  async createComputer(computer: {
    classroomId: number;
    name: string;
    ipAddress?: string;
    macAddress?: string;
  }) {
    return this.request("/computers", {
      method: "POST",
      body: JSON.stringify(computer),
    });
  }

  async updateComputer(
    id: number,
    computer: Partial<{
      name: string;
      ipAddress: string;
      macAddress: string;
      status: string;
    }>
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

  // Students endpoints
  async getStudents() {
    return this.request("/students");
  }

  async getStudent(id: number) {
    return this.request(`/students/${id}`);
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
    }>
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
    params?: { limit?: number; offset?: number }
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
    location?: string;
    capacity?: number;
  }) {
    return this.request("/classrooms", {
      method: "POST",
      body: JSON.stringify(classroom),
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
    return this.request(`/iot/devices/${deviceId}/status`);
  }

  async sendDeviceCommand(deviceId: string, command: string, params?: any) {
    return this.request(`/iot/devices/${deviceId}/command`, {
      method: "POST",
      body: JSON.stringify({ command, params }),
    });
  }
}

export const api = new ApiClient();
