// Jest runtime setup (CommonJS) to avoid ESM parsing issues in setup files.
// This file runs before tests via `setupFilesAfterEnv`.

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-session-secret-" + "x".repeat(48);
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-" + "x".repeat(52);
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-jwt-refresh-secret-" + "x".repeat(44);

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

jest.mock("../src/services/emailService", () => ({
  sendEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock("../src/services/monitoringService", () => ({
  monitoringService: {
    logError: jest.fn(),
    logWarning: jest.fn(),
    logInfo: jest.fn(),
    startTrace: jest.fn(() => "test-trace-id"),
    endTrace: jest.fn(),
    createRequestMiddleware: jest.fn(() => (req, res, next) => next()),
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

afterEach(() => {
  jest.clearAllMocks();
});
