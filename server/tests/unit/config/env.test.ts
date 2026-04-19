import { validateEnvironmentOrThrow } from "../../../src/config/env.js";

const ORIGINAL_ENV = { ...process.env };
const STRONG_32_BYTE_KEY = Buffer.alloc(32, 7).toString("base64");

describe("production environment validation", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = "production";
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.DATABASE_URL = "postgresql://presence:secret@localhost:5432/presence";
    process.env.SESSION_SECRET = "session-secret-".padEnd(40, "x");
    process.env.JWT_SECRET = "jwt-secret-".padEnd(40, "x");
    process.env.JWT_REFRESH_SECRET = "jwt-refresh-secret-".padEnd(40, "x");
    process.env.ENCRYPTION_MASTER_KEY = STRONG_32_BYTE_KEY;
    process.env.ALLOWED_ORIGINS = "https://presence.example.edu";
    delete process.env.CORS_ORIGIN;
    delete process.env.ALLOW_FORCE_RESET_DEFAULTS;
    delete process.env.ALLOW_FIX_SESSION_ENDPOINT;
    delete process.env.ALLOW_DEBUG_SESSION;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("accepts a complete production-like configuration", () => {
    expect(() => validateEnvironmentOrThrow()).not.toThrow();
  });

  it("fails closed when production secrets are missing", () => {
    delete process.env.JWT_SECRET;

    expect(() => validateEnvironmentOrThrow()).toThrow(
      "Missing required environment variable: JWT_SECRET",
    );
  });

  it("rejects wildcard CORS origins in production", () => {
    process.env.ALLOWED_ORIGINS = "https://presence.example.edu,*";

    expect(() => validateEnvironmentOrThrow()).toThrow(
      "ALLOWED_ORIGINS must not contain '*'",
    );
  });

  it("rejects production-only debug feature flags", () => {
    process.env.ALLOW_DEBUG_SESSION = "true";

    expect(() => validateEnvironmentOrThrow()).toThrow(
      "ALLOW_DEBUG_SESSION=true is not allowed",
    );
  });
});
