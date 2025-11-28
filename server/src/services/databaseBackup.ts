import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BackupConfig {
  schedule: string; // cron expression
  retention: number; // days to keep backups
  path: string; // backup directory
  compress: boolean;
  encrypt: boolean;
}

class DatabaseBackupService {
  private config: BackupConfig;
  private backupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      schedule: "0 2 * * *", // Daily at 2 AM
      retention: 30, // 30 days
      path: path.join(__dirname, "../../../backups"),
      compress: true,
      encrypt: false,
      ...config,
    };

    this.ensureBackupDirectory();
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.config.path)) {
      fs.mkdirSync(this.config.path, { recursive: true });
      console.log(`Created backup directory: ${this.config.path}`);
    }
  }

  // Start automated backup schedule
  startAutomatedBackup(): void {
    // For simplicity, run backup every 24 hours
    // In production, use a proper cron job
    this.backupInterval = setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        console.error("Automated backup failed:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log("Automated database backup started");
  }

  // Create a database backup
  async createBackup(): Promise<string> {
    if (this.isRunning) {
      console.log("Backup already in progress, skipping...");
      return "";
    }

    this.isRunning = true;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup-${timestamp}.sql`;
      const filepath = path.join(this.config.path, filename);

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not configured");
      }

      // Extract connection details from DATABASE_URL
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port;
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      // Create pg_dump command
      const dumpCommand = `pg_dump "postgresql://${username}:${password}@${host}:${port}/${database}" > "${filepath}"`;

      console.log(`Starting database backup: ${filename}`);
      await execAsync(dumpCommand);

      // Compress if enabled
      if (this.config.compress) {
        const compressedPath = `${filepath}.gz`;
        await execAsync(`gzip "${filepath}"`);
        console.log(`Backup compressed: ${filename}.gz`);
        return compressedPath;
      }

      console.log(`Backup completed: ${filename}`);
      return filepath;
    } catch (error) {
      console.error("Database backup failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Restore from backup
  async restoreBackup(backupPath: string): Promise<void> {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not configured");
      }

      // Extract connection details
      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port;
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      // Handle compressed files
      let restorePath = backupPath;
      if (backupPath.endsWith(".gz")) {
        const decompressedPath = backupPath.replace(".gz", "");
        await execAsync(`gunzip -c "${backupPath}" > "${decompressedPath}"`);
        restorePath = decompressedPath;
      }

      // Restore command
      const restoreCommand = `psql "postgresql://${username}:${password}@${host}:${port}/${database}" < "${restorePath}"`;

      console.log(`Starting database restore from: ${backupPath}`);
      await execAsync(restoreCommand);

      // Clean up decompressed file if it was created
      if (restorePath !== backupPath) {
        fs.unlinkSync(restorePath);
      }

      console.log("Database restore completed");
    } catch (error) {
      console.error("Database restore failed:", error);
      throw error;
    }
  }

  // Clean up old backups based on retention policy
  async cleanupOldBackups(): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.path);
      const backupFiles = files
        .filter(
          (file) =>
            file.startsWith("backup-") &&
            (file.endsWith(".sql") || file.endsWith(".sql.gz"))
        )
        .map((file) => ({
          name: file,
          path: path.join(this.config.path, file),
          stats: fs.statSync(path.join(this.config.path, file)),
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retention);

      let deletedCount = 0;
      for (const file of backupFiles.slice(this.config.retention)) {
        if (file.stats.mtime < cutoffDate) {
          fs.unlinkSync(file.path);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old backup files`);
      }
    } catch (error) {
      console.error("Backup cleanup failed:", error);
    }
  }

  // Get backup statistics
  getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
  } {
    try {
      const files = fs.readdirSync(this.config.path);
      const backupFiles = files
        .filter(
          (file) =>
            file.startsWith("backup-") &&
            (file.endsWith(".sql") || file.endsWith(".sql.gz"))
        )
        .map((file) => ({
          name: file,
          path: path.join(this.config.path, file),
          stats: fs.statSync(path.join(this.config.path, file)),
        }));

      const totalSize = backupFiles.reduce(
        (sum, file) => sum + file.stats.size,
        0
      );
      const sortedByTime = backupFiles.sort(
        (a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()
      );

      return {
        totalBackups: backupFiles.length,
        totalSize,
        oldestBackup:
          sortedByTime.length > 0
            ? sortedByTime[sortedByTime.length - 1].stats.mtime
            : undefined,
        newestBackup:
          sortedByTime.length > 0 ? sortedByTime[0].stats.mtime : undefined,
      };
    } catch (error) {
      console.error("Failed to get backup stats:", error);
      return {
        totalBackups: 0,
        totalSize: 0,
      };
    }
  }

  // Stop automated backup
  stopAutomatedBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log("Automated database backup stopped");
    }
  }
}

export const databaseBackupService = new DatabaseBackupService();

// Graceful shutdown
process.on("SIGTERM", () => {
  databaseBackupService.stopAutomatedBackup();
});

process.on("SIGINT", () => {
  databaseBackupService.stopAutomatedBackup();
});
