/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/?(*.)+(spec|test).ts",
    "!**/e2e/**", // Exclude e2e tests as they use Playwright
  ],

  // TypeScript + ESM support
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },

  // Allow NodeNext-style imports that include `.js` extensions in TS sources.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Map monorepo source imports ending in `.js` back to their `.ts` sources.
    // (NodeNext pattern: TS source imports use `.js` in specifiers.)
    // Keep this scoped to `/src/` and `/shared/` to avoid impacting node_modules.
    "^\\.{1,2}\\/(?:.*?\\/)?src\\/(.*)\\.js$": "<rootDir>/src/$1.ts",
    "^\\.{1,2}\\/(?:.*?\\/)?shared\\/(.*)\\.js$": "<rootDir>/../shared/$1.ts",

    // Fallback: strip `.js` extension for other relative imports.
    "^(\\.{1,2}\\/.*)\\.js$": "$1",
  },

  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/routes.ts",
    "!src/config/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json", "cobertura"],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  bail: false,
  passWithNoTests: false,
  testFailureExitCode: 1,
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: "50%",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["js", "ts", "json"],
};
