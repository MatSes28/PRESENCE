const API_BASE_URL = (import.meta as any).env?.DEV
  ? "http://localhost:3000"
  : "";

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
        throw new Error(data.message || "Request failed");
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
