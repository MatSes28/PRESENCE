// Configuration interfaces
interface AppConfig {
  // Base config
  NODE_ENV: "development" | "staging" | "production";
  PORT: number;
  HOST: string;
  LOG_LEVEL: "error" | "warn" | "info" | "debug";

  // Database
  DATABASE_URL: string;
  DB_MAX_CONNECTIONS: number;
  DB_IDLE_TIMEOUT: number;
  DB_CONNECT_TIMEOUT: number;

  // Security
  SESSION_SECRET: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  BCRYPT_ROUNDS: number;
  SESSION_MAX_AGE: number;

  // Email
  BREVO_API_KEY?: string;
  FROM_EMAIL: string;
  EMAIL_TEMPLATES_PATH: string;

  // Cache
  REDIS_URL?: string;
  CACHE_TTL: number;
  CACHE_PREFIX: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  ATTENDANCE_RATE_LIMIT: number;
  REPORT_RATE_LIMIT: number;
  IOT_RATE_LIMIT: number;

  // CORS
  ALLOWED_ORIGINS: string[];
  CORS_MAX_AGE: number;

  // File Upload
  MAX_FILE_SIZE: number;
  UPLOAD_PATH: string;
  ALLOWED_FILE_TYPES: string[];

  // Monitoring
  METRICS_INTERVAL: number;
  ALERT_EMAIL_RECIPIENTS?: string;
  ALERT_WEBHOOK_URL?: string;
  HEALTH_CHECK_INTERVAL: number;

  // IoT
  DEFAULT_DEVICE_TIMEOUT: number;
  HEARTBEAT_INTERVAL: number;
  MAX_DEVICES_PER_CLASSROOM: number;
  DEVICE_DISCOVERY_PORT: number;

  // Backup
  BACKUP_ENABLED: boolean;
  BACKUP_INTERVAL: number;
  BACKUP_RETENTION_DAYS: number;
  BACKUP_PATH: string;
  BACKUP_COMPRESSION: boolean;
}

// Environment-specific defaults
const environmentDefaults = {
  development: {
    LOG_LEVEL: "debug" as const,
    DB_MAX_CONNECTIONS: 10,
    BACKUP_ENABLED: false,
    METRICS_INTERVAL: 60000, // 1 minute in dev
  },
  staging: {
    LOG_LEVEL: "info" as const,
    DB_MAX_CONNECTIONS: 15,
    BACKUP_ENABLED: true,
    BACKUP_INTERVAL: 43200000, // 12 hours
    METRICS_INTERVAL: 30000, // 30 seconds
  },
  production: {
    LOG_LEVEL: "warn" as const,
    DB_MAX_CONNECTIONS: 20,
    BACKUP_ENABLED: true,
    BACKUP_INTERVAL: 86400000, // 24 hours
    METRICS_INTERVAL: 30000, // 30 seconds
    HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  },
};

