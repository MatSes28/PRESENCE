import { Request, Response, NextFunction } from "express";
import { monitoringService } from "../services/monitoringService.js";

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Error types for better categorization
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = "Insufficient permissions") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    public service: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    requestId?: string;
    timestamp: string;
  };
}

// Error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID if not present
  const requestId =
    req.requestId ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Categorize error type
  let statusCode = 500;
  let errorCode = "INTERNAL_ERROR";
  let logLevel: "error" | "warn" = "error";

  if (error instanceof ValidationError) {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    logLevel = "warn";
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
    errorCode = "AUTHENTICATION_ERROR";
    logLevel = "warn";
  } else if (error instanceof AuthorizationError) {
    statusCode = 403;
    errorCode = "AUTHORIZATION_ERROR";
    logLevel = "warn";
  } else if (error instanceof DatabaseError) {
    statusCode = 500;
    errorCode = "DATABASE_ERROR";
    logLevel = "error";
  } else if (error instanceof ExternalServiceError) {
    statusCode = 502;
    errorCode = "EXTERNAL_SERVICE_ERROR";
    logLevel = "error";
  }

  // Log error with monitoring service
  const errorContext = {
    endpoint: `${req.method} ${req.path}`,
    userId: (req as any).session?.userId,
    sessionId: (req as any).session?.id,
    userAgent: req.get("User-Agent"),
    ipAddress: req.ip,
    requestId,
  };

  const errorMetadata = {
    statusCode,
    errorCode,
    stack: error.stack,
    headers: req.headers,
    query: req.query,
    body: req.method !== "GET" ? req.body : undefined,
    userId: (req as any).session?.userId,
  };

  // Log based on level
  switch (logLevel) {
    case "error":
      monitoringService.logError(error, errorContext, errorMetadata);
      break;
    case "warn":
      monitoringService.logWarning(error.message, errorContext, errorMetadata);
      break;
  }

  // Send error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
      details:
        process.env.NODE_ENV === "development"
          ? {
              stack: error.stack,
              originalError: error,
            }
          : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request ID middleware
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.requestId);
  next();
};

// 404 handler
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = new Error(`Route ${req.method} ${req.path} not found`);
  (error as any).statusCode = 404;
  next(error);
};

// Unhandled promise rejection handler
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  monitoringService.logError(
    new Error(`Unhandled Promise Rejection: ${reason}`),
    {
      endpoint: "system",
      requestId: "system",
    },
    {
      reason: reason?.toString(),
      promise: promise?.toString(),
      stack: reason?.stack,
    }
  );

  console.error("Unhandled Promise Rejection:", reason);
});

// Uncaught exception handler
process.on("uncaughtException", (error: Error) => {
  monitoringService.logError(
    error,
    {
      endpoint: "system",
      requestId: "system",
    },
    {
      type: "uncaughtException",
      stack: error.stack,
    }
  );

  console.error("Uncaught Exception:", error);
  process.exit(1);
});
