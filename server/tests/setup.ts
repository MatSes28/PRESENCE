import { afterAll, afterEach, jest } from "@jest/globals";
import { createRequire } from "module";

// ESM compatibility:
// Some legacy unit tests use `require()` to access mocked modules.
// Jest runs tests as ESM (ts-jest default-esm), so `require` is not defined by default.
// Provide a global require so existing tests keep working.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = createRequire(import.meta.url);

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
process.env.SESSION_SECRET = "test-session-secret-" + "x".repeat(48);
process.env.JWT_SECRET = "test-jwt-secret-" + "x".repeat(52);
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-" + "x".repeat(44);
// DATABASE_URL:
// - In CI, the workflow sets this to Postgres.
// - Locally, default to the same Postgres URL as CI for consistency.
//   If you want to use a different local DB, set DATABASE_URL explicitly.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    // Aligns with CI workflow in [`.github/workflows/test.yml`](.github/workflows/test.yml:1)
    "postgresql://postgres:postgres@localhost:5432/test_db";
}

// Mock external services
function mockWebsocket() {
  return {
    setupWebSocket: jest.fn(),
    getWebSocketClient: jest.fn(() => ({
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      getDeviceStatus: jest.fn(),
    })),
  };
}

// Match both NodeNext-style specifiers (with .js) and TS specifiers (without .js)
jest.mock("../src/services/websocket.js", mockWebsocket);
jest.mock("../src/services/websocket", mockWebsocket);

// Mock email service
function mockEmailService() {
  return {
    sendEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };
}

jest.mock("../src/services/emailService.js", mockEmailService);
jest.mock("../src/services/emailService", mockEmailService);

// Mock monitoring service to avoid actual logging during tests
function mockMonitoringService() {
  return {
    monitoringService: {
      logError: jest.fn(),
      logWarning: jest.fn(),
      logInfo: jest.fn(),
      startTrace: jest.fn(() => "test-trace-id"),
      endTrace: jest.fn(),
      createRequestMiddleware: jest.fn(
        () => (req: any, res: any, next: any) => next(),
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
  };
}

jest.mock("../src/services/monitoringService.js", mockMonitoringService);
jest.mock("../src/services/monitoringService", mockMonitoringService);

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
