import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

export interface ErrorLogEntry {
  timestamp: Date;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context: {
    userId?: number;
    sessionId?: string;
    endpoint?: string;
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
  };
  metadata: Record<string, any>;
}

export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.initializeLogger();
  }

  // Initialize Winston Logger with structured logging
  private initializeLogger(): void {
    if (
      process.env.NODE_ENV === "test" &&
      process.env.DEBUG_TEST_LOGS !== "true"
    ) {
      this.logger = winston.createLogger({ silent: true });
      return;
    }

    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level: level.toUpperCase(),
          message,
          stack,
          ...meta,
        });
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: logFormat,
      transports: [
        // Error log file with rotation
        new DailyRotateFile({
          filename: "logs/error-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          level: "error",
          maxSize: "20m",
          maxFiles: "14d",
        }),

        // Combined log file with rotation
        new DailyRotateFile({
          filename: "logs/combined-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "30d",
        }),

        // Performance log file
        new DailyRotateFile({
          filename: "logs/performance-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          level: "info",
          maxSize: "20m",
          maxFiles: "7d",
        }),

        // Console output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  // Error logging methods
  public logError(
    error: Error,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata: Record<string, any> = {}
  ): void {
    const errorEntry: ErrorLogEntry = {
      timestamp: new Date(),
      level: "error",
      message: error.message,
      stack: error.stack,
      context: {
        endpoint: context.endpoint,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId,
      },
      metadata,
    };

    this.logger.error("Application Error", errorEntry);
  }

  public logWarning(
    message: string,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata: Record<string, any> = {}
  ): void {
    const warningEntry: ErrorLogEntry = {
      timestamp: new Date(),
      level: "warn",
      message,
      context: {
        endpoint: context.endpoint,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId,
      },
      metadata,
    };

    this.logger.warn("Application Warning", warningEntry);
  }

  public logInfo(
    message: string,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata: Record<string, any> = {}
  ): void {
    this.logger.info(message, { context, metadata, type: "info" });
  }

  // Direct access to winston logger for advanced usage
  public getLogger(): winston.Logger {
    return this.logger;
  }
}

export const loggerService = new LoggerService();
