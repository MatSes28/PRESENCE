import { Request, Response, NextFunction } from "express";
import validator from "validator";

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Sanitize string inputs
  const sanitizeString = (str: string) => {
    if (typeof str !== "string") return str;
    return validator.escape(str.trim());
  };

  // Sanitize email
  const sanitizeEmail = (email: string) => {
    if (typeof email !== "string") return email;
    return (
      validator.normalizeEmail(email, {
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
      }) || email
    );
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") return sanitizeString(obj);
    if (typeof obj === "object") {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.toLowerCase().includes("email")) {
          sanitized[key] = sanitizeEmail(value as string);
        } else if (typeof value === "string") {
          sanitized[key] = sanitizeString(value);
        } else {
          sanitized[key] = sanitizeObject(value);
        }
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body, query, and params
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
};

// Validation rules
export const validationRules = {
  email: (value: string) => {
    if (!value) return "Email is required";
    if (!validator.isEmail(value)) return "Invalid email format";
    if (value.length > 254) return "Email too long";
    return null;
  },

  password: (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters";
    if (value.length > 128) return "Password too long";
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
      return "Password must contain uppercase, lowercase, and number";
    }
    return null;
  },

  name: (value: string) => {
    if (!value) return "Name is required";
    if (value.length < 2) return "Name too short";
    if (value.length > 100) return "Name too long";
    if (!/^[a-zA-Z\s\-'\.]+$/.test(value))
      return "Name contains invalid characters";
    return null;
  },

  studentId: (value: string) => {
    if (!value) return "Student ID is required";
    if (!/^[A-Z0-9_-]{3,50}$/i.test(value))
      return "Invalid student ID format (3-50 letters or numbers; hyphens and underscores allowed)";
    return null;
  },

  rfidUid: (value: string) => {
    if (!value) return null; // RFID is optional
    const normalized = String(value).trim().replace(/[\s:-]/g, "");
    if (normalized.length < 4 || normalized.length > 50)
      return "RFID UID length invalid";
    if (!/^[a-fA-F0-9]+$/.test(normalized))
      return "RFID UID must be hexadecimal";
    return null;
  },

  subjectCode: (value: string) => {
    if (!value) return "Subject code is required";
    if (value.length < 2 || value.length > 10)
      return "Subject code length invalid";
    if (!/^[A-Z]{2,4}\d{3,4}$/.test(value))
      return "Invalid subject code format";
    return null;
  },

  time: (value: string) => {
    if (!value) return "Time is required";
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value))
      return "Invalid time format (HH:MM)";
    return null;
  },

  positiveInteger: (value: any) => {
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) return "Must be a positive integer";
    if (num > 10000) return "Value too large";
    return null;
  },

  role: (value: string) => {
    if (!["admin", "faculty"].includes(value)) return "Invalid role";
    return null;
  },

  classroomType: (value: string) => {
    if (!["lecture", "laboratory"].includes(value))
      return "Invalid classroom type";
    return null;
  },

  dayOfWeek: (value: any) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0 || num > 6) return "Invalid day of week";
    return null;
  },

  semester: (value: string) => {
    if (!["1st Semester", "2nd Semester", "Summer"].includes(value))
      return "Invalid semester";
    return null;
  },

  academicYear: (value: string) => {
    if (!value) return "Academic year is required";
    if (!/^\d{4}-\d{4}$/.test(value))
      return "Invalid academic year format (YYYY-YYYY)";
    const [start, end] = value.split("-").map(Number);
    if (end !== start + 1) return "Invalid academic year range";
    return null;
  },

  url: (value: string) => {
    if (!value) return null; // URL is optional
    if (!validator.isURL(value, { protocols: ["http", "https"] }))
      return "Invalid URL format";
    return null;
  },

  phone: (value: string) => {
    if (!value) return null; // Phone is optional
    if (!validator.isMobilePhone(value, "any")) return "Invalid phone number";
    return null;
  },

  maxLength: (maxLen: number) => (value: string) => {
    if (value && value.length > maxLen)
      return `Maximum length is ${maxLen} characters`;
    return null;
  },

  minLength: (minLen: number) => (value: string) => {
    if (value && value.length < minLen)
      return `Minimum length is ${minLen} characters`;
    return null;
  },
};

// Validation middleware factory
export const validateRequest = (rules: {
  [key: string]: (value: any) => string | null;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { [key: string]: string } = {};

    // Validate body fields
    if (req.body && typeof req.body === "object") {
      for (const [field, validator] of Object.entries(rules)) {
        const value = req.body[field];
        const error = validator(value);
        if (error) {
          errors[field] = error;
        }
      }
    }

    // Validate query params
    if (req.query && typeof req.query === "object") {
      for (const [field, validator] of Object.entries(rules)) {
        if (req.query[field] !== undefined) {
          const value = req.query[field];
          const error = validator(value);
          if (error) {
            errors[field] = error;
          }
        }
      }
    }

    // Validate route params
    if (req.params && typeof req.params === "object") {
      for (const [field, validator] of Object.entries(rules)) {
        if (req.params[field] !== undefined) {
          const value = req.params[field];
          const error = validator(value);
          if (error) {
            errors[field] = error;
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    next();
  };
};

// Rate limiting helper (basic implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const windowData = requestCounts.get(key);

    if (!windowData || now > windowData.resetTime) {
      requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    } else if (windowData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
      });
    } else {
      windowData.count++;
    }

    next();
  };
};

// SQL injection prevention (additional layer)
export const preventSQLInjection = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const checkForSQLInjection = (obj: any): boolean => {
    if (typeof obj === "string") {
      // Basic SQL injection patterns
      const sqlPatterns = [
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\%27)|(\%23))/i,
        /(<script|javascript:|on\w+\s*=)/i,
      ];

      return sqlPatterns.some((pattern) => pattern.test(obj));
    }

    if (typeof obj === "object" && obj !== null) {
      if (Array.isArray(obj)) {
        return obj.some(checkForSQLInjection);
      }
      return Object.values(obj).some(checkForSQLInjection);
    }

    return false;
  };

  if (
    checkForSQLInjection(req.body) ||
    checkForSQLInjection(req.query) ||
    checkForSQLInjection(req.params)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid input detected",
    });
  }

  next();
};
