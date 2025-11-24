import { DatabaseError } from "pg";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function handleDatabaseError(error: any): AppError {
  console.error("Database error:", error);

  if (error instanceof DatabaseError) {
    switch (error.code) {
      case "23505": // unique_violation
        return new AppError("Duplicate entry found", 409);
      case "23503": // foreign_key_violation
        return new AppError("Referenced record not found", 400);
      case "23502": // not_null_violation
        return new AppError("Required field is missing", 400);
      case "42703": // undefined_column
        return new AppError("Invalid data provided", 400);
      case "08003": // connection_does_not_exist
      case "08006": // connection_failure
      case "53300": // too_many_connections
        return new AppError("Database connection error", 503);
      default:
        return new AppError("Database operation failed", 500);
    }
  }

  return new AppError("Unknown database error", 500);
}

export function handleServiceError(error: any, serviceName: string): AppError {
  console.error(`${serviceName} error:`, error);

  if (error instanceof AppError) {
    return error;
  }

  return new AppError(`${serviceName} operation failed`, 500);
}

export function wrapAsync(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  details?: any
) {
  return {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
  };
}
