// Extend global types
declare global {
  var testUtils: {
    generateTestUser: (overrides?: any) => any;
    generateTestStudent: (overrides?: any) => any;
    generateTestSchedule: (overrides?: any) => any;
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
    createMockNext: () => jest.MockedFunction<any>;
  };
}

// Set test environment
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error"; // Reduce log noise during tests

// Mock external services
jest.mock("../src/services/websocket", () => ({
  setupWebSocket: jest.fn(),
  getWebSocketClient: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    getDeviceStatus: jest.fn(),
  })),
}));

// Mock email service
jest.mock("../src/services/emailService", () => ({
  sendEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

// Mock monitoring service to avoid actual logging during tests
jest.mock("../src/services/monitoringService", () => ({
  monitoringService: {
    logError: jest.fn(),
    logWarning: jest.fn(),
    logInfo: jest.fn(),
    startTrace: jest.fn(() => "test-trace-id"),
    endTrace: jest.fn(),
    createRequestMiddleware: jest.fn(
      () => (req: any, res: any, next: any) => next()
    ),
    getHealthStatus: jest.fn(() => ({
      status: "healthy",
      uptime: 1000,
      system: {},
      database: {},
      application: {},
      timestamp: new Date(),
    })),
    getPrometheusMetrics: jest.fn(() => "# Test metrics"),
  },
}));

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestUser: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    email: `test${Date.now()}@example.com`,
    firstName: "Test",
    lastName: "User",
    role: "student",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  generateTestStudent: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    studentId: `STU${Date.now()}`,
    name: "Test Student",
    email: `student${Date.now()}@example.com`,
    phone: "+1234567890",
    parentEmail: `parent${Date.now()}@example.com`,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  generateTestSchedule: (overrides = {}) => ({
    id: Math.random().toString(36).substr(2, 9),
    subjectId: 1,
    classroomId: 1,
    facultyId: 1,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:30",
    semester: "1st Semester",
    academicYear: "2024",
    createdAt: new Date(),
    ...overrides,
  }),

  // Mock request/response objects
  createMockRequest: (overrides = {}) => ({
    body: {},
    query: {},
    params: {},
    headers: {},
    session: {},
    ip: "127.0.0.1",
    get: jest.fn((header: string) => undefined),
    ...overrides,
  }),

  createMockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  },

  createMockNext: () => jest.fn(),
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
  // Close any open database connections
  // This will be handled by the global teardown
});

export {};
