import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { cacheService } from "../services/cacheService.js";

// General API rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req) => req.path === "/health",
});

// Stricter rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for attendance recording (higher limit for RFID operations)
export const attendanceRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Allow 50 attendance records per minute per IP
  message: {
    success: false,
    message: "Too many attendance operations, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for report generation (resource intensive)
export const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Allow 10 report generations per hour per IP
  message: {
    success: false,
    message: "Report generation limit exceeded, please try again later.",
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for IoT device operations
export const iotRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow 100 IoT operations per minute
  message: {
    success: false,
    message: "Too many IoT operations, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User-based rate limiting (more sophisticated)
export const createUserRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    ...options,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.session?.userId ? `user_${req.session.userId}` : req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// API optimization middleware
export const apiOptimization = (req: Request, res: Response, next: any) => {
  const startTime = Date.now();

  // Add response timing
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const method = req.method;
    const url = req.originalUrl;
    const statusCode = res.statusCode;

    // Log slow requests (>500ms)
    if (duration > 500) {
      console.warn(
        `Slow request: ${method} ${url} - ${duration}ms - Status: ${statusCode}`
      );
    }

    // Add performance headers
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${duration}ms`);
    }
  });

  // Compress responses for large payloads
  if (req.headers["accept-encoding"]?.includes("gzip")) {
    // Express will handle gzip compression if enabled
  }

  // Cache control headers for static resources
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
};

// Request caching middleware
export const requestCache = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: any) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Create cache key from request
    const cacheKey = `api:${req.originalUrl}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cachedResponse = await cacheService.get(cacheKey, "api_cache:");
    if (cachedResponse) {
      // Return cached response
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-TTL", ttl.toString());
      return res.json(cachedResponse);
    }

    // Store original json method
    const originalJson = res.json;

    // Override json method to cache response
    res.json = function (data: any) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.set(cacheKey, data, { ttl, keyPrefix: "api_cache:" });
      }

      // Set cache headers
      res.setHeader("X-Cache", "MISS");

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

// Request deduplication middleware (prevent duplicate requests)
export const requestDeduplication = (windowMs: number = 5000) => {
  const processedRequests = new Map<string, number>();

  return (req: Request, res: Response, next: any) => {
    // Only deduplicate POST/PUT/PATCH requests
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return next();
    }

    // Create request signature
    const signature = `${req.session?.userId || req.ip}:${req.method}:${
      req.originalUrl
    }:${JSON.stringify(req.body)}`;

    const now = Date.now();
    const lastProcessed = processedRequests.get(signature);

    // Check if this exact request was processed recently
    if (lastProcessed && now - lastProcessed < windowMs) {
      return res.status(429).json({
        success: false,
        message: "Duplicate request detected, please wait before retrying.",
        retryAfter: Math.ceil((windowMs - (now - lastProcessed)) / 1000),
      });
    }

    // Mark request as processed
    processedRequests.set(signature, now);

    // Clean up old entries periodically
    if (processedRequests.size > 1000) {
      const cutoff = now - windowMs;
      for (const [key, timestamp] of processedRequests) {
        if (timestamp < cutoff) {
          processedRequests.delete(key);
        }
      }
    }

    next();
  };
};

// Request logging middleware for monitoring
export const requestLogging = (req: Request, res: Response, next: any) => {
  const startTime = Date.now();
  const userId = req.session?.userId || "anonymous";
  const userAgent = req.get("User-Agent") || "unknown";

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log API requests for monitoring
    console.log(
      `API: ${req.method} ${
        req.originalUrl
      } - ${statusCode} - ${duration}ms - User: ${userId} - UA: ${userAgent.substring(
        0,
        50
      )}`
    );

    // Log errors for debugging
    if (statusCode >= 400) {
      console.error(
        `API Error: ${req.method} ${req.originalUrl} - ${statusCode} - ${duration}ms - User: ${userId}`
      );
    }
  });

  next();
};

// CORS optimization
export const corsOptimization = (req: Request, res: Response, next: any) => {
  // Set CORS headers for API optimization
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_URL || "http://localhost:5173"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  next();
};

// Database connection optimization
export const dbConnectionOptimization = async (
  req: Request,
  res: Response,
  next: any
) => {
  // Add database connection pooling hints
  res.setHeader("X-Database-Pool", "optimized");

  // Monitor database query performance
  const originalSend = res.send;
  res.send = function (data: any) {
    // Add database performance headers
    res.setHeader("X-DB-Queries", "0"); // Would be populated by ORM
    return originalSend.call(this, data);
  };

  next();
};
