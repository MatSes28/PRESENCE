import { Request, Response, NextFunction } from "express";
import {
  createErrorLogger,
  ErrorCategory,
  ErrorSeverity,
} from "../services/errorTrackingService.js";

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Middleware to automatically log errors in route handlers
export const errorLoggingMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only log if this is an actual error (not a handled response)
  if (res.headersSent) {
    // Response already sent, just call next
    next(error);
    return;
  }

  const errorLogger = createErrorLogger({
    endpoint: req.path,
    method: req.method,
    userId: (req as any).session?.userId,
    requestId: req.requestId,
    userAgent: req.get("User-Agent"),
    ipAddress: req.ip,
    url: req.originalUrl,
  });

  // Determine error category and severity
  let category = ErrorCategory.SYSTEM;
  let severity = ErrorSeverity.MEDIUM;

  if (
    error.name === "ValidationError" ||
    error.message.includes("validation")
  ) {
    category = ErrorCategory.VALIDATION;
    severity = ErrorSeverity.LOW;
  } else if (
    error.name === "DatabaseError" ||
    error.message.includes("database") ||
    error.message.includes("postgres")
  ) {
    category = ErrorCategory.DATABASE;
    severity = ErrorSeverity.HIGH;
  } else if (
    error.name === "ExternalServiceError" ||
    error.message.includes("external") ||
    error.message.includes("service")
  ) {
    category = ErrorCategory.EXTERNAL;
    severity = ErrorSeverity.MEDIUM;
  } else if (
    error.message.includes("network") ||
    error.message.includes("connection")
  ) {
    category = ErrorCategory.NETWORK;
    severity = ErrorSeverity.HIGH;
  } else if (
    error.message.includes("unauthorized") ||
    error.message.includes("forbidden") ||
    error.message.includes("security")
  ) {
    category = ErrorCategory.SECURITY;
    severity = ErrorSeverity.HIGH;
  }

  // Log the error asynchronously (don't await to avoid blocking response)
  errorLogger
    .log(
      error,
      {
        requestBody: req.method !== "GET" ? req.body : undefined,
        queryParams: req.query,
        headers: req.headers,
        stack: error.stack,
      },
      category,
      severity
    )
    .catch((logError) => {
      console.error("Failed to log error:", logError);
    });

  // Continue with existing error handling
  next(error);
};

// Helper function to create consistent error responses with logging
export const handleRouteError = async (
  error: Error,
  req: Request,
  res: Response,
  operation: string,
  statusCode: number = 500
): Promise<void> => {
  const errorLogger = createErrorLogger({
    endpoint: req.path,
    method: req.method,
    userId: (req as any).session?.userId,
    requestId: req.requestId,
    userAgent: req.get("User-Agent"),
    ipAddress: req.ip,
    url: req.originalUrl,
  });

  await errorLogger.logDatabaseError(error, {
    operation,
    requestBody: req.method !== "GET" ? req.body : undefined,
    queryParams: req.query,
    params: req.params,
    stack: error.stack,
  });

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An error occurred"
        : error.message,
    requestId: req.requestId,
  });
};

// Helper function for validation errors
export const handleValidationError = async (
  req: Request,
  res: Response,
  message: string,
  field?: string
): Promise<void> => {
  const errorLogger = createErrorLogger({
    endpoint: req.path,
    method: req.method,
    userId: (req as any).session?.userId,
    requestId: req.requestId,
    userAgent: req.get("User-Agent"),
    ipAddress: req.ip,
  });

  await errorLogger.logValidationError(message, field, {
    requestBody: req.body,
    queryParams: req.query,
  });

  res.status(400).json({
    success: false,
    message,
    field,
    requestId: req.requestId,
  });
};

// Helper function for authentication/authorization errors
export const handleAuthError = async (
  req: Request,
  res: Response,
  message: string = "Authentication required",
  statusCode: number = 401
): Promise<void> => {
  const errorLogger = createErrorLogger({
    endpoint: req.path,
    method: req.method,
    userId: (req as any).session?.userId,
    requestId: req.requestId,
    userAgent: req.get("User-Agent"),
    ipAddress: req.ip,
  });

  await errorLogger.log(
    new Error(message),
    {
      requestBody: req.body,
      queryParams: req.query,
    },
    ErrorCategory.SECURITY,
    statusCode === 403 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM
  );

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.requestId,
  });
};
