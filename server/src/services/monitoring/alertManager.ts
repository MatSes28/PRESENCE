import { loggerService } from "./logger.js";

// Alert Configuration
export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  cooldown: number; // minutes
  enabled: boolean;
}

// Alert Instance
export interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: AlertRule["severity"];
  message: string;
  metrics: any;
  resolved: boolean;
  resolvedAt?: Date;
}

export class AlertManager {
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();

  constructor() {
    this.initializeAlertRules();
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
  public checkAlerts(metrics: any): void {
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
    loggerService.getLogger().error("Alert Triggered", {
      type: "alert",
      alert,
    });

    // TODO: Send notifications (email, SMS, etc.) for critical alerts
    if (rule.severity === "critical") {
      console.error(`🚨 CRITICAL ALERT: ${rule.message}`);
      // In production, this would send SMS/email notifications
    }
  }

  // Get all active alerts
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => !alert.resolved
    );
  }

  // Resolve an alert
  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  // Get alert rules
  public getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  // Update alert rule
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex((rule) => rule.id === ruleId);
    if (ruleIndex !== -1) {
      this.alertRules[ruleIndex] = {
        ...this.alertRules[ruleIndex],
        ...updates,
      };
      return true;
    }
    return false;
  }

  // Add custom alert rule
  public addAlertRule(rule: AlertRule): void {
    // Check if rule with same ID already exists
    const existingIndex = this.alertRules.findIndex((r) => r.id === rule.id);
    if (existingIndex !== -1) {
      this.alertRules[existingIndex] = rule;
    } else {
      this.alertRules.push(rule);
    }
  }

  // Remove alert rule
  public removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex((rule) => rule.id === ruleId);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  // Clear all active alerts
  public clearAllAlerts(): void {
    this.activeAlerts.clear();
    this.alertCooldowns.clear();
  }
}

export const alertManager = new AlertManager();
