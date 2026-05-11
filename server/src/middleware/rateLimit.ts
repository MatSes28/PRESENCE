import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { cacheService } from "../services/cacheService.js";
import { isProductionLike } from "../config/env.js";

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  typeof process.env.JEST_WORKER_ID !== "undefined";

const shouldBypassProtections = (req: Request) =>
  process.env.E2E_DISABLE_RATE_LIMITS === "true" ||
  isTestEnv ||
  (!isProductionLike() && req.headers["x-bypass-protections"] === "true");

const withBypassSkip = (skip?: (req: Request) => boolean) => {
  return (req: Request) => shouldBypassProtections(req) || !!skip?.(req);
};

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
  skip: withBypassSkip(),
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
  skip: withBypassSkip(),
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
  skip: withBypassSkip(),
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
  skip: withBypassSkip(),
});

// User-based rate limiting (more sophisticated)
export const createUserRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string | object;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  skip?: (req: Request) => boolean;
}) => {
  return rateLimit({
    ...options,
    skip: withBypassSkip(options.skip),
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.session?.userId ? `user_${req.session.userId}` : req.ip;
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General API rate limiting (user-based for authenticated users, IP-based for anonymous)
export const generalRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each user/IP to 1000 requests per windowMs (increased for dashboard-heavy usage)
  message: {
    success: false,
    message: "Too many requests, please try again later.",
    retryAfter: 15 * 60,
  },
  // Skip rate limiting for health checks and auth routes (they have their own limits)
  skip: (req) =>
    // Note: this middleware is mounted at `/api`, so paths look like `/health`, `/auth`, etc.
    req.path === "/health" ||
    req.path === "/live" ||
    req.path === "/ready" ||
    req.path === "/metrics" ||
    req.path.startsWith("/auth"),
});

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
        `Slow request: ${method} ${url} - ${duration}ms - Status: ${statusCode}`,
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
    if (
      isTestEnv ||
      typeof req.headers.authorization === "string" ||
      typeof req.headers.cookie === "string"
    ) {
      return next();
    }

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
    if (shouldBypassProtections(req)) {
      return next();
    }

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
        50,
      )}`,
    );

    // Log errors for debugging
    if (statusCode >= 400) {
      console.error(
        `API Error: ${req.method} ${req.originalUrl} - ${statusCode} - ${duration}ms - User: ${userId}`,
      );
    }
  });

  next();
};

// CORS optimization – production config via ALLOWED_ORIGINS, FRONTEND_URL, CORS_ORIGIN
export const corsOptimization = (req: Request, res: Response, next: any) => {
  const origin = req.headers.origin;

  // Build allowed list: ALLOWED_ORIGINS (comma-separated), FRONTEND_URL, CORS_ORIGIN, Railway
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const isProduction =
    process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

  const allowedOrigins = [
    // Only allow localhost in non-production
    ...(!isProduction
      ? ["http://localhost:5173", "http://localhost:3000"]
      : []),
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    process.env.RAILWAY_STATIC_URL,
    ...fromEnv,
  ].filter(Boolean);

  // In production: fail-closed on unknown origins.
  // Note: requests without an Origin header are treated as non-CORS (same-origin or server-to-server).
  if (isProduction) {
    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        return res.status(403).json({
          success: false,
          message: "CORS origin not allowed",
        });
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else {
    // In non-production, echo the request origin (if present) so credentials work.
    // If there is no Origin header, treat it as non-CORS.
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-Device-Api-Key",
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
  next: any,
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
