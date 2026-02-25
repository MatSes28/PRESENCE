/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).ts",
    "!**/e2e/**", // Exclude e2e tests as they use Playwright
  ],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        // Ensure ts-jest compiles with the server tsconfig (ES module output),
        // otherwise `import.meta.url` will fail type-checking under CommonJS.
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
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
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^(\\.\\.?\\/.*)\\.js$": "$1",
  },
  // Test categorization
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["js", "ts", "json"],
  // Database test isolation
  // globalSetup: "<rootDir>/tests/globalSetup.mjs",
  // globalTeardown: "<rootDir>/tests/globalTeardown.mjs",
};
