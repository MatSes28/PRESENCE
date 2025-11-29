import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as v8 from "v8";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { db } from "../storage.js";
import { sql } from "drizzle-orm";

const execAsync = promisify(exec);

// System Health Metrics Interface
interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  }[];
  network: {
    interfaces: {
      name: string;
      rx_bytes: number;
      tx_bytes: number;
      rx_errors: number;
      tx_errors: number;
    }[];
  };
  process: {
    pid: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
  };
}

// Database Performance Metrics
interface DatabaseMetrics {
  timestamp: Date;
  connections: {
    active: number;
    idle: number;
    total: number;
    waiting: number;
    max: number;
  };
  performance: {
    cacheHitRatio: number;
    avgQueryTime: number;
    slowQueries: number;
    deadlocks: number;
    rollbacks: number;
    conflicts: number;
  };
  storage: {
    databaseSize: number;
    indexSize: number;
    tableSize: number;
    walSize: number;
    tempSize: number;
  };
  replication?: {
    isReplica: boolean;
    lag: number;
    status: string;
  };
  vacuum: {
    lastVacuum: Date | null;
    lastAutoVacuum: Date | null;
    activeVacuums: number;
  };
  locks: {
    total: number;
    waiting: number;
    deadlocks: number;
  };
}

// Application Performance Metrics
interface ApplicationMetrics {
  timestamp: Date;
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  business: {
    attendanceRecordsCreated: number;
    rfidScansProcessed: number;
    notificationsSent: number;
    activeUsers: number;
  };
}

// Error Log Entry
interface ErrorLogEntry {
  timestamp: Date;
  level: "error" | "warn" | "info";
  message: string;
  stack?: string;
  context: {
    userId?: number;
    sessionId?: string;
    endpoint?: string;
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
  };
  metadata: Record<string, any>;
}

// Alert Configuration
interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  cooldown: number; // minutes
  enabled: boolean;
}

// Alert Instance
interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: AlertRule["severity"];
  message: string;
  metrics: any;
  resolved: boolean;
  resolvedAt?: Date;
}

// Performance Trace
interface PerformanceTrace {
  id: string;
  timestamp: Date;
  operation: string;
  duration: number;
  success: boolean;
  metadata: {
    userId?: number;
    endpoint?: string;
    databaseQueries?: number;
    cacheHits?: number;
    externalCalls?: number;
    responseTime?: number;
  };
}

class MonitoringService {
  private logger: winston.Logger;
  private metricsInterval: NodeJS.Timeout | null = null;
  private traces: Map<string, PerformanceTrace> = new Map();
  private systemMetricsHistory: SystemMetrics[] = [];
  private applicationMetricsHistory: ApplicationMetrics[] = [];
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  constructor() {
    this.initializeLogger();
    this.initializeAlertRules();
    this.startMetricsCollection();
  }

