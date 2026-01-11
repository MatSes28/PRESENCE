import db from "../storage.js";
import { sql } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: "idle" | "running" | "completed" | "failed";
  errorMessage?: string;
}

interface MaintenanceResult {
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  affectedRows?: number;
  errorMessage?: string;
  details: Record<string, any>;
}

interface DatabaseHealthCheck {
  checkName: string;
  status: "pass" | "warning" | "fail";
  message: string;
  recommendation?: string;
  value?: any;
}

class DatabaseMaintenanceService {
  private maintenanceTasks: Map<string, MaintenanceTask> = new Map();
  private maintenanceHistory: MaintenanceResult[] = [];
  private isRunning = false;

  constructor() {
    this.initializeMaintenanceTasks();
  }

  // Initialize default maintenance tasks
  private initializeMaintenanceTasks(): void {
    const tasks: MaintenanceTask[] = [
      {
        id: "vacuum_analyze",
        name: "Vacuum Analyze",
        description: "Update table statistics and reclaim space",
        schedule: "0 2 * * *", // Daily at 2 AM
        enabled: true,
        status: "idle",
      },
      {
        id: "reindex_critical",
        name: "Reindex Critical Tables",
        description: "Rebuild indexes on critical tables",
        schedule: "0 3 * * 0", // Weekly on Sunday at 3 AM
        enabled: true,
        status: "idle",
      },
      {
        id: "cleanup_old_data",
        name: "Cleanup Old Data",
        description: "Archive or delete old attendance records",
        schedule: "0 4 1 * *", // Monthly on 1st at 4 AM
        enabled: true,
        status: "idle",
      },
      {
        id: "update_statistics",
        name: "Update Statistics",
        description: "Refresh database statistics for query planning",
        schedule: "0 */6 * * *", // Every 6 hours
        enabled: true,
        status: "idle",
      },
      {
        id: "check_constraints",
        name: "Check Constraints",
        description: "Validate database constraints and integrity",
        schedule: "0 1 * * *", // Daily at 1 AM
        enabled: true,
        status: "idle",
      },
      {
        id: "backup_validation",
        name: "Backup Validation",
        description: "Validate recent backups integrity",
        schedule: "0 5 * * *", // Daily at 5 AM
        enabled: true,
        status: "idle",
      },
    ];

    tasks.forEach((task) => this.maintenanceTasks.set(task.id, task));
  }

