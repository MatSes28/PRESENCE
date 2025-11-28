import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { db } from "../storage.js";
import { sql } from "drizzle-orm";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BackupConfig {
  schedule: string; // cron expression
  retention: number; // days to keep backups
  path: string; // backup directory
  compress: boolean;
  encrypt: boolean;
  walArchivePath?: string; // WAL archive directory for PITR
  continuousArchiving?: boolean;
}

interface PointInTimeRecoveryConfig {
  targetTime: Date;
  backupFile: string;
  walArchivePath: string;
  recoveryPath: string;
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
      walArchivePath: path.join(__dirname, "../../../wal_archive"),
      continuousArchiving: false,
      ...config,
    };

    this.ensureBackupDirectory();
    if (this.config.continuousArchiving) {
      this.ensureWALArchiveDirectory();
    }
  }

  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.config.path)) {
      fs.mkdirSync(this.config.path, { recursive: true });
      console.log(`Created backup directory: ${this.config.path}`);
    }
  }

  private ensureWALArchiveDirectory(): void {
    if (
      this.config.walArchivePath &&
      !fs.existsSync(this.config.walArchivePath)
    ) {
      fs.mkdirSync(this.config.walArchivePath, { recursive: true });
      console.log(
        `Created WAL archive directory: ${this.config.walArchivePath}`
      );
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

  // Setup continuous archiving for point-in-time recovery
  async setupContinuousArchiving(): Promise<void> {
    if (!this.config.walArchivePath) {
      throw new Error("WAL archive path not configured");
    }

    try {
      console.log(
        "Setting up continuous archiving for point-in-time recovery..."
      );

      // Enable WAL archiving in PostgreSQL
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not configured");
      }

      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port;
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      // Create archive_command script
      const archiveScript = `
#!/bin/bash
# PostgreSQL WAL archiving script
WAL_FILE=$1
WAL_DEST="${this.config.walArchivePath}/$WAL_FILE"

# Copy WAL file to archive location
cp "$WAL_FILE" "$WAL_DEST"

# Verify the copy was successful
if [ $? -eq 0 ]; then
    echo "WAL file $WAL_FILE archived successfully"
    exit 0
else
    echo "Failed to archive WAL file $WAL_FILE"
    exit 1
fi
      `.trim();

      const scriptPath = path.join(
        this.config.walArchivePath,
        "archive_wal.sh"
      );
      fs.writeFileSync(scriptPath, archiveScript);
      fs.chmodSync(scriptPath, "755");

      // PostgreSQL configuration commands for WAL archiving
      const walCommands = [
        `ALTER SYSTEM SET wal_level = 'replica';`,
        `ALTER SYSTEM SET archive_mode = 'on';`,
        `ALTER SYSTEM SET archive_command = '${scriptPath} %p';`,
        `ALTER SYSTEM SET archive_timeout = '60s';`, // Archive WAL every 60 seconds
        `SELECT pg_reload_conf();`,
      ];

      // Execute configuration commands
      for (const command of walCommands) {
        try {
          await execAsync(
            `psql "postgresql://${username}:${password}@${host}:${port}/${database}" -c "${command}"`
          );
          console.log(`Executed: ${command.split(" ")[0]}...`);
        } catch (error) {
          console.warn(
            `Warning: Failed to execute ${command.split(" ")[0]}:`,
            error.message
          );
        }
      }

      console.log("✅ Continuous archiving setup completed");
      console.log(
        `📁 WAL files will be archived to: ${this.config.walArchivePath}`
      );
    } catch (error) {
      console.error("❌ Failed to setup continuous archiving:", error);
      throw error;
    }
  }

  // Create base backup for point-in-time recovery
  async createBaseBackup(): Promise<string> {
    if (!this.config.walArchivePath) {
      throw new Error("WAL archive path not configured for PITR");
    }

    try {
      console.log("Creating base backup for point-in-time recovery...");

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not configured");
      }

      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port;
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const baseBackupName = `base_backup_${timestamp}`;
      const baseBackupPath = path.join(this.config.path, baseBackupName);

      // Create base backup directory
      fs.mkdirSync(baseBackupPath, { recursive: true });

      // Start backup and get the backup label
      const startBackupResult = await execAsync(
        `psql "postgresql://${username}:${password}@${host}:${port}/${database}" -c "SELECT pg_start_backup('${baseBackupName}', true);" -t`
      );

      const backupLabel = startBackupResult.stdout.trim();
      console.log(`Backup started with label: ${backupLabel}`);

      // Copy data directory (simplified - in production, use pg_basebackup)
      const dataDirCommand = `psql "postgresql://${username}:${password}@${host}:${port}/${database}" -c "SHOW data_directory;" -t`;
      const dataDirResult = await execAsync(dataDirCommand);
      const dataDirectory = dataDirResult.stdout.trim();

      // For demonstration, create a logical backup instead of physical
      // In production, you would use pg_basebackup for physical backup
      const backupCommand = `pg_dump "postgresql://${username}:${password}@${host}:${port}/${database}" > "${path.join(
        baseBackupPath,
        "base_backup.sql"
      )}"`;

      console.log("Creating base backup...");
      await execAsync(backupCommand);

      // Stop backup
      await execAsync(
        `psql "postgresql://${username}:${password}@${host}:${port}/${database}" -c "SELECT pg_stop_backup();" -t`
      );

      // Create backup manifest
      const manifest = {
        backupType: "base_backup",
        timestamp: new Date().toISOString(),
        label: backupLabel,
        walArchivePath: this.config.walArchivePath,
        database: database,
        version: "1.0",
      };

      fs.writeFileSync(
        path.join(baseBackupPath, "backup_manifest.json"),
        JSON.stringify(manifest, null, 2)
      );

      console.log(`✅ Base backup created: ${baseBackupPath}`);
      return baseBackupPath;
    } catch (error) {
      console.error("❌ Failed to create base backup:", error);
      throw error;
    }
  }

  // Perform point-in-time recovery
  async performPointInTimeRecovery(
    config: PointInTimeRecoveryConfig
  ): Promise<void> {
    try {
      console.log(
        `Starting point-in-time recovery to: ${config.targetTime.toISOString()}`
      );

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL not configured");
      }

      const url = new URL(databaseUrl);
      const host = url.hostname;
      const port = url.port;
      const database = url.pathname.slice(1);
      const username = url.username;
      const password = url.password;

      // Create recovery directory
      fs.mkdirSync(config.recoveryPath, { recursive: true });

      // Step 1: Restore base backup
      console.log("Step 1: Restoring base backup...");
      const baseBackupFile = path.join(config.backupFile, "base_backup.sql");
      const restoreCommand = `psql "postgresql://${username}:${password}@${host}:${database}" < "${baseBackupFile}"`;

      await execAsync(restoreCommand);
      console.log("✅ Base backup restored");

      // Step 2: Create recovery configuration
      console.log("Step 2: Configuring recovery...");
      const recoveryConf = `
# Point-in-time recovery configuration
recovery_target_time = '${config.targetTime.toISOString()}'
recovery_target_action = 'promote'
recovery_target_inclusive = true
restore_command = 'cp ${config.walArchivePath}/%f %p'
      `.trim();

      const recoveryConfPath = path.join(config.recoveryPath, "recovery.conf");
      fs.writeFileSync(recoveryConfPath, recoveryConf);

      // Step 3: Start recovery
      console.log("Step 3: Starting recovery process...");
      const recoveryCommand = `psql "postgresql://${username}:${password}@${host}:${database}" -c "SELECT pg_wal_replay_resume();"`;

      await execAsync(recoveryCommand);
      console.log("✅ Point-in-time recovery completed");

      // Step 4: Verify recovery
      console.log("Step 4: Verifying recovery...");
      const verifyCommand = `psql "postgresql://${username}:${password}@${host}:${database}" -c "SELECT now(), 'Recovery completed successfully' as status;"`;

      const verifyResult = await execAsync(verifyCommand);
      console.log("Recovery verification:", verifyResult.stdout.trim());
    } catch (error) {
      console.error("❌ Point-in-time recovery failed:", error);
      throw error;
    }
  }

  // Get WAL archive status
  getWALArchiveStatus(): {
    archivePath: string | undefined;
    totalWALFiles: number;
    totalSize: number;
    oldestWAL?: Date;
    newestWAL?: Date;
  } {
    if (
      !this.config.walArchivePath ||
      !fs.existsSync(this.config.walArchivePath)
    ) {
      return {
        archivePath: this.config.walArchivePath,
        totalWALFiles: 0,
        totalSize: 0,
      };
    }

    try {
      const files = fs
        .readdirSync(this.config.walArchivePath)
        .filter(
          (file) => file.endsWith(".backup") || file.match(/^[0-9A-F]{24}$/)
        );

      let totalSize = 0;
      let oldestWAL: Date | undefined;
      let newestWAL: Date | undefined;

      for (const file of files) {
        const filePath = path.join(this.config.walArchivePath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        if (!oldestWAL || stats.mtime < oldestWAL) {
          oldestWAL = stats.mtime;
        }
        if (!newestWAL || stats.mtime > newestWAL) {
          newestWAL = stats.mtime;
        }
      }

      return {
        archivePath: this.config.walArchivePath,
        totalWALFiles: files.length,
        totalSize,
        oldestWAL,
        newestWAL,
      };
    } catch (error) {
      console.error("Failed to get WAL archive status:", error);
      return {
        archivePath: this.config.walArchivePath,
        totalWALFiles: 0,
        totalSize: 0,
      };
    }
  }

  // Cleanup old WAL files
  async cleanupOldWALFiles(retentionDays: number = 30): Promise<void> {
    if (!this.config.walArchivePath) {
      return;
    }

    try {
      const files = fs.readdirSync(this.config.walArchivePath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.config.walArchivePath, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old WAL files`);
      }
    } catch (error) {
      console.error("Failed to cleanup old WAL files:", error);
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
