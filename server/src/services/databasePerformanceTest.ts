import db from "../storage.js";
import { sql } from "drizzle-orm";
import { performance } from "perf_hooks";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PerformanceTestResult {
  testName: string;
  duration: number;
  queriesExecuted: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  throughput: number; // queries per second
  errors: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

interface QueryBenchmark {
  name: string;
  query: string;
  params?: any[];
  iterations: number;
  description: string;
}

interface LoadTestConfig {
  duration: number; // seconds
  concurrency: number;
  rampUpTime: number; // seconds
  queries: QueryBenchmark[];
}

interface PerformanceReport {
  summary: {
    totalTests: number;
    totalDuration: number;
    avgThroughput: number;
    totalErrors: number;
    timestamp: Date;
  };
  tests: PerformanceTestResult[];
  recommendations: string[];
  bottlenecks: string[];
}

class DatabasePerformanceTestService {
  private results: PerformanceTestResult[] = [];
  private isRunning = false;

  // Predefined benchmark queries for common operations
  private benchmarkQueries: QueryBenchmark[] = [
    {
      name: "user_authentication",
      query: "SELECT id, email, password, role FROM users WHERE email = $1",
      params: ["test@example.com"],
      iterations: 1000,
      description: "User authentication lookup",
    },
    {
      name: "student_rfid_lookup",
      query:
        "SELECT id, student_id, name FROM students WHERE rfid_uid = $1 AND is_active = true",
      params: ["TEST123456"],
      iterations: 1000,
      description: "RFID-based student lookup",
    },
    {
      name: "attendance_record_creation",
      query: `INSERT INTO attendance_records (student_id, class_session_id, entry_time, rfid_detected, sensor_detected, is_valid)
              VALUES ($1, $2, NOW(), true, true, true)`,
      params: [1, 1],
      iterations: 500,
      description: "Attendance record insertion",
    },
    {
      name: "schedule_lookup",
      query: `SELECT s.id, s.subject_id, s.classroom_id, s.faculty_id, s.day_of_week, s.start_time, s.end_time
              FROM schedules s
              WHERE s.day_of_week = $1 AND s.is_active = true
              ORDER BY s.start_time`,
      params: [1],
      iterations: 500,
      description: "Daily schedule lookup",
    },
    {
      name: "student_attendance_history",
      query: `SELECT ar.id, ar.entry_time, ar.exit_time, ar.status, cs.date, s.name as subject_name
              FROM attendance_records ar
              JOIN class_sessions cs ON ar.class_session_id = cs.id
              JOIN schedules sch ON cs.schedule_id = sch.id
              JOIN subjects s ON sch.subject_id = s.id
              WHERE ar.student_id = $1 AND ar.is_active = true
              ORDER BY cs.date DESC LIMIT 50`,
      params: [1],
      iterations: 200,
      description: "Student attendance history retrieval",
    },
    {
      name: "computer_assignment_lookup",
      query: `SELECT ca.id, c.name as computer_name, c.ip_address, ca.assigned_at, ca.status
              FROM computer_assignments ca
              JOIN computers c ON ca.computer_id = c.id
              WHERE ca.student_id = $1 AND ca.class_session_id = $2 AND ca.is_active = true`,
      params: [1, 1],
      iterations: 300,
      description: "Computer assignment lookup",
    },
    {
      name: "dashboard_stats",
      query: `SELECT
                COUNT(DISTINCT cs.id) as total_sessions,
                COUNT(ar.id) as total_attendance,
                AVG(EXTRACT(EPOCH FROM (ar.exit_time - ar.entry_time))/3600) as avg_session_hours
              FROM class_sessions cs
              LEFT JOIN attendance_records ar ON cs.id = ar.class_session_id AND ar.is_active = true
              WHERE cs.date >= CURRENT_DATE - INTERVAL '7 days'`,
      iterations: 100,
      description: "Dashboard statistics calculation",
    },
  ];

  // Run a single query benchmark
  async runQueryBenchmark(
    benchmark: QueryBenchmark
  ): Promise<PerformanceTestResult> {
    const queryTimes: number[] = [];
    let errors = 0;

    console.log(
      `🧪 Running benchmark: ${benchmark.name} (${benchmark.iterations} iterations)`
    );

    for (let i = 0; i < benchmark.iterations; i++) {
      try {
        const startTime = performance.now();
        await db.execute(sql.raw(benchmark.query));
        const endTime = performance.now();

        queryTimes.push(endTime - startTime);
      } catch (error) {
        errors++;
        console.warn(`Query ${i + 1} failed:`, error.message);
      }
    }

    // Calculate statistics
    queryTimes.sort((a, b) => a - b);
    const avgQueryTime =
      queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;
    const p95Index = Math.floor(queryTimes.length * 0.95);
    const p99Index = Math.floor(queryTimes.length * 0.99);
    const totalDuration = queryTimes.reduce((sum, time) => sum + time, 0);

    const result: PerformanceTestResult = {
      testName: benchmark.name,
      duration: totalDuration,
      queriesExecuted: benchmark.iterations - errors,
      avgQueryTime,
      p95QueryTime: queryTimes[p95Index] || 0,
      p99QueryTime: queryTimes[p99Index] || 0,
      throughput: (benchmark.iterations - errors) / (totalDuration / 1000), // queries per second
      errors,
      timestamp: new Date(),
      metadata: {
        description: benchmark.description,
        query: benchmark.query,
        params: benchmark.params,
      },
    };

    this.results.push(result);
    console.log(
      `✅ Benchmark ${benchmark.name} completed: ${result.throughput.toFixed(
        2
      )} qps, avg ${result.avgQueryTime.toFixed(2)}ms`
    );

    return result;
  }

  // Run load test with multiple concurrent queries
  async runLoadTest(config: LoadTestConfig): Promise<PerformanceTestResult[]> {
    console.log(
      `🔥 Starting load test: ${config.duration}s duration, ${config.concurrency} concurrent users`
    );

    const results: PerformanceTestResult[] = [];
    const startTime = Date.now();
    const endTime = startTime + config.duration * 1000;

    // Ramp up phase
    const rampUpDelay = (config.rampUpTime * 1000) / config.concurrency;

    const runWorker = async (workerId: number): Promise<void> => {
      // Stagger worker start for ramp-up
      await new Promise((resolve) =>
        setTimeout(resolve, workerId * rampUpDelay)
      );

      let queryIndex = 0;
      const workerResults: number[] = [];

      while (Date.now() < endTime) {
        const benchmark = config.queries[queryIndex % config.queries.length];

        try {
          const queryStart = performance.now();
          await db.execute(sql.raw(benchmark.query));
          const queryEnd = performance.now();

          workerResults.push(queryEnd - queryStart);
        } catch (error) {
          // Error handling in load test
        }

        queryIndex++;
      }

      // Calculate worker statistics
      if (workerResults.length > 0) {
        const avgTime =
          workerResults.reduce((sum, time) => sum + time, 0) /
          workerResults.length;
        const throughput = workerResults.length / config.duration;

        results.push({
          testName: `load_test_worker_${workerId}`,
          duration: config.duration * 1000,
          queriesExecuted: workerResults.length,
          avgQueryTime: avgTime,
          p95QueryTime: 0, // Simplified for load test
          p99QueryTime: 0,
          throughput,
          errors: 0,
          timestamp: new Date(),
          metadata: { workerId, totalQueries: queryIndex },
        });
      }
    };

    // Start all workers
    const workers = Array.from({ length: config.concurrency }, (_, i) =>
      runWorker(i)
    );
    await Promise.all(workers);

    console.log(
      `✅ Load test completed: ${
        results.length
      } workers, total queries: ${results.reduce(
        (sum, r) => sum + r.queriesExecuted,
        0
      )}`
    );

    return results;
  }

  // Run comprehensive performance test suite
  async runPerformanceTestSuite(): Promise<PerformanceReport> {
    if (this.isRunning) {
      throw new Error("Performance test already running");
    }

    this.isRunning = true;
    this.results = [];

    try {
      console.log(
        "🚀 Starting comprehensive database performance test suite..."
      );

      const suiteStartTime = Date.now();

      // Run individual query benchmarks
      for (const benchmark of this.benchmarkQueries) {
        await this.runQueryBenchmark(benchmark);
      }

      // Run load test
      const loadTestConfig: LoadTestConfig = {
        duration: 30, // 30 seconds
        concurrency: 10, // 10 concurrent users
        rampUpTime: 5, // 5 second ramp-up
        queries: this.benchmarkQueries.slice(0, 3), // Use first 3 queries for load test
      };

      const loadTestResults = await this.runLoadTest(loadTestConfig);
      this.results.push(...loadTestResults);

      // Generate report
      const report = this.generatePerformanceReport();
      report.summary.totalDuration = (Date.now() - suiteStartTime) / 1000;

      console.log("✅ Performance test suite completed");
      console.log(`📊 Total tests: ${report.summary.totalTests}`);
      console.log(
        `⚡ Average throughput: ${report.summary.avgThroughput.toFixed(2)} qps`
      );
      console.log(`❌ Total errors: ${report.summary.totalErrors}`);

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  // Generate performance report with analysis
  private generatePerformanceReport(): PerformanceReport {
    const totalTests = this.results.length;
    const totalDuration =
      this.results.reduce((sum, result) => sum + result.duration, 0) / 1000;
    const totalQueries = this.results.reduce(
      (sum, result) => sum + result.queriesExecuted,
      0
    );
    const totalErrors = this.results.reduce(
      (sum, result) => sum + result.errors,
      0
    );
    const avgThroughput = totalQueries / totalDuration;

    const recommendations: string[] = [];
    const bottlenecks: string[] = [];

    // Analyze results for recommendations
    for (const result of this.results) {
      // Check for slow queries
      if (result.avgQueryTime > 100) {
        // Over 100ms average
        recommendations.push(
          `Optimize ${
            result.testName
          }: average query time ${result.avgQueryTime.toFixed(2)}ms is too slow`
        );
      }

      // Check for high error rates
      const errorRate =
        result.errors / (result.queriesExecuted + result.errors);
      if (errorRate > 0.05) {
        // Over 5% error rate
        bottlenecks.push(
          `${result.testName} has high error rate: ${(errorRate * 100).toFixed(
            1
          )}%`
        );
      }

      // Check for low throughput
      if (result.throughput < 10) {
        // Less than 10 queries per second
        bottlenecks.push(
          `${result.testName} has low throughput: ${result.throughput.toFixed(
            2
          )} qps`
        );
      }
    }

    // Database-specific recommendations
    if (avgThroughput < 50) {
      recommendations.push(
        "Consider increasing connection pool size for better throughput"
      );
      recommendations.push(
        "Review and optimize slow queries with EXPLAIN ANALYZE"
      );
    }

    if (totalErrors > totalQueries * 0.01) {
      // Over 1% total error rate
      recommendations.push("Investigate and fix database connection issues");
      recommendations.push(
        "Check database server resources (CPU, memory, disk I/O)"
      );
    }

    return {
      summary: {
        totalTests,
        totalDuration,
        avgThroughput,
        totalErrors,
        timestamp: new Date(),
      },
      tests: this.results,
      recommendations,
      bottlenecks,
    };
  }

  // Export results to file
  async exportResults(filepath?: string): Promise<string> {
    const exportPath =
      filepath ||
      path.join(__dirname, `../../../performance_test_${Date.now()}.json`);

    const report = this.generatePerformanceReport();
    fs.writeFileSync(exportPath, JSON.stringify(report, null, 2));

    console.log(`📄 Performance test results exported to: ${exportPath}`);
    return exportPath;
  }

  // Compare results with previous run
  compareWithPrevious(previousResults: PerformanceTestResult[]): {
    improvements: string[];
    regressions: string[];
    summary: string;
  } {
    const currentMap = new Map(this.results.map((r) => [r.testName, r]));
    const previousMap = new Map(previousResults.map((r) => [r.testName, r]));

    const improvements: string[] = [];
    const regressions: string[] = [];

    for (const [testName, current] of currentMap) {
      const previous = previousMap.get(testName);
      if (previous) {
        const throughputChange =
          ((current.throughput - previous.throughput) / previous.throughput) *
          100;
        const latencyChange =
          ((current.avgQueryTime - previous.avgQueryTime) /
            previous.avgQueryTime) *
          100;

        if (throughputChange > 10) {
          // 10% improvement
          improvements.push(
            `${testName}: throughput improved by ${throughputChange.toFixed(
              1
            )}%`
          );
        } else if (throughputChange < -10) {
          // 10% regression
          regressions.push(
            `${testName}: throughput decreased by ${Math.abs(
              throughputChange
            ).toFixed(1)}%`
          );
        }

        if (latencyChange < -10) {
          // 10% latency improvement
          improvements.push(
            `${testName}: latency improved by ${Math.abs(latencyChange).toFixed(
              1
            )}%`
          );
        } else if (latencyChange > 10) {
          // 10% latency regression
          regressions.push(
            `${testName}: latency increased by ${latencyChange.toFixed(1)}%`
          );
        }
      }
    }

    const summary = `Comparison complete: ${improvements.length} improvements, ${regressions.length} regressions`;

    return { improvements, regressions, summary };
  }

  // Get current test status
  getStatus(): {
    isRunning: boolean;
    completedTests: number;
    totalTests: number;
    lastTestResult?: PerformanceTestResult;
  } {
    return {
      isRunning: this.isRunning,
      completedTests: this.results.length,
      totalTests: this.benchmarkQueries.length + 1, // +1 for load test
      lastTestResult: this.results[this.results.length - 1],
    };
  }

  // Custom query performance test
  async testCustomQuery(
    name: string,
    query: string,
    params: any[] = [],
    iterations: number = 100
  ): Promise<PerformanceTestResult> {
    const benchmark: QueryBenchmark = {
      name,
      query,
      params,
      iterations,
      description: "Custom query performance test",
    };

    return this.runQueryBenchmark(benchmark);
  }

  // Database connection pool stress test
  async stressTestConnectionPool(
    maxConnections: number = 50,
    testDuration: number = 60
  ): Promise<PerformanceTestResult> {
    console.log(
      `🔥 Starting connection pool stress test: ${maxConnections} connections, ${testDuration}s duration`
    );

    const results: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + testDuration * 1000;

    // Create multiple concurrent connections
    const connectionPromises = Array.from(
      { length: maxConnections },
      async (_, i) => {
        let connectionQueries = 0;
        let connectionErrors = 0;

        while (Date.now() < endTime) {
          try {
            const queryStart = performance.now();
            await db.execute(sql`SELECT 1 as test`);
            const queryEnd = performance.now();

            results.push(queryEnd - queryStart);
            connectionQueries++;
          } catch (error) {
            connectionErrors++;
          }
        }

        return {
          connectionId: i,
          queries: connectionQueries,
          errors: connectionErrors,
        };
      }
    );

    const connectionResults = await Promise.all(connectionPromises);

    const totalQueries = connectionResults.reduce(
      (sum, r) => sum + r.queries,
      0
    );
    const totalErrors = connectionResults.reduce((sum, r) => sum + r.errors, 0);
    const avgQueryTime =
      results.reduce((sum, time) => sum + time, 0) / results.length;
    const throughput = totalQueries / testDuration;

    const result: PerformanceTestResult = {
      testName: "connection_pool_stress_test",
      duration: testDuration * 1000,
      queriesExecuted: totalQueries,
      avgQueryTime,
      p95QueryTime: 0, // Simplified
      p99QueryTime: 0,
      throughput,
      errors: totalErrors,
      timestamp: new Date(),
      metadata: {
        maxConnections,
        connectionResults,
        description: "Connection pool stress test",
      },
    };

    this.results.push(result);
    console.log(
      `✅ Connection pool stress test completed: ${throughput.toFixed(
        2
      )} qps total`
    );

    return result;
  }
}

// Export singleton instance
export const databasePerformanceTest = new DatabasePerformanceTestService();

// CLI helper functions
export async function runPerformanceTests(): Promise<void> {
  try {
    console.log("🚀 Starting database performance tests...");
    const report = await databasePerformanceTest.runPerformanceTestSuite();

    console.log("\n📊 Performance Test Report:");
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(
      `Average Throughput: ${report.summary.avgThroughput.toFixed(2)} qps`
    );
    console.log(`Total Errors: ${report.summary.totalErrors}`);

    if (report.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      report.recommendations.forEach((rec) => console.log(`  • ${rec}`));
    }

    if (report.bottlenecks.length > 0) {
      console.log("\n⚠️  Bottlenecks Identified:");
      report.bottlenecks.forEach((bot) => console.log(`  • ${bot}`));
    }

    // Export results
    const exportPath = await databasePerformanceTest.exportResults();
    console.log(`\n📄 Detailed results saved to: ${exportPath}`);
  } catch (error) {
    console.error("Performance test failed:", error);
    process.exit(1);
  }
}

export async function runCustomQueryTest(
  name: string,
  query: string,
  iterations: number = 100
): Promise<void> {
  try {
    const result = await databasePerformanceTest.testCustomQuery(
      name,
      query,
      [],
      iterations
    );
    console.log(`✅ Custom query test completed:`);
    console.log(`  Throughput: ${result.throughput.toFixed(2)} qps`);
    console.log(`  Average Time: ${result.avgQueryTime.toFixed(2)}ms`);
    console.log(`  Errors: ${result.errors}`);
  } catch (error) {
    console.error("Custom query test failed:", error);
    process.exit(1);
  }
}
