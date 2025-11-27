/** @type {import('jest').Config} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts", // Entry point
    "!src/routes.ts", // Route aggregator
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: "50%",
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Test categorization
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["ts", "js", "json"],
  // Database test isolation
  globalSetup: "<rootDir>/tests/globalSetup.ts",
  globalTeardown: "<rootDir>/tests/globalTeardown.ts",
};
