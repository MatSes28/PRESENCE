import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errorHandler.js";

export function validateRequired(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields: string[] = [];

    for (const field of fields) {
      if (!req.body[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields: ${missingFields.join(", ")}`,
        400
      );
    }

    next();
  };
}

export function validateNumeric(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      const value = req.body[field];
      if (
        value !== undefined &&
        (isNaN(Number(value)) || !isFinite(Number(value)))
      ) {
        throw new AppError(`Field '${field}' must be a valid number`, 400);
      }
    }
    next();
  };
}

export function validateDate(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      const value = req.body[field];
      if (value !== undefined && isNaN(Date.parse(value))) {
        throw new AppError(`Field '${field}' must be a valid date`, 400);
      }
    }
    next();
  };
}

export function validateEnum(field: string, allowedValues: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    if (value !== undefined && !allowedValues.includes(value)) {
      throw new AppError(
        `Field '${field}' must be one of: ${allowedValues.join(", ")}`,
        400
      );
    }
    next();
  };
}

export function sanitizeInput(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === "string") {
        req.body[field] = req.body[field].trim();
      }
    }
    next();
  };
}
