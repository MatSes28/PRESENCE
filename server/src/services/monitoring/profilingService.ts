import * as v8 from "v8";
import * as path from "path";
import * as fs from "fs";
import { loggerService } from "./logger.js";

export class ProfilingService {
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

      loggerService.getLogger().info("Heap snapshot taken", {
        type: "profiling",
        path: snapshotPath,
        size: fs.statSync(snapshotPath).size,
      });

      return snapshotPath;
    } catch (error) {
      loggerService.getLogger().error("Failed to take heap snapshot", {
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
      loggerService.getLogger().info("CPU profiling started", {
        type: "profiling",
        profileId,
      });
      return profileId;
    } catch (error) {
      loggerService.getLogger().error("Failed to start CPU profiling", {
        error: error.message,
      });
      throw error;
    }
  }

  public stopCpuProfiling(profileId: string): void {
    try {
      loggerService.getLogger().info("CPU profiling stopped", {
        type: "profiling",
        profileId,
      });
    } catch (error) {
      loggerService.getLogger().error("Failed to stop CPU profiling", {
        error: error.message,
      });
      throw error;
    }
  }

  // Get heap statistics
  public getHeapStatistics(): {
    total_heap_size: number;
    total_heap_size_executable: number;
    total_physical_size: number;
    total_available_size: number;
    used_heap_size: number;
    heap_size_limit: number;
    malloced_memory: number;
    peak_malloced_memory: number;
    does_zap_garbage: boolean;
    number_of_native_contexts: number;
    number_of_detached_contexts: number;
  } {
    return v8.getHeapStatistics();
  }

  // Get heap space statistics
  public getHeapSpaceStatistics(): Array<{
    space_name: string;
    space_size: number;
    space_used_size: number;
    space_available_size: number;
    physical_space_size: number;
  }> {
    return v8.getHeapSpaceStatistics();
  }

  // Force garbage collection (if available)
  public forceGarbageCollection(): boolean {
    try {
      if (global.gc) {
        global.gc();
        loggerService.getLogger().info("Manual garbage collection executed", {
          type: "profiling",
        });
        return true;
      } else {
        loggerService.getLogger().warn("Manual GC not available", {
          type: "profiling",
          note: "Run Node.js with --expose-gc flag to enable manual GC",
        });
        return false;
      }
    } catch (error) {
      loggerService.getLogger().error("Failed to execute manual GC", {
        error: error.message,
        type: "profiling",
      });
      return false;
    }
  }

  // Get comprehensive memory profile
  public getMemoryProfile(): {
    heapStats: ReturnType<typeof v8.getHeapStatistics>;
    heapSpaceStats: ReturnType<typeof v8.getHeapSpaceStatistics>;
    processMemory: NodeJS.MemoryUsage;
    timestamp: Date;
  } {
    return {
      heapStats: this.getHeapStatistics(),
      heapSpaceStats: this.getHeapSpaceStatistics(),
      processMemory: process.memoryUsage(),
      timestamp: new Date(),
    };
  }

  // Clean up old profiling files
  public cleanupOldProfiles(maxAgeDays: number = 7): {
    deletedFiles: string[];
    totalSizeFreed: number;
  } {
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        return { deletedFiles: [], totalSizeFreed: 0 };
      }

      const files = fs.readdirSync(logsDir);
      const profileFiles = files.filter(
        (file) =>
          file.startsWith("heap-") ||
          file.startsWith("cpu-profile-") ||
          file.endsWith(".heapsnapshot")
      );

      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
      const now = Date.now();
      const deletedFiles: string[] = [];
      let totalSizeFreed = 0;

      for (const file of profileFiles) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedFiles.push(file);
          totalSizeFreed += stats.size;
        }
      }

      if (deletedFiles.length > 0) {
        loggerService.getLogger().info("Cleaned up old profiling files", {
          type: "profiling",
          deletedFiles,
          totalSizeFreed,
        });
      }

      return { deletedFiles, totalSizeFreed };
    } catch (error) {
      loggerService.getLogger().error("Failed to cleanup profiling files", {
        error: error.message,
        type: "profiling",
      });
      return { deletedFiles: [], totalSizeFreed: 0 };
    }
  }

  // Get profiling status
  public getProfilingStatus(): {
    heapSnapshotsCount: number;
    cpuProfilesCount: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  } {
    try {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        return {
          heapSnapshotsCount: 0,
          cpuProfilesCount: 0,
          totalSize: 0,
        };
      }

      const files = fs.readdirSync(logsDir);
      const profileFiles = files.filter(
        (file) =>
          file.startsWith("heap-") ||
          file.startsWith("cpu-profile-") ||
          file.endsWith(".heapsnapshot")
      );

      let heapSnapshotsCount = 0;
      let cpuProfilesCount = 0;
      let totalSize = 0;
      let oldestFile: Date | undefined;
      let newestFile: Date | undefined;

      for (const file of profileFiles) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        totalSize += stats.size;

        if (file.startsWith("heap-") || file.endsWith(".heapsnapshot")) {
          heapSnapshotsCount++;
        } else if (file.startsWith("cpu-profile-")) {
          cpuProfilesCount++;
        }

        if (!oldestFile || stats.mtime < oldestFile) {
          oldestFile = stats.mtime;
        }
        if (!newestFile || stats.mtime > newestFile) {
          newestFile = stats.mtime;
        }
      }

      return {
        heapSnapshotsCount,
        cpuProfilesCount,
        totalSize,
        oldestFile,
        newestFile,
      };
    } catch (error) {
      loggerService.getLogger().error("Failed to get profiling status", {
        error: error.message,
        type: "profiling",
      });
      return {
        heapSnapshotsCount: 0,
        cpuProfilesCount: 0,
        totalSize: 0,
      };
    }
  }
}

export const profilingService = new ProfilingService();