// Configuration loader
export function loadConfig() {
  const env = process.env.NODE_ENV || "development";

  // Load environment variables with defaults
  const rawConfig = {
    // Base config
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || "0.0.0.0",
    LOG_LEVEL:
      process.env.LOG_LEVEL ||
      environmentDefaults[env as keyof typeof environmentDefaults]?.LOG_LEVEL ||
      "info",

    // Database
    DATABASE_URL: process.env.DATABASE_URL,
    DB_MAX_CONNECTIONS:
      process.env.DB_MAX_CONNECTIONS ||
      environmentDefaults[env as keyof typeof environmentDefaults]
        ?.DB_MAX_CONNECTIONS ||
      10,
    DB_IDLE_TIMEOUT: process.env.DB_IDLE_TIMEOUT || 30000,
    DB_CONNECT_TIMEOUT: process.env.DB_CONNECT_TIMEOUT || 10000,

    // Security
    SESSION_SECRET: process.env.SESSION_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || 12,
    SESSION_MAX_AGE: process.env.SESSION_MAX_AGE || 86400000,

    // Email
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL || "noreply@clirdec-presence.com",
    EMAIL_TEMPLATES_PATH: process.env.EMAIL_TEMPLATES_PATH || "./templates",

    // Cache
    REDIS_URL: process.env.REDIS_URL,
    CACHE_TTL: process.env.CACHE_TTL || 3600,
    CACHE_PREFIX: process.env.CACHE_PREFIX || "clirdec_presence:",

    // Rate Limiting
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || 900000,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
    ATTENDANCE_RATE_LIMIT: process.env.ATTENDANCE_RATE_LIMIT || 50,
    REPORT_RATE_LIMIT: process.env.REPORT_RATE_LIMIT || 20,
    IOT_RATE_LIMIT: process.env.IOT_RATE_LIMIT || 200,

    // CORS
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:5173",
    CORS_MAX_AGE: process.env.CORS_MAX_AGE || 86400,

    // File Upload
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 10485760,
    UPLOAD_PATH: process.env.UPLOAD_PATH || "./uploads",
    ALLOWED_FILE_TYPES:
      process.env.ALLOWED_FILE_TYPES ||
      "image/jpeg,image/png,image/gif,application/pdf",

    // Monitoring
    METRICS_INTERVAL:
      process.env.METRICS_INTERVAL ||
      environmentDefaults[env as keyof typeof environmentDefaults]
        ?.METRICS_INTERVAL ||
      30000,
    ALERT_EMAIL_RECIPIENTS: process.env.ALERT_EMAIL_RECIPIENTS,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    HEALTH_CHECK_INTERVAL: process.env.HEALTH_CHECK_INTERVAL || 60000,

    // IoT
    DEFAULT_DEVICE_TIMEOUT: process.env.DEFAULT_DEVICE_TIMEOUT || 300000,
    HEARTBEAT_INTERVAL: process.env.HEARTBEAT_INTERVAL || 30000,
    MAX_DEVICES_PER_CLASSROOM: process.env.MAX_DEVICES_PER_CLASSROOM || 10,
    DEVICE_DISCOVERY_PORT: process.env.DEVICE_DISCOVERY_PORT || 41234,

    // Backup
    BACKUP_ENABLED:
      process.env.BACKUP_ENABLED ||
      environmentDefaults[env as keyof typeof environmentDefaults]
        ?.BACKUP_ENABLED ||
      false,
    BACKUP_INTERVAL:
      process.env.BACKUP_INTERVAL ||
      environmentDefaults[env as keyof typeof environmentDefaults]
        ?.BACKUP_INTERVAL ||
      86400000,
    BACKUP_RETENTION_DAYS: process.env.BACKUP_RETENTION_DAYS || 30,
    BACKUP_PATH: process.env.BACKUP_PATH || "./backups",
    BACKUP_COMPRESSION: process.env.BACKUP_COMPRESSION !== "false", // Default true
  };

  // Validate configuration
  const config = configSchema.parse(rawConfig);

  // Additional validation for required fields
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!config.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET is required and must be at least 32 characters"
    );
  }

  if (env === "production" && !config.REDIS_URL) {
    console.warn(
      "REDIS_URL not configured for production - caching will be disabled"
    );
  }

  if (env === "production" && !config.BREVO_API_KEY) {
    console.warn(
      "BREVO_API_KEY not configured for production - email notifications will be disabled"
    );
  }

  return config;
}

// Export validated configuration
export const config = loadConfig();

// Environment helpers
export const isDevelopment = config.NODE_ENV === "development";
export const isStaging = config.NODE_ENV === "staging";
export const isProduction = config.NODE_ENV === "production";

// Feature flags based on environment
export const features = {
  enableDebugLogging: isDevelopment,
  enableDetailedMetrics: !isDevelopment,
  enableAutomatedBackups: config.BACKUP_ENABLED,
  enableEmailNotifications: !!config.BREVO_API_KEY,
  enableCaching: !!config.REDIS_URL,
  enableAdvancedMonitoring: isProduction || isStaging,
  enableDataRetention: isProduction,
  enableGDPRCompliance: true, // Always enabled
};

// Configuration validation helper
export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    loadConfig();
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(
        ...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
      );
    } else if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  // Additional business logic validation
  if (config.BACKUP_ENABLED && !config.DATABASE_URL.includes("postgresql://")) {
    errors.push("Automated backups only supported for PostgreSQL databases");
  }

  if (config.MAX_FILE_SIZE > 100 * 1024 * 1024) {
    // 100MB
    errors.push("MAX_FILE_SIZE cannot exceed 100MB");
  }

  if (config.DB_MAX_CONNECTIONS > 100) {
    errors.push("DB_MAX_CONNECTIONS cannot exceed 100");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
