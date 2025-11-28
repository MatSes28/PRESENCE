import { db } from "../storage.js";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationRecord {
  id: string;
  name: string;
  executedAt: Date;
  checksum: string;
  success: boolean;
  executionTime: number;
  errorMessage?: string;
}

interface MigrationFile {
  id: string;
  name: string;
  path: string;
  checksum: string;
  upContent: string;
  downContent?: string;
}

class MigrationManager {
  private migrationsTable = "schema_migrations";
  private migrationsPath: string;
  private isInitialized = false;

  constructor(migrationsPath = path.join(__dirname, "../drizzle")) {
    this.migrationsPath = migrationsPath;
  }

  // Initialize migration tracking table
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create migrations tracking table if it doesn't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(this.migrationsTable)} (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(500) NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL,
          success BOOLEAN DEFAULT false,
          execution_time INTEGER NOT NULL, -- in milliseconds
          error_message TEXT,
          rolled_back BOOLEAN DEFAULT false,
          rolled_back_at TIMESTAMP WITH TIME ZONE,
          rollback_time INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON ${sql.identifier(
          this.migrationsTable
        )}(executed_at);
        CREATE INDEX IF NOT EXISTS idx_migrations_success ON ${sql.identifier(
          this.migrationsTable
        )}(success);
        CREATE INDEX IF NOT EXISTS idx_migrations_rolled_back ON ${sql.identifier(
          this.migrationsTable
        )}(rolled_back);
      `);

      this.isInitialized = true;
      console.log("✅ Migration system initialized");
    } catch (error) {
      console.error("❌ Failed to initialize migration system:", error);
      throw error;
    }
  }

  // Get all migration files
  private getMigrationFiles(): MigrationFile[] {
    try {
      const files = fs
        .readdirSync(this.migrationsPath)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      return files.map((filename) => {
        const filepath = path.join(this.migrationsPath, filename);
        const content = fs.readFileSync(filepath, "utf-8");
        const checksum = this.calculateChecksum(content);

        // Extract migration ID and name
        const match = filename.match(/^(\d+)_(.+)\.sql$/);
        if (!match) {
          throw new Error(`Invalid migration filename: ${filename}`);
        }

        const id = match[1].padStart(4, "0");
        const name = match[2].replace(/_/g, " ");

        // Split content into up and down migrations (separated by -- ROLLBACK comment)
        const parts = content.split("-- ROLLBACK");
        const upContent = parts[0].trim();
        const downContent = parts[1]?.trim();

        return {
          id,
          name,
          path: filepath,
          checksum,
          upContent,
          downContent,
        };
      });
    } catch (error) {
      console.error("❌ Failed to read migration files:", error);
      throw error;
    }
  }

  // Calculate checksum for migration content
  private calculateChecksum(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  // Get executed migrations
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    await this.initialize();

    try {
      const result = await db.execute(sql`
        SELECT id, name, executed_at, checksum, success, execution_time, error_message
        FROM ${sql.identifier(this.migrationsTable)}
        WHERE rolled_back = false
        ORDER BY executed_at ASC
      `);

      return (result as any[]).map((row) => ({
        id: row.id,
        name: row.name,
        executedAt: new Date(row.executed_at),
        checksum: row.checksum,
        success: row.success,
        executionTime: row.execution_time,
        errorMessage: row.error_message,
      }));
    } catch (error) {
      console.error("❌ Failed to get executed migrations:", error);
      throw error;
    }
  }

  // Check if migration can be executed
  private async canExecuteMigration(
    migration: MigrationFile
  ): Promise<boolean> {
    const executed = await this.getExecutedMigrations();
    const existing = executed.find((m) => m.id === migration.id);

    if (existing) {
      // Check if checksum matches
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `Migration ${migration.id} has been modified since execution. Expected checksum: ${existing.checksum}, got: ${migration.checksum}`
        );
      }
      return false; // Already executed
    }

    return true; // Can execute
  }

  // Execute a single migration
  async executeMigration(
    migration: MigrationFile,
    direction: "up" | "down" = "up"
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(
        `${direction === "up" ? "🔄" : "⏪"} Executing migration: ${
          migration.id
        } - ${migration.name}`
      );

      const content =
        direction === "up" ? migration.upContent : migration.downContent;
      if (!content) {
        throw new Error(
          `No ${direction} migration content found for ${migration.id}`
        );
      }

      // Execute the migration in a transaction
      await db.transaction(async (tx) => {
        // Split content by statement-breakpoint and execute each statement
        const statements = content
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          if (statement.trim()) {
            await tx.execute(sql.raw(statement));
          }
        }

        // Record the migration execution
        const executionTime = Date.now() - startTime;
        const recordData = {
          id: migration.id,
          name: migration.name,
          checksum: migration.checksum,
          success: true,
          execution_time: executionTime,
          error_message: null,
          rolled_back: direction === "down",
          rolled_back_at: direction === "down" ? new Date() : null,
          rollback_time: direction === "down" ? executionTime : null,
        };

        if (direction === "up") {
          // Insert new record for up migration
          await tx.execute(sql`
            INSERT INTO ${sql.identifier(this.migrationsTable)}
            (id, name, checksum, success, execution_time)
            VALUES (${migration.id}, ${migration.name}, ${
            migration.checksum
          }, true, ${executionTime})
          `);
        } else {
          // Update existing record for down migration
          await tx.execute(sql`
            UPDATE ${sql.identifier(this.migrationsTable)}
            SET rolled_back = true, rolled_back_at = NOW(), rollback_time = ${executionTime}
            WHERE id = ${migration.id}
          `);
        }
      });

      console.log(
        `✅ Migration ${migration.id} executed successfully in ${
          Date.now() - startTime
        }ms`
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failed migration
      try {
        await db.execute(sql`
          INSERT INTO ${sql.identifier(this.migrationsTable)}
          (id, name, checksum, success, execution_time, error_message)
          VALUES (${migration.id}, ${migration.name}, ${
          migration.checksum
        }, false, ${executionTime}, ${error.message})
          ON CONFLICT (id) DO UPDATE SET
            success = false,
            execution_time = ${executionTime},
            error_message = ${error.message}
        `);
      } catch (recordError) {
        console.error("❌ Failed to record migration failure:", recordError);
      }

      console.error(`❌ Migration ${migration.id} failed:`, error);
      throw error;
    }
  }

  // Run pending migrations
  async migrate(targetMigration?: string): Promise<void> {
    await this.initialize();

    const migrations = this.getMigrationFiles();
    const executed = await this.getExecutedMigrations();
    const executedIds = new Set(executed.map((m) => m.id));

    // Find migrations to execute
    let migrationsToExecute = migrations.filter((m) => !executedIds.has(m.id));

    // If target specified, only migrate up to that point
    if (targetMigration) {
      const targetIndex = migrations.findIndex((m) => m.id === targetMigration);
      if (targetIndex === -1) {
        throw new Error(`Target migration ${targetMigration} not found`);
      }
      migrationsToExecute = migrationsToExecute.filter(
        (m) => parseInt(m.id) <= parseInt(targetMigration)
      );
    }

    if (migrationsToExecute.length === 0) {
      console.log("✅ No pending migrations");
      return;
    }

    console.log(
      `🔄 Executing ${migrationsToExecute.length} pending migrations...`
    );

    for (const migration of migrationsToExecute) {
      if (await this.canExecuteMigration(migration)) {
        await this.executeMigration(migration, "up");
      }
    }

    console.log("✅ All migrations completed successfully");
  }

  // Rollback migrations
  async rollback(steps: number = 1): Promise<void> {
    await this.initialize();

    const executed = await this.getExecutedMigrations();
    if (executed.length === 0) {
      console.log("ℹ️  No migrations to rollback");
      return;
    }

    // Get the last N successful migrations to rollback
    const migrationsToRollback = executed
      .filter((m) => m.success)
      .slice(-steps)
      .reverse(); // Rollback in reverse order

    if (migrationsToRollback.length === 0) {
      console.log("ℹ️  No successful migrations to rollback");
      return;
    }

    console.log(`⏪ Rolling back ${migrationsToRollback.length} migrations...`);

    const migrations = this.getMigrationFiles();

    for (const executedMigration of migrationsToRollback) {
      const migrationFile = migrations.find(
        (m) => m.id === executedMigration.id
      );
      if (!migrationFile) {
        throw new Error(`Migration file not found for ${executedMigration.id}`);
      }

      if (!migrationFile.downContent) {
        throw new Error(
          `No rollback script found for migration ${executedMigration.id}`
        );
      }

      await this.executeMigration(migrationFile, "down");
    }

    console.log("✅ Rollback completed successfully");
  }

  // Get migration status
  async getStatus(): Promise<{
    total: number;
    executed: number;
    pending: number;
    lastExecuted?: MigrationRecord;
    migrations: Array<{
      id: string;
      name: string;
      status: "executed" | "pending" | "failed";
      executedAt?: Date;
      errorMessage?: string;
    }>;
  }> {
    await this.initialize();

    const migrations = this.getMigrationFiles();
    const executed = await this.getExecutedMigrations();
    const executedMap = new Map(executed.map((m) => [m.id, m]));

    const status = migrations.map((migration) => {
      const executedMigration = executedMap.get(migration.id);
      if (executedMigration) {
        return {
          id: migration.id,
          name: migration.name,
          status: (executedMigration.success ? "executed" : "failed") as
            | "executed"
            | "failed",
          executedAt: executedMigration.executedAt,
          errorMessage: executedMigration.errorMessage,
        };
      } else {
        return {
          id: migration.id,
          name: migration.name,
          status: "pending" as const,
        };
      }
    });

    return {
      total: migrations.length,
      executed: executed.filter((m) => m.success).length,
      pending: migrations.length - executed.filter((m) => m.success).length,
      lastExecuted: executed.filter((m) => m.success).slice(-1)[0],
      migrations: status,
    };
  }

  // Create a new migration file
  createMigration(name: string): string {
    const timestamp = Date.now();
    const id = timestamp.toString().padStart(13, "0").slice(-4); // Last 4 digits for brevity
    const filename = `${id}_${name.replace(/\s+/g, "_").toLowerCase()}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here

-- Example:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_example ON example_table(column_name);

-- ROLLBACK
-- Add rollback SQL here (optional)

-- Example rollback:
-- DROP INDEX IF EXISTS idx_example;
`;

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration file: ${filename}`);
    return filepath;
  }

  // Validate migration integrity
  async validateMigrations(): Promise<{
    valid: boolean;
    issues: Array<{
      migration: string;
      issue: string;
      severity: "error" | "warning";
    }>;
  }> {
    const issues: Array<{
      migration: string;
      issue: string;
      severity: "error" | "warning";
    }> = [];

    try {
      const migrations = this.getMigrationFiles();
      const executed = await this.getExecutedMigrations();
      const executedMap = new Map(executed.map((m) => [m.id, m]));

      for (const migration of migrations) {
        const executedMigration = executedMap.get(migration.id);

        if (executedMigration) {
          // Check checksum
          if (executedMigration.checksum !== migration.checksum) {
            issues.push({
              migration: migration.id,
              issue: "Migration file has been modified since execution",
              severity: "error",
            });
          }

          // Check for rollback script if migration was successful
          if (executedMigration.success && !migration.downContent) {
            issues.push({
              migration: migration.id,
              issue: "Successful migration missing rollback script",
              severity: "warning",
            });
          }
        }
      }

      // Check for executed migrations without files
      for (const executedMigration of executed) {
        if (!migrations.find((m) => m.id === executedMigration.id)) {
          issues.push({
            migration: executedMigration.id,
            issue: "Executed migration file is missing",
            severity: "error",
          });
        }
      }
    } catch (error) {
      issues.push({
        migration: "system",
        issue: `Validation failed: ${error.message}`,
        severity: "error",
      });
    }

    return {
      valid: issues.filter((i) => i.severity === "error").length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();

// CLI helper functions for direct usage
export async function runMigrations(targetMigration?: string): Promise<void> {
  try {
    await migrationManager.migrate(targetMigration);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

export async function rollbackMigrations(steps: number = 1): Promise<void> {
  try {
    await migrationManager.rollback(steps);
  } catch (error) {
    console.error("Rollback failed:", error);
    process.exit(1);
  }
}

export async function showMigrationStatus(): Promise<void> {
  try {
    const status = await migrationManager.getStatus();
    console.log("\n📊 Migration Status:");
    console.log(
      `Total: ${status.total}, Executed: ${status.executed}, Pending: ${status.pending}`
    );

    if (status.lastExecuted) {
      console.log(
        `Last executed: ${status.lastExecuted.id} - ${
          status.lastExecuted.name
        } (${status.lastExecuted.executedAt.toISOString()})`
      );
    }

    console.log("\n📋 Migrations:");
    status.migrations.forEach((m) => {
      const statusIcon =
        m.status === "executed" ? "✅" : m.status === "failed" ? "❌" : "⏳";
      const executedInfo = m.executedAt
        ? ` (${m.executedAt.toISOString()})`
        : "";
      const errorInfo = m.errorMessage ? ` - ERROR: ${m.errorMessage}` : "";
      console.log(
        `${statusIcon} ${m.id} - ${m.name}${executedInfo}${errorInfo}`
      );
    });
  } catch (error) {
    console.error("Failed to get migration status:", error);
    process.exit(1);
  }
}