  // Run vacuum analyze on all tables
  async runVacuumAnalyze(): Promise<MaintenanceResult> {
    const startTime = new Date();

    try {
      console.log("🧹 Starting vacuum analyze on all tables...");

      // Get all user tables
      const tablesResult = await db.execute(sql`
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'sql_%'
        ORDER BY tablename
      `);

      let totalAffectedRows = 0;
      const tableResults: any[] = [];

      for (const row of tablesResult as any[]) {
        const tableName = `${row.schemaname}.${row.tablename}`;

        try {
          console.log(`  Vacuuming ${tableName}...`);
          const vacuumResult = await db.execute(
            sql.raw(`VACUUM ANALYZE ${tableName}`)
          );
          tableResults.push({ table: tableName, status: "success" });
        } catch (error) {
          console.warn(`  Failed to vacuum ${tableName}:`, error.message);
          tableResults.push({
            table: tableName,
            status: "failed",
            error: error.message,
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ Vacuum analyze completed in ${duration}ms`);

      return {
        taskId: "vacuum_analyze",
        startTime,
        endTime,
        duration,
        success: true,
        affectedRows: totalAffectedRows,
        details: { tablesProcessed: tableResults.length, tableResults },
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Vacuum analyze failed:", error);

      return {
        taskId: "vacuum_analyze",
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error.message,
        details: {},
      };
    }
  }

  // Reindex critical tables
  async runReindexCritical(): Promise<MaintenanceResult> {
    const startTime = new Date();

    try {
      console.log("🔄 Starting reindexing of critical tables...");

      // Critical tables that need frequent reindexing
      const criticalTables = [
        "attendance_records",
        "class_sessions",
        "schedules",
        "students",
        "users",
      ];

      const indexResults: any[] = [];

      for (const tableName of criticalTables) {
        try {
          console.log(`  Reindexing ${tableName}...`);

          // Get indexes for this table
          const indexesResult = await db.execute(sql`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = ${tableName}
          `);

          for (const indexRow of indexesResult as any[]) {
            const indexName = indexRow.indexname;
            try {
              await db.execute(
                sql.raw(`REINDEX INDEX CONCURRENTLY ${indexName}`)
              );
              indexResults.push({
                table: tableName,
                index: indexName,
                status: "success",
              });
            } catch (error) {
              console.warn(`  Failed to reindex ${indexName}:`, error.message);
              indexResults.push({
                table: tableName,
                index: indexName,
                status: "failed",
                error: error.message,
              });
            }
          }
        } catch (error) {
          console.warn(
            `  Failed to process table ${tableName}:`,
            error.message
          );
          indexResults.push({
            table: tableName,
            status: "failed",
            error: error.message,
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(`✅ Reindexing completed in ${duration}ms`);

      return {
        taskId: "reindex_critical",
        startTime,
        endTime,
        duration,
        success: true,
        details: { indexesProcessed: indexResults.length, indexResults },
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Reindexing failed:", error);

      return {
        taskId: "reindex_critical",
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error.message,
        details: {},
      };
    }
  }

  // Cleanup old data (archive old attendance records)
  async runCleanupOldData(
    retentionDays: number = 365
  ): Promise<MaintenanceResult> {
    const startTime = new Date();

    try {
      console.log(
        `🗑️  Starting cleanup of data older than ${retentionDays} days...`
      );

      // Archive old attendance records
      const archiveResult = await db.execute(sql`
        INSERT INTO attendance_records_archive
        SELECT * FROM attendance_records
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
          AND is_active = true
      `);

      const archivedCount = (archiveResult as any).rowCount || 0;

      // Mark as inactive instead of deleting
      const updateResult = await db.execute(sql`
        UPDATE attendance_records
        SET is_active = false, updated_at = NOW()
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
          AND is_active = true
      `);

      const updatedCount = (updateResult as any).rowCount || 0;

      // Clean up old error logs (keep only last 90 days)
      const errorCleanupResult = await db.execute(sql`
        DELETE FROM error_logs
        WHERE timestamp < NOW() - INTERVAL '90 days'
      `);

      const errorDeletedCount = (errorCleanupResult as any).rowCount || 0;

      // Clean up old push notifications (keep only last 30 days)
      const notificationCleanupResult = await db.execute(sql`
        DELETE FROM push_notifications
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);

      const notificationDeletedCount =
        (notificationCleanupResult as any).rowCount || 0;

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(
        `✅ Cleanup completed: ${updatedCount} records archived, ${errorDeletedCount} error logs deleted, ${notificationDeletedCount} notifications deleted`
      );

      return {
        taskId: "cleanup_old_data",
        startTime,
        endTime,
        duration,
        success: true,
        affectedRows:
          updatedCount + errorDeletedCount + notificationDeletedCount,
        details: {
          archivedRecords: archivedCount,
          deactivatedRecords: updatedCount,
          deletedErrorLogs: errorDeletedCount,
          deletedNotifications: notificationDeletedCount,
        },
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Cleanup failed:", error);

      return {
        taskId: "cleanup_old_data",
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error.message,
        details: {},
      };
    }
  }

  // Update database statistics
  async runUpdateStatistics(): Promise<MaintenanceResult> {
    const startTime = new Date();

    try {
      console.log("📊 Updating database statistics...");

      // Analyze all tables to update statistics
      await db.execute(sql`ANALYZE`);

      // Update specific table statistics for better query planning
      const tablesResult = await db.execute(sql`
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
      `);

      const analyzedTables: string[] = [];
      for (const row of tablesResult as any[]) {
        const tableName = `${row.schemaname}.${row.tablename}`;
        await db.execute(sql.raw(`ANALYZE ${tableName}`));
        analyzedTables.push(tableName);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(
        `✅ Statistics updated for ${analyzedTables.length} tables in ${duration}ms`
      );

      return {
        taskId: "update_statistics",
        startTime,
        endTime,
        duration,
        success: true,
        details: { tablesAnalyzed: analyzedTables.length, analyzedTables },
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Statistics update failed:", error);

      return {
        taskId: "update_statistics",
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error.message,
        details: {},
      };
    }
  }

  // Check database constraints and integrity
  async runCheckConstraints(): Promise<MaintenanceResult> {
    const startTime = new Date();

    try {
      console.log("🔍 Checking database constraints and integrity...");

      const issues: any[] = [];

      // Check for orphaned records
      const orphanChecks = [
        {
          name: "attendance_records_student_id",
          query: `SELECT COUNT(*) as count FROM attendance_records ar LEFT JOIN students s ON ar.student_id = s.id WHERE ar.is_active = true AND s.id IS NULL`,
        },
        {
          name: "attendance_records_class_session_id",
          query: `SELECT COUNT(*) as count FROM attendance_records ar LEFT JOIN class_sessions cs ON ar.class_session_id = cs.id WHERE ar.is_active = true AND cs.id IS NULL`,
        },
        {
          name: "computer_assignments_student_id",
          query: `SELECT COUNT(*) as count FROM computer_assignments ca LEFT JOIN students s ON ca.student_id = s.id WHERE ca.is_active = true AND s.id IS NULL`,
        },
      ];

      for (const check of orphanChecks) {
        const result = await db.execute(sql.raw(check.query));
        const count = parseInt((result as any)[0].count) || 0;
        if (count > 0) {
          issues.push({
            type: "orphaned_records",
            check: check.name,
            count,
            severity: "warning",
          });
        }
      }

      // Check for invalid data
      const dataChecks = [
        {
          name: "invalid_rfid_uid",
          query: `SELECT COUNT(*) as count FROM students WHERE rfid_uid IS NOT NULL AND length(rfid_uid) < 8 AND is_active = true`,
        },
        {
          name: "future_class_sessions",
          query: `SELECT COUNT(*) as count FROM class_sessions WHERE date > NOW() + INTERVAL '1 year' AND is_active = true`,
        },
      ];

      for (const check of dataChecks) {
        const result = await db.execute(sql.raw(check.query));
        const count = parseInt((result as any)[0].count) || 0;
        if (count > 0) {
          issues.push({
            type: "invalid_data",
            check: check.name,
            count,
            severity: "warning",
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(
        `✅ Constraint check completed: ${issues.length} issues found`
      );

      return {
        taskId: "check_constraints",
        startTime,
        endTime,
        duration,
        success: true,
        details: { issuesFound: issues.length, issues },
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Constraint check failed:", error);

      return {
        taskId: "check_constraints",
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error.message,
        details: {},
      };
    }
  }

  // Validate recent backups
  async runBackupValidation(): Promise<MaintenanceResult> {
    const startTime = new Date();

    try {
      console.log("💾 Validating recent database backups...");

      const backupDir = path.join(__dirname, "../../../backups");
      if (!fs.existsSync(backupDir)) {
        throw new Error("Backup directory does not exist");
      }

      const backupFiles = fs
        .readdirSync(backupDir)
        .filter((file) => file.endsWith(".sql") || file.endsWith(".sql.gz"))
        .sort()
        .slice(-5); // Check last 5 backups

      const validationResults: any[] = [];

      for (const backupFile of backupFiles) {
        const backupPath = path.join(backupDir, backupFile);
        const stats = fs.statSync(backupPath);

        // Basic validation: check file size and age
        const isRecent =
          Date.now() - stats.mtime.getTime() < 7 * 24 * 60 * 60 * 1000; // Within 7 days
        const hasReasonableSize = stats.size > 1000; // At least 1KB

        validationResults.push({
          file: backupFile,
          size: stats.size,
          modified: stats.mtime,
          isRecent,
          hasReasonableSize,
          isValid: isRecent && hasReasonableSize,
        });
      }

      const validBackups = validationResults.filter((r) => r.isValid).length;

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.log(
        `✅ Backup validation completed: ${validBackups}/${backupFiles.length} backups are valid`
      );

      return {
        taskId: "backup_validation",
        startTime,
        endTime,
        duration,
        success: validBackups > 0,
        details: {
          backupsChecked: backupFiles.length,
          validBackups,
          validationResults,
        },
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error("❌ Backup validation failed:", error);

      return {
        taskId: "backup_validation",
        startTime,
        endTime,
        duration,
        success: false,
        errorMessage: error.message,
        details: {},
      };
    }
  }

  // Run database health check
  async runHealthCheck(): Promise<DatabaseHealthCheck[]> {
    const checks: DatabaseHealthCheck[] = [];

    try {
      // Check database connectivity
      const connectionStart = Date.now();
      await db.execute(sql`SELECT 1`);
      const connectionTime = Date.now() - connectionStart;

      checks.push({
        checkName: "database_connectivity",
        status: connectionTime < 1000 ? "pass" : "warning",
        message: `Database connection successful in ${connectionTime}ms`,
        value: connectionTime,
      });

      // Check active connections
      const connectionResult = await db.execute(sql`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE state = 'active' AND datname = current_database()
      `);

      const activeConnections =
        parseInt((connectionResult as any)[0].active_connections) || 0;
      checks.push({
        checkName: "active_connections",
        status:
          activeConnections < 50
            ? "pass"
            : activeConnections < 80
            ? "warning"
            : "fail",
        message: `${activeConnections} active connections`,
        recommendation:
          activeConnections > 80
            ? "Consider increasing max_connections or optimizing queries"
            : undefined,
        value: activeConnections,
      });

      // Check database size
      const sizeResult = await db.execute(sql`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);

      const dbSize = (sizeResult as any)[0].size;
      checks.push({
        checkName: "database_size",
        status: "pass",
        message: `Database size: ${dbSize}`,
        value: dbSize,
      });

      // Check table bloat
      const bloatResult = await db.execute(sql`
        SELECT
          schemaname,
          tablename,
          n_dead_tup,
          n_live_tup,
          CASE WHEN n_live_tup > 0 THEN round((n_dead_tup::float / n_live_tup) * 100, 2) ELSE 0 END as bloat_ratio
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY bloat_ratio DESC
        LIMIT 5
      `);

      const highBloatTables = (bloatResult as any[]).filter(
        (row) => row.bloat_ratio > 20
      );
      checks.push({
        checkName: "table_bloat",
        status:
          highBloatTables.length === 0
            ? "pass"
            : highBloatTables.length < 3
            ? "warning"
            : "fail",
        message: `${highBloatTables.length} tables with high bloat (>20%)`,
        recommendation:
          highBloatTables.length > 0
            ? "Consider running VACUUM FULL on bloated tables"
            : undefined,
        value: highBloatTables,
      });

      // Check long-running queries
      const longQueryResult = await db.execute(sql`
        SELECT count(*) as long_queries
        FROM pg_stat_activity
        WHERE state = 'active'
          AND now() - query_start > interval '30 seconds'
          AND datname = current_database()
      `);

      const longQueries =
        parseInt((longQueryResult as any)[0].long_queries) || 0;
      checks.push({
        checkName: "long_running_queries",
        status:
          longQueries === 0 ? "pass" : longQueries < 5 ? "warning" : "fail",
        message: `${longQueries} queries running longer than 30 seconds`,
        recommendation:
          longQueries > 0
            ? "Check and optimize long-running queries"
            : undefined,
        value: longQueries,
      });
    } catch (error) {
      checks.push({
        checkName: "health_check_error",
        status: "fail",
        message: `Health check failed: ${error.message}`,
        recommendation: "Check database connectivity and configuration",
      });
    }

    return checks;
  }

  // Run a specific maintenance task
  async runTask(taskId: string): Promise<MaintenanceResult> {
    if (this.isRunning) {
      throw new Error("Maintenance task already running");
    }

    const task = this.maintenanceTasks.get(taskId);
    if (!task) {
      throw new Error(`Maintenance task ${taskId} not found`);
    }

    this.isRunning = true;
    task.status = "running";

    try {
      let result: MaintenanceResult;

      switch (taskId) {
        case "vacuum_analyze":
          result = await this.runVacuumAnalyze();
          break;
        case "reindex_critical":
          result = await this.runReindexCritical();
          break;
        case "cleanup_old_data":
          result = await this.runCleanupOldData();
          break;
        case "update_statistics":
          result = await this.runUpdateStatistics();
          break;
        case "check_constraints":
          result = await this.runCheckConstraints();
          break;
        case "backup_validation":
          result = await this.runBackupValidation();
          break;
        default:
          throw new Error(`Unknown maintenance task: ${taskId}`);
      }

      task.status = "completed";
      task.lastRun = new Date();
      this.maintenanceHistory.push(result);

      return result;
    } catch (error) {
      task.status = "failed";
      task.errorMessage = error.message;

      const errorResult: MaintenanceResult = {
        taskId,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        success: false,
        errorMessage: error.message,
        details: {},
      };

      this.maintenanceHistory.push(errorResult);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Get maintenance status
  getStatus(): {
    tasks: MaintenanceTask[];
    history: MaintenanceResult[];
    isRunning: boolean;
  } {
    return {
      tasks: Array.from(this.maintenanceTasks.values()),
      history: this.maintenanceHistory.slice(-10), // Last 10 results
      isRunning: this.isRunning,
    };
  }

  // Enable/disable maintenance task
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const task = this.maintenanceTasks.get(taskId);
    if (task) {
      task.enabled = enabled;
    }
  }
}

// Export singleton instance
export const databaseMaintenance = new DatabaseMaintenanceService();

// CLI helper functions
export async function runMaintenanceTask(taskId: string): Promise<void> {
  try {
    console.log(`🔧 Running maintenance task: ${taskId}`);
    const result = await databaseMaintenance.runTask(taskId);

    console.log(`✅ Task completed in ${result.duration}ms`);
    if (result.affectedRows) {
      console.log(`📊 Affected rows: ${result.affectedRows}`);
    }
  } catch (error) {
    console.error(`❌ Maintenance task failed:`, error);
    process.exit(1);
  }
}

export async function runDatabaseHealthCheck(): Promise<void> {
  try {
    console.log("🏥 Running database health check...");
    const checks = await databaseMaintenance.runHealthCheck();

    console.log("\n📋 Health Check Results:");
    checks.forEach((check) => {
      const icon =
        check.status === "pass"
          ? "✅"
          : check.status === "warning"
          ? "⚠️"
          : "❌";
      console.log(`${icon} ${check.checkName}: ${check.message}`);
      if (check.recommendation) {
        console.log(`   💡 ${check.recommendation}`);
      }
    });

    const passed = checks.filter((c) => c.status === "pass").length;
    const warnings = checks.filter((c) => c.status === "warning").length;
    const failures = checks.filter((c) => c.status === "fail").length;

    console.log(
      `\n📊 Summary: ${passed} passed, ${warnings} warnings, ${failures} failures`
    );
  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

export async function showMaintenanceStatus(): Promise<void> {
  try {
    const status = databaseMaintenance.getStatus();

    console.log("\n🔧 Maintenance Tasks:");
    status.tasks.forEach((task) => {
      const statusIcon =
        task.status === "completed"
          ? "✅"
          : task.status === "running"
          ? "🔄"
          : task.status === "failed"
          ? "❌"
          : "⏳";
      const enabled = task.enabled ? "enabled" : "disabled";
      console.log(`${statusIcon} ${task.id} - ${task.name} (${enabled})`);
      if (task.lastRun) {
        console.log(`   Last run: ${task.lastRun.toISOString()}`);
      }
      if (task.errorMessage) {
        console.log(`   Error: ${task.errorMessage}`);
      }
    });

    if (status.history.length > 0) {
      console.log("\n📚 Recent History:");
      status.history.slice(-5).forEach((result) => {
        const success = result.success ? "✅" : "❌";
        console.log(`${success} ${result.taskId} - ${result.duration}ms`);
      });
    }
  } catch (error) {
    console.error("❌ Failed to get maintenance status:", error);
    process.exit(1);
  }
}
