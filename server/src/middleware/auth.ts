import { Request, Response, NextFunction } from "express";

// Middleware to require authentication
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

// Middleware to require admin role
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.userId || req.session?.userRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

// Middleware to require admin or faculty role
export const requireAdminOrFaculty = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (
    !req.session?.userId ||
    (req.session?.userRole !== "admin" && req.session?.userRole !== "faculty")
  ) {
    return res.status(403).json({
      success: false,
      message: "Admin or faculty access required",
    });
  }
  next();
};

// Middleware to require faculty role
export const requireFaculty = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.userId || req.session?.userRole !== "faculty") {
    return res.status(403).json({
      success: false,
      message: "Faculty access required",
    });
  }
  next();
};
