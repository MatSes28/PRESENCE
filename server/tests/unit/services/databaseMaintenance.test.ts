import { databaseMaintenance } from "../../../src/services/databaseMaintenance";

// Mock external dependencies
jest.mock("../../../src/storage.js", () => ({
  db: {
    execute: jest.fn(),
  },
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock("path", () => ({
  join: jest.fn(),
}));

describe("DatabaseMaintenanceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Vacuum Analyze", () => {
    it("should run vacuum analyze successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValueOnce([
          { schemaname: "public", tablename: "users" },
          { schemaname: "public", tablename: "attendance_records" },
        ])
        .mockResolvedValue({}); // For VACUUM ANALYZE calls

      const result = await databaseMaintenance["runVacuumAnalyze"]();

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("vacuum_analyze");
      expect(result.details.tablesProcessed).toBe(2);
    });

    it("should handle vacuum analyze errors", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockRejectedValue(new Error("Vacuum failed"));

      const result = await databaseMaintenance["runVacuumAnalyze"]();

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("Vacuum failed");
    });
  });

  describe("Reindex Critical", () => {
    it("should reindex critical tables successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValueOnce([]) // No indexes for first table
        .mockResolvedValueOnce([{ indexname: "idx_users_email" }]) // Indexes for users table
        .mockResolvedValue({}); // REINDEX calls

      const result = await databaseMaintenance["runReindexCritical"]();

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("reindex_critical");
      expect(result.details.indexesProcessed).toBeDefined();
    });

    it("should handle reindex errors", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockRejectedValue(new Error("Reindex failed"));

      const result = await databaseMaintenance["runReindexCritical"]();

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("Reindex failed");
    });
  });

  describe("Cleanup Old Data", () => {
    it("should cleanup old data successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValue({ rowCount: 10 }) // Archive result
        .mockResolvedValue({ rowCount: 5 }) // Update result
        .mockResolvedValue({ rowCount: 3 }) // Error cleanup
        .mockResolvedValue({ rowCount: 2 }); // Notification cleanup

      const result = await databaseMaintenance["runCleanupOldData"]();

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(10);
      expect(result.details.archivedRecords).toBe(10);
      expect(result.details.deactivatedRecords).toBe(5);
    });

    it("should handle cleanup errors", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockRejectedValue(new Error("Cleanup failed"));

      const result = await databaseMaintenance["runCleanupOldData"]();

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("Cleanup failed");
    });
  });

  describe("Update Statistics", () => {
    it("should update statistics successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValue({}) // ANALYZE
        .mockResolvedValueOnce([
          { schemaname: "public", tablename: "users" },
          { schemaname: "public", tablename: "attendance_records" },
        ])
        .mockResolvedValue({}); // Individual ANALYZE calls

      const result = await databaseMaintenance["runUpdateStatistics"]();

      expect(result.success).toBe(true);
      expect(result.details.tablesAnalyzed).toBe(2);
    });

    it("should handle statistics update errors", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockRejectedValue(new Error("Statistics update failed"));

      const result = await databaseMaintenance["runUpdateStatistics"]();

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("Statistics update failed");
    });
  });

  describe("Check Constraints", () => {
    it("should check constraints successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValue([{ count: "0" }]) // Orphan checks
        .mockResolvedValue([{ count: "0" }]) // Data checks
        .mockResolvedValue([{ count: "0" }])
        .mockResolvedValue([{ count: "0" }]);

      const result = await databaseMaintenance["runCheckConstraints"]();

      expect(result.success).toBe(true);
      expect(result.details.issuesFound).toBe(0);
    });

    it("should detect constraint issues", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValue([{ count: "5" }]) // Orphaned records found
        .mockResolvedValue([{ count: "0" }]) // Data checks
        .mockResolvedValue([{ count: "0" }]);

      const result = await databaseMaintenance["runCheckConstraints"]();

      expect(result.success).toBe(true);
      expect(result.details.issuesFound).toBe(1);
      expect(result.details.issues[0].count).toBe(5);
    });
  });

  describe("Backup Validation", () => {
    it("should validate backups successfully", async () => {
      const mockExistsSync = require("fs").existsSync;
      const mockReaddirSync = require("fs").readdirSync;
      const mockStatSync = require("fs").statSync;

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(["backup1.sql", "backup2.sql.gz"]);
      mockStatSync.mockReturnValue({
        size: 5000,
        mtime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      const result = await databaseMaintenance["runBackupValidation"]();

      expect(result.success).toBe(true);
      expect(result.details.backupsChecked).toBe(2);
      expect(result.details.validBackups).toBe(2);
    });

    it("should handle missing backup directory", async () => {
      const mockExistsSync = require("fs").existsSync;
      mockExistsSync.mockReturnValue(false);

      const result = await databaseMaintenance["runBackupValidation"]();

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe("Backup directory does not exist");
    });
  });

  describe("Health Check", () => {
    it("should perform health check successfully", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValue({}) // SELECT 1
        .mockResolvedValue([{ active_connections: "10" }]) // Active connections
        .mockResolvedValue([{ size: "100MB" }]) // Database size
        .mockResolvedValue([]) // Table bloat
        .mockResolvedValue([{ long_queries: "0" }]); // Long queries

      const checks = await databaseMaintenance.runHealthCheck();

      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].checkName).toBe("database_connectivity");
      expect(checks[0].status).toBe("pass");
    });

    it("should detect health issues", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;

      mockExecute
        .mockResolvedValue({}) // SELECT 1
        .mockResolvedValue([{ active_connections: "90" }]) // High connections
        .mockResolvedValue([{ size: "100MB" }])
        .mockResolvedValue([
          {
            schemaname: "public",
            tablename: "users",
            n_dead_tup: 1000,
            n_live_tup: 100,
            bloat_ratio: 50,
          },
        ]) // High bloat
        .mockResolvedValue([{ long_queries: "10" }]); // Long queries

      const checks = await databaseMaintenance.runHealthCheck();

      const connectionCheck = checks.find(
        (c) => c.checkName === "active_connections"
      );
      const bloatCheck = checks.find((c) => c.checkName === "table_bloat");
      const queryCheck = checks.find(
        (c) => c.checkName === "long_running_queries"
      );

      expect(connectionCheck?.status).toBe("fail");
      expect(bloatCheck?.status).toBe("fail");
      expect(queryCheck?.status).toBe("fail");
    });

    it("should handle health check errors", async () => {
      const mockExecute = require("../../../src/storage.js").db.execute;
      mockExecute.mockRejectedValue(new Error("Connection failed"));

      const checks = await databaseMaintenance.runHealthCheck();

      expect(checks.length).toBe(1);
      expect(checks[0].checkName).toBe("health_check_error");
      expect(checks[0].status).toBe("fail");
    });
  });

  describe("Task Management", () => {
    it("should run a maintenance task", async () => {
      const result = await databaseMaintenance.runTask("vacuum_analyze");

      expect(result.taskId).toBe("vacuum_analyze");
      expect(typeof result.duration).toBe("number");
    });

    it("should reject unknown tasks", async () => {
      await expect(databaseMaintenance.runTask("unknown_task")).rejects.toThrow(
        "not found"
      );
    });

    it("should prevent concurrent task execution", async () => {
      // Mock a long-running task
      const mockRunVacuum = jest.spyOn(
        databaseMaintenance as any,
        "runVacuumAnalyze"
      );
      mockRunVacuum.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      // Start first task
      const taskPromise = databaseMaintenance.runTask("vacuum_analyze");

      // Try to start second task while first is running
      await expect(
        databaseMaintenance.runTask("reindex_critical")
      ).rejects.toThrow("already running");

      await taskPromise;
    });
  });

  describe("Status and Configuration", () => {
    it("should get maintenance status", () => {
      const status = databaseMaintenance.getStatus();

      expect(status).toHaveProperty("tasks");
      expect(status).toHaveProperty("history");
      expect(status).toHaveProperty("isRunning");
      expect(Array.isArray(status.tasks)).toBe(true);
    });

    it("should enable/disable tasks", () => {
      databaseMaintenance.setTaskEnabled("vacuum_analyze", false);

      const status = databaseMaintenance.getStatus();
      const task = status.tasks.find((t) => t.id === "vacuum_analyze");

      expect(task?.enabled).toBe(false);
    });
  });
});
