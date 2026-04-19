import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { loggerService } from "../services/monitoring/logger.js";

const authAccessDebugEnabled = () =>
  process.env.LOG_AUTH_ACCESS_DEBUG === "true";

const logAccessDenied = (
  message: string,
  req: Request,
  requiredRole: string,
) => {
  loggerService.logWarning(
    message,
    {
      endpoint: req.originalUrl,
      userId: req.session?.userId,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    },
    { requiredRole, actualRole: req.session?.userRole ?? "none" },
  );
};

const logAccessGranted = (req: Request, requiredRole: string) => {
  if (!authAccessDebugEnabled()) return;
  loggerService.logInfo(
    "Role access granted",
    {
      endpoint: req.originalUrl,
      userId: req.session?.userId,
      sessionId: req.sessionID,
    },
    { requiredRole },
  );
};

// Middleware to require authentication
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // First, check for session-based authentication
  if (req.session?.userId) {
    return next();
  }

  // Second, check for JWT token in Authorization header
  const authHeader = req.headers["authorization"];

  // Strictly require `Authorization: Bearer <token>` (no extra parts)
  const parts = typeof authHeader === "string" ? authHeader.split(" ") : [];
  const scheme = parts[0];
  const token = parts[1];
  const extra = parts.length > 2;

  if (scheme !== "Bearer" || !token || extra) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      // Fail closed: do not accept JWT auth if the server is misconfigured.
      return res.status(500).json({
        success: false,
        message: "Server misconfiguration: JWT secret not set",
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret);

    // Attach user information to request
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded
    ) {
      if (!req.session) {
        req.session = {} as any;
      }
      req.session.userId = (decoded as any).userId;
      req.session.userRole = (decoded as any).role;
    }

    next();
  } catch (error) {
    // Treat invalid/expired tokens as unauthorized
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Middleware to require admin role
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    logAccessDenied("Admin access denied", req, "admin");
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  logAccessGranted(req, "admin");
  next();
};

// Middleware to require admin or faculty role
export const requireAdminOrFaculty = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (
    !req.session?.userId ||
    (req.session?.userRole !== "admin" && req.session?.userRole !== "faculty")
  ) {
    logAccessDenied("Admin or faculty access denied", req, "admin|faculty");
    return res.status(403).json({
      success: false,
      message: "Admin or faculty access required",
    });
  }

  logAccessGranted(req, "admin|faculty");
  next();
};

// Middleware to require faculty role
export const requireFaculty = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.session?.userId || req.session?.userRole !== "faculty") {
    logAccessDenied("Faculty access denied", req, "faculty");
    return res.status(403).json({
      success: false,
      message: "Faculty access required",
    });
  }

  logAccessGranted(req, "faculty");
  next();
};
