import { auditService } from "./auditService.js";
import { alertingService } from "./alertingService.js";

interface LogAggregationConfig {
  aggregationIntervalMinutes: number;
  retentionDays: number;
  alertThresholds: {
    failedLoginsPerHour: number;
    suspiciousActivitiesPerHour: number;
    securityEventsPerHour: number;
  };
  enabled: boolean;
}

interface AggregatedLogStats {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByResource: Record<string, number>;
  eventsByUser: Record<number, number>;
  failedOperations: number;
  securityEvents: number;
  suspiciousPatterns: any[];
  topIPs: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: number; count: number }>;
}

class LogAggregationService {
  private config: LogAggregationConfig;
  private aggregationTimer?: NodeJS.Timeout;

  constructor() {
    this.config = {
      aggregationIntervalMinutes: 15, // Aggregate every 15 minutes
      retentionDays: 90, // Keep aggregated data for 90 days
      alertThresholds: {
        failedLoginsPerHour: 10,
        suspiciousActivitiesPerHour: 5,
        securityEventsPerHour: 3,
      },
      enabled: process.env.LOG_AGGREGATION_ENABLED !== "false",
    };

    if (this.config.enabled) {
      this.startAggregation();
    }
  }

  // Start periodic log aggregation
  private startAggregation(): void {
    console.log(
      `Starting log aggregation every ${this.config.aggregationIntervalMinutes} minutes`
    );

    // Run initial aggregation
    this.aggregateLogs();

    // Set up periodic aggregation
    this.aggregationTimer = setInterval(() => {
      this.aggregateLogs();
    }, this.config.aggregationIntervalMinutes * 60 * 1000);
  }

  // Stop aggregation
  stopAggregation(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
      console.log("Log aggregation stopped");
    }
  }

  // Aggregate logs for the last aggregation interval
  private async aggregateLogs(): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - this.config.aggregationIntervalMinutes * 60 * 1000
      );

      console.log(
        `Aggregating logs from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      const stats = await this.generateAggregatedStats(startDate, endDate);

      // Check for alerts based on thresholds
      await this.checkAlertThresholds(stats);

      // Store aggregated data (in a real implementation, this would go to a separate table)
      console.log("Log aggregation completed:", {
        totalEvents: stats.totalEvents,
        securityEvents: stats.securityEvents,
        failedOperations: stats.failedOperations,
      });
    } catch (error) {
      console.error("Error during log aggregation:", error);
    }
  }

  // Generate aggregated statistics
  async generateAggregatedStats(
    startDate: Date,
    endDate: Date
  ): Promise<AggregatedLogStats> {
    const auditStats = await auditService.getAuditStats(startDate, endDate);

    // Additional analysis
    const events = auditStats.recentActivity;

    // Analyze suspicious patterns
    const suspiciousPatterns = await auditService.detectSuspiciousActivity(
      0, // Analyze for all users
      events
    );

    // Get top IPs and users
    const ipCounts: Record<string, number> = {};
    const userCounts: Record<number, number> = {};

    events.forEach((event) => {
      if (event.ipAddress) {
        ipCounts[event.ipAddress] = (ipCounts[event.ipAddress] || 0) + 1;
      }
      if (event.userId) {
        userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      }
    });

    const topIPs = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId: parseInt(userId), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      period: { startDate, endDate },
      totalEvents: auditStats.totalEvents,
      eventsByType: auditStats.eventsByAction,
      eventsByResource: auditStats.eventsByResource,
      eventsByUser: auditStats.eventsByUser,
      failedOperations: auditStats.suspiciousActivity.length,
      securityEvents: auditStats.suspiciousActivity.filter((e) =>
        e.action.startsWith("SECURITY_")
      ).length,
      suspiciousPatterns,
      topIPs,
      topUsers,
    };
  }

  // Check alert thresholds and send alerts if needed
  private async checkAlertThresholds(stats: AggregatedLogStats): Promise<void> {
    const hoursInPeriod = this.config.aggregationIntervalMinutes / 60;

    // Calculate rates per hour
    const failedLoginRate = stats.failedOperations / hoursInPeriod;
    const securityEventRate = stats.securityEvents / hoursInPeriod;
    const suspiciousActivityRate =
      stats.suspiciousPatterns.length / hoursInPeriod;

    // Check failed login threshold
    if (failedLoginRate >= this.config.alertThresholds.failedLoginsPerHour) {
      await alertingService.sendSecurityAlert("High Failed Login Rate", {
        severity: "high",
        ipAddress: stats.topIPs[0]?.ip,
        userId: stats.topUsers[0]?.userId,
        endpoint: "authentication",
      });
    }

    // Check security events threshold
    if (
      securityEventRate >= this.config.alertThresholds.securityEventsPerHour
    ) {
      await alertingService.sendSecurityAlert("High Security Event Rate", {
        severity: "high",
        endpoint: "system",
      });
    }

    // Check suspicious activities threshold
    if (
      suspiciousActivityRate >=
      this.config.alertThresholds.suspiciousActivitiesPerHour
    ) {
      await alertingService.sendSecurityAlert("High Suspicious Activity Rate", {
        severity: "medium",
        endpoint: "system",
      });
    }
  }

  // Search logs with advanced filtering
  async searchLogs(query: {
    text?: string;
    userId?: number;
    action?: string;
    resource?: string;
    ipAddress?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    // Use the existing audit service query method
    const events = await auditService.queryEvents(query);

    // Add additional search capabilities if needed
    if (query.text) {
      return events.filter((event) =>
        JSON.stringify(event).toLowerCase().includes(query.text!.toLowerCase())
      );
    }

    return events;
  }

  // Get real-time log stream (for monitoring dashboards)
  async getRealTimeLogs(since: Date, limit: number = 100): Promise<any[]> {
    return auditService.queryEvents({
      startDate: since,
      limit,
    });
  }

  // Export logs in various formats
  async exportLogs(
    startDate: Date,
    endDate: Date,
    format: "json" | "csv" | "xml" = "json",
    filters?: any
  ): Promise<string> {
    const events = await auditService.queryEvents({
      startDate,
      endDate,
      ...filters,
    });

    switch (format) {
      case "json":
        return JSON.stringify(events, null, 2);

      case "csv":
        if (events.length === 0) return "";
        const headers = Object.keys(events[0]).join(",");
        const rows = events.map((event) =>
          Object.values(event)
            .map((val) =>
              typeof val === "object" ? JSON.stringify(val) : String(val)
            )
            .join(",")
        );
        return [headers, ...rows].join("\n");

      case "xml":
        const xmlEvents = events.map((event) => {
          const properties = Object.entries(event)
            .map(([key, value]) => `<${key}>${value}</${key}>`)
            .join("");
          return `<event>${properties}</event>`;
        });
        return `<auditLogs>${xmlEvents.join("")}</auditLogs>`;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<LogAggregationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart aggregation if enabled status changed
    if (newConfig.enabled !== undefined) {
      if (newConfig.enabled) {
        this.startAggregation();
      } else {
        this.stopAggregation();
      }
    }
  }

  // Get current configuration
  getConfig(): LogAggregationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const logAggregationService = new LogAggregationService();
