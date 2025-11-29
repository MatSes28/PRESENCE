/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/tests/e2e/", // Exclude Playwright e2e tests from Jest
  ],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts", // Entry point
    "!src/routes.ts", // Route aggregator
    "!src/config/**/*.ts", // Configuration files
    "!src/**/*.test.ts", // Test files
    "!src/**/*.spec.ts", // Spec files
  ],
  coverageDirectory: "coverage",
  coverageReporters: [
    "text",
    "lcov",
    "html",
    "json",
    "cobertura", // For CI/CD integration
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  // Quality gates and best practices
  bail: false, // Don't stop on first failure, run all tests
  passWithNoTests: false, // Fail if no tests found
  testFailureExitCode: 1, // Explicit exit code for failures
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: "50%",
  moduleFileExtensions: ["ts", "js", "json"],
  // Database test isolation - temporarily disabled for testing
  // globalSetup: "<rootDir>/tests/globalSetup.ts",
  // globalTeardown: "<rootDir>/tests/globalTeardown.ts",
};
