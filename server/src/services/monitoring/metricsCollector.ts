import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import db, { dbClient } from "../../storage.js";
import { sql } from "drizzle-orm";
import { loggerService } from "./logger.js";

const execAsync = promisify(exec);

function isSqlite(): boolean {
  return (
    !!dbClient &&
    typeof dbClient.prepare === "function" &&
    typeof dbClient.exec === "function"
  );
}

// System Health Metrics Interface
export interface SystemMetrics {
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
export interface DatabaseMetrics {
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
export interface ApplicationMetrics {
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

export class MetricsCollector {
  // Collect comprehensive system metrics
  public async collectSystemMetrics(): Promise<SystemMetrics> {
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
        // Windows: Use PowerShell to get drive information
        try {
          const { stdout } = await execAsync(
            'powershell -Command "Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object DeviceID, Size, FreeSpace | ConvertTo-Json"',
          );

          const drives = JSON.parse(stdout.trim());
          const diskInfo: SystemMetrics["disk"] = [];

          // Handle single drive (PowerShell returns object) or multiple drives (array)
          const driveArray = Array.isArray(drives) ? drives : [drives];

          for (const drive of driveArray) {
            if (drive.Size && drive.Size > 0) {
              const total = Number(drive.Size);
              const free = Number(drive.FreeSpace || 0);
              const used = total - free;
              const usagePercent = (used / total) * 100;

              diskInfo.push({
                total,
                used,
                free,
                usagePercent,
              });
            }
          }

          // If PowerShell method fails or no drives found, try fs.statSync as fallback
          if (diskInfo.length === 0) {
            const fallbackDrives = ["C:", "D:", "E:", "F:"];
            for (const drive of fallbackDrives) {
              try {
                fs.statSync(drive);
                // If we can stat the drive, assume it's accessible but we can't get size info
                diskInfo.push({
                  total: 0, // Unknown
                  used: 0,
                  free: 0,
                  usagePercent: 0,
                });
              } catch (error) {
                // Drive doesn't exist or not accessible, skip
                continue;
              }
            }
          }

          return diskInfo.length > 0
            ? diskInfo
            : [
                {
                  total: 0,
                  used: 0,
                  free: 0,
                  usagePercent: 0,
                },
              ];
        } catch (error) {
          // Fallback to basic drive detection if PowerShell fails
          const drives = ["C:", "D:", "E:", "F:"];
          const diskInfo: SystemMetrics["disk"] = [];

          for (const drive of drives) {
            try {
              fs.statSync(drive);
              diskInfo.push({
                total: 0, // Cannot determine on Windows without additional tools
                used: 0,
                free: 0,
                usagePercent: 0,
              });
            } catch (error) {
              continue;
            }
          }

          return diskInfo.length > 0
            ? diskInfo
            : [
                {
                  total: 0,
                  used: 0,
                  free: 0,
                  usagePercent: 0,
                },
              ];
        }
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
      const platform = process.platform;

      if (platform === "win32") {
        // Windows: Use PowerShell to get network interface statistics
        try {
          const { stdout } = await execAsync(
            "powershell -Command \"Get-NetAdapterStatistics | Where-Object { $_.Name -notlike '*Loopback*' -and $_.Name -notlike '*isatap*' -and $_.Name -notlike '*teredo*' } | Select-Object Name, ReceivedBytes, SentBytes, ReceivedPacketsDropped, SentPacketsDropped | ConvertTo-Json\"",
          );

          const interfaces = os.networkInterfaces();
          const stats: SystemMetrics["network"]["interfaces"] = [];

          let netStats: any[] = [];
          try {
            netStats = JSON.parse(stdout.trim());
            // Handle single adapter case
            if (!Array.isArray(netStats)) {
              netStats = [netStats];
            }
          } catch (parseError) {
            // If JSON parsing fails, fall back to basic interface listing
            console.warn(
              "Failed to parse network statistics JSON, using basic interface info",
            );
          }

          for (const [name, addresses] of Object.entries(interfaces)) {
            if (
              addresses &&
              addresses.length > 0 &&
              !name.includes("Loopback")
            ) {
              // Find matching stats from PowerShell output
              const adapterStats = netStats.find(
                (stat: any) =>
                  stat.Name &&
                  name
                    .toLowerCase()
                    .includes(stat.Name.toLowerCase().replace(/\s+/g, "")),
              );

              stats.push({
                name,
                rx_bytes: adapterStats
                  ? Number(adapterStats.ReceivedBytes) || 0
                  : 0,
                tx_bytes: adapterStats
                  ? Number(adapterStats.SentBytes) || 0
                  : 0,
                rx_errors: adapterStats
                  ? Number(adapterStats.ReceivedPacketsDropped) || 0
                  : 0,
                tx_errors: adapterStats
                  ? Number(adapterStats.SentPacketsDropped) || 0
                  : 0,
              });
            }
          }

          return stats;
        } catch (error) {
          console.warn(
            "PowerShell network stats failed, using basic interface info:",
            error,
          );
          // Fallback to basic interface listing
          const interfaces = os.networkInterfaces();
          const stats: SystemMetrics["network"]["interfaces"] = [];

          for (const [name, addresses] of Object.entries(interfaces)) {
            if (
              addresses &&
              addresses.length > 0 &&
              !name.includes("Loopback")
            ) {
              stats.push({
                name,
                rx_bytes: 0,
                tx_bytes: 0,
                rx_errors: 0,
                tx_errors: 0,
              });
            }
          }

          return stats;
        }
      } else {
        // Unix-like systems: Try multiple approaches for network stats
        try {
          // First try to detect if we have standard ip command
          let stats: SystemMetrics["network"]["interfaces"] = [];

          try {
            // Try standard ip command syntax first
            const { stdout } = await execAsync("ip -s link show");
            stats = this.parseIpLinkOutput(stdout);
          } catch (ipError) {
            try {
              // Try BusyBox compatible syntax
              const { stdout } = await execAsync("ip link show");
              stats = this.parseBusyBoxIpOutput(stdout);
            } catch (busyBoxError) {
              // Try using /proc/net/dev as fallback
              stats = await this.parseProcNetDev();
            }
          }

          return stats.length > 0 ? stats : this.getBasicNetworkStats();
        } catch (error) {
          console.warn(
            "All network stats collection methods failed, using basic interface info:",
            error,
          );
          return this.getBasicNetworkStats();
        }
      }
    } catch (error) {
      console.warn("Failed to collect network statistics:", error);
      return this.getBasicNetworkStats();
    }
  }

