// CDN Configuration for CLIRDEC:PRESENCE System
// Supports Cloudflare, AWS CloudFront, or similar CDN services

const cdnConfig = {
  // CDN Provider Configuration
  provider: process.env.CDN_PROVIDER || "cloudflare", // 'cloudflare', 'cloudfront', 'fastly'

  // CDN Domain and Origins
  cdnDomain: process.env.CDN_DOMAIN || "cdn.presence.clirdec.edu",
  origins: {
    primary: process.env.PRIMARY_ORIGIN || "presence-app-1:3000",
    fallback: process.env.FALLBACK_ORIGIN || "presence-app-2:3000",
    static: process.env.STATIC_ORIGIN || "presence-static.clirdec.edu",
  },

  // Cache Configuration
  cache: {
    // Static assets - long cache
    static: {
      ttl: 31536000, // 1 year
      staleWhileRevalidate: 86400, // 1 day
      cacheControl: "public, max-age=31536000, immutable",
    },

    // API responses - short cache
    api: {
      ttl: 300, // 5 minutes
      staleWhileRevalidate: 60, // 1 minute
      cacheControl: "public, max-age=300, s-maxage=300",
    },

    // Dynamic content - no cache
    dynamic: {
      ttl: 0,
      cacheControl: "no-cache, no-store, must-revalidate",
    },
  },

  // Compression Settings
  compression: {
    enabled: true,
    algorithms: ["gzip", "brotli"],
    minSize: 1024, // Minimum file size for compression (bytes)
    contentTypes: [
      "text/plain",
      "text/css",
      "text/xml",
      "text/javascript",
      "application/javascript",
      "application/xml",
      "application/json",
      "application/xml+rss",
      "text/html",
    ],
  },

  // Security Headers
  security: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:;",
    },

    // CORS Configuration
    cors: {
      allowedOrigins: [
        "https://presence.clirdec.edu",
        "https://app.presence.clirdec.edu",
        "https://admin.presence.clirdec.edu",
      ],
      allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
      maxAge: 86400, // 24 hours
    },
  },

  // Rate Limiting
  rateLimit: {
    enabled: true,
    requestsPerMinute: {
      api: 100,
      static: 1000,
      auth: 10,
    },
    burstLimit: {
      api: 200,
      static: 2000,
      auth: 20,
    },
  },

  // Geographic Routing
  geoRouting: {
    enabled: true,
    regions: {
      "asia-pacific": ["SG", "JP", "KR", "AU", "IN"],
      europe: ["GB", "DE", "FR", "NL", "IT"],
      americas: ["US", "CA", "BR", "MX"],
      "middle-east": ["AE", "SA", "QA", "KW"],
    },
  },

  // Health Checks
  healthChecks: {
    enabled: true,
    interval: 30, // seconds
    timeout: 5, // seconds
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    path: "/health",
    expectedStatus: 200,
  },

  // Monitoring and Analytics
  monitoring: {
    enabled: true,
    metrics: {
      cacheHitRatio: true,
      responseTime: true,
      errorRate: true,
      bandwidth: true,
      requestsPerSecond: true,
    },
    alerts: {
      highErrorRate: { threshold: 5, window: "5m" },
      highLatency: { threshold: 2000, window: "1m" }, // ms
      cacheMissRatio: { threshold: 80, window: "5m" }, // percentage
    },
  },
};

// CDN Optimization Rules
const optimizationRules = [
  // Static Assets Optimization
  {
    pattern: "/static/*",
    optimizations: {
      cache: cdnConfig.cache.static,
      compression: cdnConfig.compression,
      security: cdnConfig.security.headers,
    },
  },

  // API Endpoints
  {
    pattern: "/api/*",
    optimizations: {
      cache: cdnConfig.cache.api,
      compression: cdnConfig.compression,
      cors: cdnConfig.security.cors,
      rateLimit: cdnConfig.rateLimit.requestsPerMinute.api,
    },
  },

  // Authentication Endpoints (stricter limits)
  {
    pattern: "/api/auth/*",
    optimizations: {
      cache: cdnConfig.cache.dynamic,
      rateLimit: cdnConfig.rateLimit.requestsPerMinute.auth,
      security: {
        ...cdnConfig.security.headers,
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      },
    },
  },

  // WebSocket connections (no caching)
  {
    pattern: "/ws/*",
    optimizations: {
      cache: cdnConfig.cache.dynamic,
      compression: false, // WebSocket frames are already compressed
      security: cdnConfig.security.headers,
    },
  },

  // Images and Media
  {
    pattern: "/*.(jpg|jpeg|png|gif|svg|webp|avif)",
    optimizations: {
      cache: cdnConfig.cache.static,
      compression: false, // Images are already compressed
      imageOptimization: {
        enabled: true,
        formats: ["webp", "avif"],
        quality: 85,
        responsive: true,
      },
    },
  },

  // JavaScript and CSS
  {
    pattern: "/*.(js|css)",
    optimizations: {
      cache: cdnConfig.cache.static,
      compression: cdnConfig.compression,
      minification: true,
      bundling: false, // Assume already bundled
    },
  },
];

// CDN Purge Configuration
const purgeConfig = {
  strategies: {
    // Smart purging based on URL patterns
    smart: {
      enabled: true,
      patterns: [
        "/static/*", // Purge all static assets
        "/api/cache/*", // Purge cached API responses
        "/images/*", // Purge image cache
      ],
    },

    // Tag-based purging for more granular control
    tags: {
      enabled: true,
      tagMapping: {
        "user-avatars": "/uploads/avatars/*",
        "class-schedules": "/api/schedules/*",
        reports: "/api/reports/*",
      },
    },
  },

  // Automatic purge triggers
  autoPurge: {
    onDeploy: true,
    onContentUpdate: true,
    onCacheInvalidation: true,
  },
};

module.exports = {
  cdnConfig,
  optimizationRules,
  purgeConfig,

  // CDN Management Functions
  cdnManager: {
    // Purge cache for specific URLs
    async purgeUrls(urls) {
      // Implementation depends on CDN provider
      console.log(`Purging URLs: ${urls.join(", ")}`);
    },

    // Purge cache by tags
    async purgeTags(tags) {
      console.log(`Purging tags: ${tags.join(", ")}`);
    },

    // Get cache statistics
    async getStats() {
      return {
        cacheHitRatio: 0.95,
        totalRequests: 1000000,
        bandwidthSaved: "500GB",
        averageResponseTime: "50ms",
      };
    },

    // Update CDN configuration
    async updateConfig(newConfig) {
      console.log("Updating CDN configuration:", newConfig);
    },
  },
};