  // Initialize Winston Logger with structured logging
  private initializeLogger(): void {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level: level.toUpperCase(),
          message,
          stack,
          ...meta,
        });
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: logFormat,
      transports: [
        // Error log file with rotation
        new DailyRotateFile({
          filename: "logs/error-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          level: "error",
          maxSize: "20m",
          maxFiles: "14d",
        }),

        // Combined log file with rotation
        new DailyRotateFile({
          filename: "logs/combined-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          maxSize: "20m",
          maxFiles: "30d",
        }),

        // Performance log file
        new DailyRotateFile({
          filename: "logs/performance-%DATE%.log",
          datePattern: "YYYY-MM-DD",
          level: "info",
          maxSize: "20m",
          maxFiles: "7d",
        }),

        // Console output for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });
  }

  // Initialize alert rules for automated monitoring
  private initializeAlertRules(): void {
    this.alertRules = [
      {
        id: "high_cpu_usage",
        name: "High CPU Usage",
        condition: (metrics) => metrics.cpu?.usage > 90,
        severity: "high",
        message: "CPU usage is above 90%",
        cooldown: 5,
        enabled: true,
      },
      {
        id: "high_memory_usage",
        name: "High Memory Usage",
        condition: (metrics) => metrics.memory?.usagePercent > 90,
        severity: "high",
        message: "Memory usage is above 90%",
        cooldown: 5,
        enabled: true,
      },
      {
        id: "database_connection_issues",
        name: "Database Connection Issues",
        condition: (metrics) => metrics.connections?.active === 0,
        severity: "critical",
        message: "No active database connections",
        cooldown: 1,
        enabled: true,
      },
      {
        id: "high_error_rate",
        name: "High Error Rate",
        condition: (metrics) => {
          const total = metrics.requests?.total || 0;
          const failed = metrics.requests?.failed || 0;
          return total > 10 && failed / total > 0.1; // 10% error rate
        },
        severity: "medium",
        message: "Error rate is above 10%",
        cooldown: 10,
        enabled: true,
      },
      {
        id: "redis_disconnected",
        name: "Redis Disconnected",
        condition: (metrics) => !metrics.redis?.connected,
        severity: "high",
        message: "Redis cache is disconnected",
        cooldown: 2,
        enabled: true,
      },
      {
        id: "database_high_connection_usage",
        name: "High Database Connection Usage",
        condition: (metrics) => {
          const dbMetrics = metrics.database;
          if (!dbMetrics?.connections) return false;
          const usage =
            dbMetrics.connections.active / dbMetrics.connections.max;
          return usage > 0.8; // 80% connection usage
        },
        severity: "medium",
        message: "Database connection pool usage is above 80%",
        cooldown: 5,
        enabled: true,
      },
      {
        id: "database_high_lock_waiting",
        name: "High Lock Waiting",
        condition: (metrics) => {
          const dbMetrics = metrics.database;
          if (!dbMetrics?.locks) return false;
          return dbMetrics.locks.waiting > 10; // More than 10 waiting locks
        },
        severity: "high",
        message: "High number of waiting database locks detected",
        cooldown: 2,
        enabled: true,
      },
      {
        id: "database_vacuum_overdue",
        name: "Vacuum Overdue",
        condition: (metrics) => {
          const dbMetrics = metrics.database;
          if (!dbMetrics?.vacuum?.lastAutoVacuum) return false;
          const hoursSinceVacuum =
            (Date.now() - dbMetrics.vacuum.lastAutoVacuum.getTime()) /
            (1000 * 60 * 60);
          return hoursSinceVacuum > 24; // No vacuum in 24 hours
        },
        severity: "medium",
        message: "Database auto-vacuum has not run in over 24 hours",
        cooldown: 60, // Check every hour
        enabled: true,
      },
      {
        id: "database_replication_lag",
        name: "High Replication Lag",
        condition: (metrics) => {
          const dbMetrics = metrics.database;
          if (!dbMetrics?.replication?.isReplica) return false;
          return dbMetrics.replication.lag > 300; // 5 minutes lag
        },
        severity: "high",
        message: "Database replication lag is over 5 minutes",
        cooldown: 5,
        enabled: true,
      },
      {
        id: "database_low_cache_hit_ratio",
        name: "Low Cache Hit Ratio",
        condition: (metrics) => {
          const dbMetrics = metrics.database;
          if (!dbMetrics?.performance) return false;
          return dbMetrics.performance.cacheHitRatio < 0.85; // Below 85%
        },
        severity: "medium",
        message: "Database cache hit ratio is below 85%",
        cooldown: 30, // Check every 30 minutes
        enabled: true,
      },
    ];
  }

  // Check alert conditions and trigger alerts
  private checkAlerts(metrics: any): void {
    const now = new Date();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastAlert = this.alertCooldowns.get(rule.id);
      if (
        lastAlert &&
        now.getTime() - lastAlert.getTime() < rule.cooldown * 60 * 1000
      ) {
        continue;
      }

      // Check condition
      if (rule.condition(metrics)) {
        this.triggerAlert(rule, metrics);
        this.alertCooldowns.set(rule.id, now);
      }
    }
  }

  // Trigger an alert
  private triggerAlert(rule: AlertRule, metrics: any): void {
    const alertId = `alert_${rule.id}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      message: rule.message,
      metrics,
      resolved: false,
    };

    this.activeAlerts.set(alertId, alert);

    // Log the alert
    this.logger.error("Alert Triggered", {
      type: "alert",
      alert,
    });

    // TODO: Send notifications (email, SMS, etc.) for critical alerts
    if (rule.severity === "critical") {
      console.error(`🚨 CRITICAL ALERT: ${rule.message}`);
      // In production, this would send SMS/email notifications
    }
  }

  // Start collecting system and application metrics
  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const systemMetrics = await this.collectSystemMetrics();
        const databaseMetrics = await this.collectDatabaseMetrics();
        const applicationMetrics = await this.collectApplicationMetrics();

        // Store metrics in memory for recent history
        this.systemMetricsHistory.push(systemMetrics);
        this.applicationMetricsHistory.push(applicationMetrics);

        // Keep only last 100 entries (5 minutes of data)
        if (this.systemMetricsHistory.length > 100) {
          this.systemMetricsHistory.shift();
        }
        if (this.applicationMetricsHistory.length > 100) {
          this.applicationMetricsHistory.shift();
        }

        // Check for alerts based on collected metrics
        this.checkAlerts({
          system: systemMetrics,
          database: databaseMetrics,
          application: applicationMetrics,
          redis: { connected: true }, // TODO: Add Redis health check
        });

        // Log metrics for monitoring
        this.logger.info("System Metrics Collected", {
          type: "metrics",
          category: "system",
          data: systemMetrics,
        });

        this.logger.info("Database Metrics Collected", {
          type: "metrics",
          category: "database",
          data: databaseMetrics,
        });

        this.logger.info("Application Metrics Collected", {
          type: "metrics",
          category: "application",
          data: applicationMetrics,
        });
      } catch (error) {
        this.logger.error("Failed to collect metrics", {
          error: error.message,
          stack: error.stack,
        });
      }
    }, 30000); // 30 seconds
  }

  // Collect comprehensive system metrics
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsage = 100 - ~~((100 * idle) / total);

    // Get disk usage
    const diskUsage = await this.getDiskUsage();

    // Get network interfaces
    const networkInterfaces = os.networkInterfaces();
    const networkStats = await this.getNetworkStats();

    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: cpus.length,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: (usedMemory / totalMemory) * 100,
      },
      disk: diskUsage,
      network: {
        interfaces: networkStats,
      },
      process: {
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  // Get disk usage for all mounted filesystems
  private async getDiskUsage(): Promise<SystemMetrics["disk"]> {
    try {
      // Cross-platform disk usage detection
      const platform = process.platform;

      if (platform === "win32") {
        // Windows: Use fs.statSync to get drive information
        const drives = ["C:", "D:", "E:", "F:"]; // Common drive letters
        const diskInfo: SystemMetrics["disk"] = [];

        for (const drive of drives) {
          try {
            const stats = fs.statSync(drive);
            // On Windows, we can't easily get total/free space without additional APIs
            // Return basic info to avoid errors
            diskInfo.push({
              total: 0, // Would need Windows Management Instrumentation (WMI) or PowerShell
              used: 0,
              free: 0,
              usagePercent: 0,
            });
          } catch (error) {
            // Drive doesn't exist or not accessible, skip
            continue;
          }
        }

        // If no drives found, return fallback
        if (diskInfo.length === 0) {
          return [
            {
              total: 0,
              used: 0,
              free: 0,
              usagePercent: 0,
            },
          ];
        }

        return diskInfo;
      } else {
        // Unix-like systems: Use df command
        const { stdout } = await execAsync("df -k | tail -n +2");
        const lines = stdout.trim().split("\n");

        return lines.map((line) => {
          const parts = line.split(/\s+/);
          const total = parseInt(parts[1]) * 1024; // Convert to bytes
          const used = parseInt(parts[2]) * 1024;
          const free = parseInt(parts[3]) * 1024;

          return {
            total,
            used,
            free,
            usagePercent: (used / total) * 100,
          };
        });
      }
    } catch (error) {
      // Fallback for systems where disk detection fails
      return [
        {
          total: 0,
          used: 0,
          free: 0,
          usagePercent: 0,
        },
      ];
    }
  }

  // Get network interface statistics
  private async getNetworkStats(): Promise<
    SystemMetrics["network"]["interfaces"]
  > {
    try {
      // This is a simplified implementation
      // In production, you might use system-specific APIs or libraries
      const interfaces = os.networkInterfaces();
      const stats: SystemMetrics["network"]["interfaces"] = [];

      for (const [name, addresses] of Object.entries(interfaces)) {
        if (addresses && addresses.length > 0) {
          stats.push({
            name,
            rx_bytes: 0, // Would need system-specific implementation
            tx_bytes: 0,
            rx_errors: 0,
            tx_errors: 0,
          });
        }
      }

      return stats;
    } catch (error) {
      return [];
    }
  }

  // Collect database performance metrics
  private async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      let connStats = {
        active_connections: 0,
        idle_connections: 0,
        total_connections: 0,
        waiting_connections: 0,
      };
      let sizeStats = { database_size: 0, index_size: 0, table_size: 0 };
      let performance = { cache_hit_ratio: 0, avg_query_time: 0 };

      // Get basic connection test
      try {
        await db.execute(sql`SELECT 1 as connection_test`);
        connStats.total_connections = 1; // At least our connection works
        connStats.active_connections = 1;
      } catch (error) {
        this.logger.warn("Database connection test failed", {
          error: error.message,
        });
      }

      // Get database size information (try alternative method)
      try {
        // Use information_schema instead of pg_database_size for better compatibility
        const tableSizeResult = await db.execute(sql`
          SELECT
            SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
            SUM(pg_relation_size(schemaname||'.'||tablename)) as table_size,
            SUM(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
          FROM pg_tables
          WHERE schemaname = 'public'
        `);

        if (tableSizeResult[0]) {
          const result = tableSizeResult[0] as any;
          sizeStats.database_size = Number(result.total_size) || 0;
          sizeStats.table_size = Number(result.table_size) || 0;
          sizeStats.index_size = Number(result.index_size) || 0;
        }
      } catch (error) {
        this.logger.warn("Failed to collect database size metrics", {
          error: error.message,
        });

        // Fallback: try to get approximate size from system catalogs
        try {
          const approxResult = await db.execute(sql`
            SELECT COUNT(*) as table_count FROM information_schema.tables
            WHERE table_schema = 'public'
          `);
          // Estimate size based on table count (rough approximation)
          const tableCount = Number((approxResult[0] as any).table_count) || 0;
          sizeStats.database_size = tableCount * 1024 * 1024; // Rough 1MB per table estimate
        } catch (fallbackError) {
          this.logger.warn("Fallback database size estimation also failed", {
            error: fallbackError.message,
          });
        }
      }

      // Try to get connection info from pg_stat_activity (may require permissions)
      try {
        const connectionStats = await db.execute(sql`
          SELECT
            COUNT(*) as total_connections,
            COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
            COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections
          FROM pg_stat_activity
          WHERE datname = current_database()
        `);

        if (connectionStats[0]) {
          const result = connectionStats[0] as any;
          connStats.total_connections = Number(result.total_connections) || 1;
          connStats.active_connections = Number(result.active_connections) || 1;
          connStats.idle_connections = Number(result.idle_connections) || 0;
        }
      } catch (error) {
        this.logger.debug(
          "pg_stat_activity not accessible, using basic connection info",
          {
            error: error.message,
          }
        );
        // Keep the basic connection info we set earlier
      }

      // Try performance stats if pg_stat_statements is available
      try {
        const perfStats = await db.execute(sql`
          SELECT
            COALESCE(sum(blks_hit) * 100.0 / NULLIF((sum(blks_hit) + sum(blks_read)), 0), 0) as cache_hit_ratio,
            COALESCE(avg(total_time / NULLIF(calls, 0)), 0) as avg_query_time
          FROM pg_stat_statements
          WHERE calls > 0
        `);

        if (perfStats[0]) {
          const result = perfStats[0] as any;
          performance.cache_hit_ratio = Number(result.cache_hit_ratio) || 0;
          performance.avg_query_time = Number(result.avg_query_time) || 0;
        }
      } catch (error) {
        this.logger.debug(
          "pg_stat_statements not available, performance metrics disabled",
          {
            error: error.message,
          }
        );
      }

      // Get additional database metrics
      let vacuumStats = {
        last_vacuum: null,
        last_autovacuum: null,
        active_vacuums: 0,
      };
      let lockStats = { total_locks: 0, waiting_locks: 0, deadlocks: 0 };
      let replicationStats = { is_replica: false, lag: 0, status: "primary" };

      // Get vacuum statistics
      try {
        const vacuumResult = await db.execute(sql`
          SELECT
            schemaname,
            last_vacuum,
            last_autovacuum,
            vacuum_count,
            autovacuum_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          LIMIT 1
        `);

        if (vacuumResult[0]) {
          const result = vacuumResult[0] as any;
          vacuumStats.last_vacuum = result.last_vacuum;
          vacuumStats.last_autovacuum = result.last_autovacuum;
        }

        // Get active vacuum processes
        const activeVacuumResult = await db.execute(sql`
          SELECT COUNT(*) as active_vacuums
          FROM pg_stat_activity
          WHERE query LIKE '%VACUUM%' AND state = 'active'
        `);
        vacuumStats.active_vacuums =
          Number((activeVacuumResult[0] as any).active_vacuums) || 0;
      } catch (error) {
        this.logger.debug("Failed to collect vacuum statistics", {
          error: error.message,
        });
      }

      // Get lock statistics
      try {
        const lockResult = await db.execute(sql`
          SELECT
            COUNT(*) as total_locks,
            COUNT(CASE WHEN granted = false THEN 1 END) as waiting_locks
          FROM pg_locks
          WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
        `);

        if (lockResult[0]) {
          const result = lockResult[0] as any;
          lockStats.total_locks = Number(result.total_locks) || 0;
          lockStats.waiting_locks = Number(result.waiting_locks) || 0;
        }

        // Get deadlock count (from pg_stat_database)
        const deadlockResult = await db.execute(sql`
          SELECT deadlocks
          FROM pg_stat_database
          WHERE datname = current_database()
        `);
        lockStats.deadlocks = Number((deadlockResult[0] as any).deadlocks) || 0;
      } catch (error) {
        this.logger.debug("Failed to collect lock statistics", {
          error: error.message,
        });
      }

      // Get replication status (if available)
      try {
        const replicationResult = await db.execute(sql`
          SELECT
            CASE WHEN pg_is_in_recovery() THEN true ELSE false END as is_replica,
            CASE WHEN pg_is_in_recovery()
              THEN EXTRACT(epoch FROM now() - pg_last_xact_replay_timestamp())
              ELSE 0
            END as lag_seconds
        `);

        if (replicationResult[0]) {
          const result = replicationResult[0] as any;
          replicationStats.is_replica = result.is_replica;
          replicationStats.lag = Number(result.lag_seconds) || 0;
          replicationStats.status = result.is_replica ? "replica" : "primary";
        }
      } catch (error) {
        this.logger.debug("Failed to collect replication statistics", {
          error: error.message,
        });
      }

      const metrics: DatabaseMetrics = {
        timestamp: new Date(),
        connections: {
          active: Number(connStats.active_connections) || 0,
          idle: Number(connStats.idle_connections) || 0,
          total: Number(connStats.total_connections) || 0,
          waiting: Number(connStats.waiting_connections) || 0,
          max: 100, // Default max connections, could be queried from settings
        },
        performance: {
          cacheHitRatio: Number(performance.cache_hit_ratio) || 0,
          avgQueryTime: Number(performance.avg_query_time) || 0,
          slowQueries: 0, // Would need pg_stat_statements
          deadlocks: lockStats.deadlocks,
          rollbacks: 0, // Would need additional tracking
          conflicts: 0, // Would need additional tracking
        },
        storage: {
          databaseSize: Number(sizeStats.database_size) || 0,
          indexSize: Number(sizeStats.index_size) || 0,
          tableSize: Number(sizeStats.table_size) || 0,
          walSize: 0, // Would need to query WAL directory size
          tempSize: 0, // Would need to query temp file size
        },
        replication: {
          isReplica: replicationStats.is_replica,
          lag: replicationStats.lag,
          status: replicationStats.status,
        },
        vacuum: {
          lastVacuum: vacuumStats.last_vacuum
            ? new Date(vacuumStats.last_vacuum)
            : null,
          lastAutoVacuum: vacuumStats.last_autovacuum
            ? new Date(vacuumStats.last_autovacuum)
            : null,
          activeVacuums: vacuumStats.active_vacuums,
        },
        locks: {
          total: lockStats.total_locks,
          waiting: lockStats.waiting_locks,
          deadlocks: lockStats.deadlocks,
        },
      };

      this.logger.debug("Database metrics collected", metrics);
      return metrics;
    } catch (error) {
      this.logger.error("Failed to collect database metrics", {
        error: error.message,
        stack: error.stack,
      });
      return {
        timestamp: new Date(),
        connections: { active: 0, idle: 0, total: 0, waiting: 0, max: 0 },
        performance: {
          cacheHitRatio: 0,
          avgQueryTime: 0,
          slowQueries: 0,
          deadlocks: 0,
          rollbacks: 0,
          conflicts: 0,
        },
        storage: {
          databaseSize: 0,
          indexSize: 0,
          tableSize: 0,
          walSize: 0,
          tempSize: 0,
        },
        replication: {
          isReplica: false,
          lag: 0,
          status: "unknown",
        },
        vacuum: {
          lastVacuum: null,
          lastAutoVacuum: null,
          activeVacuums: 0,
        },
        locks: {
          total: 0,
          waiting: 0,
          deadlocks: 0,
        },
      };
    }
  }

  // Collect application performance metrics
  private async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    try {
      // Get attendance records created in last hour
      const attendanceResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM attendance_records
        WHERE created_at >= NOW() - INTERVAL '1 hour'
      `);

      // Get RFID scans in last hour
      const rfidResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM attendance_records
        WHERE rfid_detected = true AND created_at >= NOW() - INTERVAL '1 hour'
      `);

      const attendanceCount = parseInt((attendanceResult[0] as any).count) || 0;
      const rfidCount = parseInt((rfidResult[0] as any).count) || 0;

      // Get active users (users who logged in recently)
      // Note: This query may fail if user_sessions table doesn't exist or has different structure
      let activeUsersCount = 0;
      try {
        const activeUsersResult = await db.execute(sql`
          SELECT COUNT(DISTINCT user_id) as count
          FROM user_sessions
          WHERE is_active = true AND expires_at > NOW()
        `);
        activeUsersCount = parseInt((activeUsersResult[0] as any).count) || 0;
      } catch (error) {
        // Silently fail if table doesn't exist or query fails
        activeUsersCount = 0;
      }

      return {
        timestamp: new Date(),
        requests: {
          total: 0, // Would be collected from middleware
          successful: 0,
          failed: 0,
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
        },
        errors: {
          total: 0,
          byType: {},
          byEndpoint: {},
        },
        business: {
          attendanceRecordsCreated: attendanceCount,
          rfidScansProcessed: rfidCount,
          notificationsSent: 0, // Would be tracked separately
          activeUsers: activeUsersCount,
        },
      };
    } catch (error) {
      this.logger.error("Failed to collect application metrics", {
        error: error.message,
      });
      return {
        timestamp: new Date(),
        requests: {
          total: 0,
          successful: 0,
          failed: 0,
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
        },
        errors: { total: 0, byType: {}, byEndpoint: {} },
        business: {
          attendanceRecordsCreated: 0,
          rfidScansProcessed: 0,
          notificationsSent: 0,
          activeUsers: 0,
        },
      };
    }
  }

  // Error logging methods
  public logError(
    error: Error,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata: Record<string, any> = {}
  ): void {
    const errorEntry: ErrorLogEntry = {
      timestamp: new Date(),
      level: "error",
      message: error.message,
      stack: error.stack,
      context: {
        endpoint: context.endpoint,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId,
      },
      metadata,
    };

    this.logger.error("Application Error", errorEntry);
  }

  public logWarning(
    message: string,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata: Record<string, any> = {}
  ): void {
    const warningEntry: ErrorLogEntry = {
      timestamp: new Date(),
      level: "warn",
      message,
      context: {
        endpoint: context.endpoint,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        requestId: context.requestId,
      },
      metadata,
    };

    this.logger.warn("Application Warning", warningEntry);
  }

  public logInfo(
    message: string,
    context: Partial<ErrorLogEntry["context"]> = {},
    metadata: Record<string, any> = {}
  ): void {
    this.logger.info(message, { context, metadata, type: "info" });
  }

  // Performance monitoring methods
  public startTrace(
    operation: string,
    metadata: Partial<PerformanceTrace["metadata"]> = {}
  ): string {
    const traceId = `trace_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const trace: PerformanceTrace = {
      id: traceId,
      timestamp: new Date(),
      operation,
      duration: 0,
      success: false,
      metadata: {
        userId: metadata.userId,
        endpoint: metadata.endpoint,
        databaseQueries: 0,
        cacheHits: 0,
        externalCalls: 0,
      },
    };

    this.traces.set(traceId, trace);
    return traceId;
  }

  public endTrace(
    traceId: string,
    success: boolean = true,
    additionalMetadata: Partial<PerformanceTrace["metadata"]> = {}
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.duration = Date.now() - trace.timestamp.getTime();
    trace.success = success;

    // Merge additional metadata
    Object.assign(trace.metadata, additionalMetadata);

    // Log performance trace
    this.logger.info("Performance Trace", {
      type: "performance",
      trace,
    });

    // Remove completed trace
    this.traces.delete(traceId);
  }

  // Middleware for request monitoring
  public createRequestMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const traceId = this.startTrace(`${req.method} ${req.path}`, {
        endpoint: req.path,
        userId: req.session?.userId,
      });

      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args: any[]) => {
        const duration = Date.now() - startTime;

        // Update application metrics
        const currentMetrics =
          this.applicationMetricsHistory[
            this.applicationMetricsHistory.length - 1
          ];
        if (currentMetrics) {
          currentMetrics.requests.total++;
          if (res.statusCode >= 200 && res.statusCode < 400) {
            currentMetrics.requests.successful++;
          } else {
            currentMetrics.requests.failed++;
          }
        }

        // Log request details
        this.logger.info("HTTP Request", {
          type: "request",
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get("User-Agent"),
          ipAddress: req.ip,
          userId: req.session?.userId,
          traceId,
        });

        this.endTrace(traceId, res.statusCode >= 200 && res.statusCode < 400, {
          responseTime: duration,
        });

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Health check endpoint data
  public getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    uptime: number;
    system: Partial<SystemMetrics>;
    database: Partial<DatabaseMetrics>;
    application: Partial<ApplicationMetrics>;
    timestamp: Date;
  } {
    const latestSystem =
      this.systemMetricsHistory[this.systemMetricsHistory.length - 1];
    const latestApp =
      this.applicationMetricsHistory[this.applicationMetricsHistory.length - 1];

    // Determine overall health status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (latestSystem) {
      if (
        latestSystem.cpu.usage > 90 ||
        latestSystem.memory.usagePercent > 90
      ) {
        status = "unhealthy";
      } else if (
        latestSystem.cpu.usage > 70 ||
        latestSystem.memory.usagePercent > 80
      ) {
        status = "degraded";
      }
    }

    return {
      status,
      uptime: process.uptime(),
      system: latestSystem
        ? {
            cpu: latestSystem.cpu,
            memory: latestSystem.memory,
            disk: latestSystem.disk,
          }
        : {},
      database: {}, // Would be populated with latest database metrics
      application: latestApp
        ? {
            requests: latestApp.requests,
            errors: latestApp.errors,
            business: latestApp.business,
          }
        : {},
      timestamp: new Date(),
    };
  }

  // Get metrics for Prometheus
  public async getPrometheusMetrics(): Promise<string> {
    const health = this.getHealthStatus();
    const latestSystem =
      this.systemMetricsHistory[this.systemMetricsHistory.length - 1];

    let metrics = "# HELP presence_system_cpu_usage CPU usage percentage\n";
    metrics += "# TYPE presence_system_cpu_usage gauge\n";
    if (latestSystem) {
      metrics += `presence_system_cpu_usage ${latestSystem.cpu.usage}\n`;
    }

    metrics += "# HELP presence_system_memory_usage Memory usage percentage\n";
    metrics += "# TYPE presence_system_memory_usage gauge\n";
    if (latestSystem) {
      metrics += `presence_system_memory_usage ${latestSystem.memory.usagePercent}\n`;
    }

    metrics +=
      "# HELP presence_system_status System health status (0=healthy, 1=degraded, 2=unhealthy)\n";
    metrics += "# TYPE presence_system_status gauge\n";
    const statusValue =
      health.status === "healthy" ? 0 : health.status === "degraded" ? 1 : 2;
    metrics += `presence_system_status ${statusValue}\n`;

    metrics += "# HELP presence_uptime_seconds Application uptime in seconds\n";
    metrics += "# TYPE presence_uptime_seconds counter\n";
    metrics += `presence_uptime_seconds ${health.uptime}\n`;

    return metrics;
  }

  // Heap profiling methods for memory analysis
  public takeHeapSnapshot(): string {
    try {
      const snapshotPath = path.join(
        process.cwd(),
        "logs",
        `heap-${Date.now()}.heapsnapshot`
      );

      // Ensure logs directory exists
      if (!fs.existsSync(path.dirname(snapshotPath))) {
        fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      }

      // Take heap snapshot
      const snapshot = v8.writeHeapSnapshot(snapshotPath);

      this.logger.info("Heap snapshot taken", {
        type: "profiling",
        path: snapshotPath,
        size: fs.statSync(snapshotPath).size,
      });

      return snapshotPath;
    } catch (error) {
      this.logger.error("Failed to take heap snapshot", {
        error: error.message,
      });
      throw error;
    }
  }

  // CPU profiling methods
  public startCpuProfiling(): string {
    try {
      const profileId = `cpu-profile-${Date.now()}`;
      // Note: In Node.js, CPU profiling requires additional setup with inspector
      // This is a placeholder for more advanced profiling implementation
      this.logger.info("CPU profiling started", {
        type: "profiling",
        profileId,
      });
      return profileId;
    } catch (error) {
      this.logger.error("Failed to start CPU profiling", {
        error: error.message,
      });
      throw error;
    }
  }

  public stopCpuProfiling(profileId: string): void {
    try {
      this.logger.info("CPU profiling stopped", {
        type: "profiling",
        profileId,
      });
    } catch (error) {
      this.logger.error("Failed to stop CPU profiling", {
        error: error.message,
      });
      throw error;
    }
  }

  // Get memory statistics
  public getMemoryStats(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapUsagePercent: number;
  } {
    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      heapUsagePercent,
    };
  }

  // Cleanup method
  public destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

// Graceful shutdown
process.on("SIGINT", () => {
  monitoringService.destroy();
});

process.on("SIGTERM", () => {
  monitoringService.destroy();
});