  // Parse standard ip link output
  private parseIpLinkOutput(
    output: string,
  ): SystemMetrics["network"]["interfaces"] {
    const lines = output.trim().split("\n");
    const interfaces = os.networkInterfaces();
    const stats: SystemMetrics["network"]["interfaces"] = [];

    let currentInterface = "";
    let rxBytes = 0;
    let txBytes = 0;
    let rxErrors = 0;
    let txErrors = 0;

    for (const line of lines) {
      if (line.match(/^[0-9]+:\s+([^:]+):/)) {
        // New interface
        if (currentInterface && !currentInterface.includes("lo")) {
          stats.push({
            name: currentInterface,
            rx_bytes: rxBytes,
            tx_bytes: txBytes,
            rx_errors: rxErrors,
            tx_errors: txErrors,
          });
        }
        currentInterface = line.split(":")[1].trim();
        rxBytes = 0;
        txBytes = 0;
        rxErrors = 0;
        txErrors = 0;
      } else if (line.includes("RX:")) {
        const rxMatch = line.match(/RX:\s+bytes\s+(\d+)/);
        if (rxMatch) rxBytes = parseInt(rxMatch[1]);
        const rxErrorMatch = line.match(/errors\s+(\d+)/);
        if (rxErrorMatch) rxErrors = parseInt(rxErrorMatch[1]);
      } else if (line.includes("TX:")) {
        const txMatch = line.match(/TX:\s+bytes\s+(\d+)/);
        if (txMatch) txBytes = parseInt(txMatch[1]);
        const txErrorMatch = line.match(/errors\s+(\d+)/);
        if (txErrorMatch) txErrors = parseInt(txErrorMatch[1]);
      }
    }

    // Add the last interface
    if (currentInterface && !currentInterface.includes("lo")) {
      stats.push({
        name: currentInterface,
        rx_bytes: rxBytes,
        tx_bytes: txBytes,
        rx_errors: rxErrors,
        tx_errors: txErrors,
      });
    }

    return stats;
  }

  // Parse BusyBox ip link output (simpler format)
  private parseBusyBoxIpOutput(
    output: string,
  ): SystemMetrics["network"]["interfaces"] {
    const lines = output.trim().split("\n");
    const interfaces = os.networkInterfaces();
    const stats: SystemMetrics["network"]["interfaces"] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (addresses && addresses.length > 0 && !name.includes("Loopback")) {
        // For BusyBox, we can't get detailed stats, so we return basic info
        stats.push({
          name,
          rx_bytes: 0, // BusyBox ip doesn't provide detailed stats
          tx_bytes: 0,
          rx_errors: 0,
          tx_errors: 0,
        });
      }
    }

    return stats;
  }

  // Parse /proc/net/dev for network statistics
  private async parseProcNetDev(): Promise<
    SystemMetrics["network"]["interfaces"]
  > {
    try {
      const output = await fs.promises.readFile("/proc/net/dev", "utf8");
      const lines = output.trim().split("\n").slice(2); // Skip header lines
      const stats: SystemMetrics["network"]["interfaces"] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 17) {
          const interfaceName = parts[0].replace(":", "");
          if (!interfaceName.includes("lo")) {
            stats.push({
              name: interfaceName,
              rx_bytes: parseInt(parts[1]) || 0,
              tx_bytes: parseInt(parts[9]) || 0,
              rx_errors: parseInt(parts[3]) || 0,
              tx_errors: parseInt(parts[11]) || 0,
            });
          }
        }
      }

