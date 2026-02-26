import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Middleware to require authentication
export const requireAuth = (
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
    console.log(
      `Unauthorized admin access attempt by user ${req.session?.userId}`,
    );
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  console.log(`Admin access granted to user ${req.session?.userId}`);
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
    console.log(
      `Unauthorized faculty access attempt by user ${req.session?.userId}`,
    );
    return res.status(403).json({
      success: false,
      message: "Admin or faculty access required",
    });
  }

  console.log(`Faculty access granted to user ${req.session?.userId}`);
  next();
};

// Middleware to require faculty role
export const requireFaculty = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.session?.userId || req.session?.userRole !== "faculty") {
    console.log(
      `Unauthorized faculty access attempt by user ${req.session?.userId}`,
    );
    return res.status(403).json({
      success: false,
      message: "Faculty access required",
    });
  }

  console.log(`Faculty access granted to user ${req.session?.userId}`);
  next();
};