      return stats;
    } catch (error) {
      // If /proc/net/dev is not available, fall back to basic info
      return this.getBasicNetworkStats();
    }
  }

  // Fallback method for basic network interface information
  private getBasicNetworkStats(): SystemMetrics["network"]["interfaces"] {
    const interfaces = os.networkInterfaces();
    const stats: SystemMetrics["network"]["interfaces"] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (addresses && addresses.length > 0 && !name.includes("Loopback")) {
        stats.push({
          name,
          rx_bytes: 0,
          tx_bytes: 0,
          rx_errors: 0,
          tx_errors: 0,
        });
      }
    }

    return stats;
  }

  // Collect database performance metrics
  public async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // SQLite is used for local/dev convenience only; production uses Postgres.
      // Avoid running Postgres-specific catalog queries on SQLite.
      if (isSqlite()) {
        let databaseSize = 0;
        try {
          const pageCount = (await db.execute("PRAGMA page_count")) as any[];
          const pageSize = (await db.execute("PRAGMA page_size")) as any[];
          const pc =
            Number(
              pageCount?.[0]?.page_count ?? pageCount?.[0]?.["page_count"],
            ) || 0;
          const ps =
            Number(pageSize?.[0]?.page_size ?? pageSize?.[0]?.["page_size"]) ||
            0;
          databaseSize = pc * ps;
        } catch {
          databaseSize = 0;
        }

        return {
          timestamp: new Date(),
          connections: { active: 1, idle: 0, total: 1, waiting: 0, max: 1 },
          performance: {
            cacheHitRatio: 0,
            avgQueryTime: 0,
            slowQueries: 0,
            deadlocks: 0,
            rollbacks: 0,
            conflicts: 0,
          },
          storage: {
            databaseSize,
            indexSize: 0,
            tableSize: 0,
            walSize: 0,
            tempSize: 0,
          },
          replication: { isReplica: false, lag: 0, status: "primary" },
          vacuum: { lastVacuum: null, lastAutoVacuum: null, activeVacuums: 0 },
          locks: { total: 0, waiting: 0, deadlocks: 0 },
        };
      }

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
        loggerService.getLogger().warn("Database connection test failed", {
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
        loggerService
          .getLogger()
          .warn("Failed to collect database size metrics", {
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
          loggerService
            .getLogger()
            .warn("Fallback database size estimation also failed", {
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
        loggerService
          .getLogger()
          .debug(
            "pg_stat_activity not accessible, using basic connection info",
            {
              error: error.message,
            },
          );
        // Keep the basic connection info we set earlier
      }

      // Skip pg_stat_statements queries entirely on Railway
      // Railway's PostgreSQL doesn't support pg_stat_statements properly
      // (requires shared_preload_libraries configuration that isn't available on Railway)
      // Performance metrics will show as 0
      loggerService
        .getLogger()
        .debug(
          "pg_stat_statements skipped - not supported on Railway PostgreSQL",
        );

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
        loggerService.getLogger().debug("Failed to collect vacuum statistics", {
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
        loggerService.getLogger().debug("Failed to collect lock statistics", {
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
        loggerService
          .getLogger()
          .debug("Failed to collect replication statistics", {
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

      loggerService.getLogger().debug("Database metrics collected", metrics);
      return metrics;
    } catch (error) {
      loggerService.getLogger().error("Failed to collect database metrics", {
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
  public async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    try {
      if (isSqlite()) {
        // SQLite-compatible time arithmetic.
        // NOTE: These columns are created by apply-sqlite-migrations.js and may not exist in every dev DB.
        let attendanceCount = 0;
        let rfidCount = 0;

        try {
          const attendanceResult = (await db.execute(
            "SELECT COUNT(*) as count FROM attendance_records WHERE created_at >= datetime('now','-1 hour')",
          )) as any[];
          attendanceCount = parseInt(attendanceResult?.[0]?.count) || 0;
        } catch {
          attendanceCount = 0;
        }

        try {
          const rfidResult = (await db.execute(
            "SELECT COUNT(*) as count FROM attendance_records WHERE rfidDetected = 1 AND created_at >= datetime('now','-1 hour')",
          )) as any[];
          rfidCount = parseInt(rfidResult?.[0]?.count) || 0;
        } catch {
          rfidCount = 0;
        }

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
          errors: {
            total: 0,
            byType: {},
            byEndpoint: {},
          },
          business: {
            attendanceRecordsCreated: attendanceCount,
            rfidScansProcessed: rfidCount,
            notificationsSent: 0,
            activeUsers: 0,
          },
        };
      }

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
        // Check if table exists first
        const tableCheck = await db.execute(sql`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'user_sessions' AND table_schema = 'public'
        `);

        if (tableCheck.length === 0) {
          // Table doesn't exist, skip silently
          loggerService
            .getLogger()
            .debug(
              "user_sessions table not found. Run migrations to create it.",
            );
        } else {
          const activeUsersResult = await db.execute(sql`
            SELECT COUNT(DISTINCT user_id) as count
            FROM user_sessions
            WHERE is_active = true AND expires_at > NOW()
          `);
          activeUsersCount = parseInt((activeUsersResult[0] as any).count) || 0;
        }
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
      loggerService.getLogger().error("Failed to collect application metrics", {
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
}

export const metricsCollector = new MetricsCollector();
