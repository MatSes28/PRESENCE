import { emailService } from "./emailService.js";
import { errorTrackingService } from "./errorTrackingService.js";

interface AlertRecipient {
  email: string;
  name?: string;
  alertTypes: ("critical" | "high" | "medium")[];
}

interface AlertConfig {
  recipients: AlertRecipient[];
  cooldownMinutes: number;
  enabled: boolean;
}

class AlertingService {
  private config: AlertConfig;
  private lastAlertTimes: Map<string, Date> = new Map();

  constructor() {
    // Default configuration - can be made configurable later
    this.config = {
      recipients: [
        {
          email: process.env.ADMIN_EMAIL || "admin@clirdec.edu.ph",
          name: "System Administrator",
          alertTypes: ["critical", "high"],
        },
      ],
      cooldownMinutes: 15, // Don't send alerts for the same issue within 15 minutes
      enabled: process.env.ALERTING_ENABLED !== "false",
    };
  }

  // Send alert for critical error
  async sendCriticalErrorAlert(
    error: Error,
    context: {
      endpoint?: string;
      userId?: number;
      requestId?: string;
      category?: string;
      metadata?: any;
    }
  ): Promise<boolean> {
    if (!this.config.enabled) {
      console.log(
        "Alerting disabled, would send critical error alert:",
        error.message
      );
      return false;
    }

    const alertKey = `critical_error_${
      context.endpoint || "system"
    }_${error.message.substring(0, 50)}`;
    if (this.isOnCooldown(alertKey)) {
      console.log("Alert on cooldown, skipping:", alertKey);
      return false;
    }

    const recipients = this.config.recipients.filter((r) =>
      r.alertTypes.includes("critical")
    );

    if (recipients.length === 0) {
      console.log("No recipients configured for critical alerts");
      return false;
    }

    const alertMessage = `
Critical System Error Detected

Error: ${error.message}
Endpoint: ${context.endpoint || "System"}
Category: ${context.category || "Unknown"}
User ID: ${context.userId || "N/A"}
Request ID: ${context.requestId || "N/A"}
Time: ${new Date().toISOString()}

Stack Trace:
${error.stack}

Additional Context:
${context.metadata ? JSON.stringify(context.metadata, null, 2) : "None"}
    `.trim();

    let successCount = 0;
    for (const recipient of recipients) {
      try {
        const success = await emailService.sendSystemAlert(
          recipient.email,
          "Critical System Error",
          alertMessage,
          {
            error: error.message,
            endpoint: context.endpoint,
            userId: context.userId,
            requestId: context.requestId,
            category: context.category,
            timestamp: new Date().toISOString(),
          }
        );

        if (success) {
          successCount++;
          console.log(`Critical error alert sent to ${recipient.email}`);
        } else {
          console.error(
            `Failed to send critical error alert to ${recipient.email}`
          );
        }
      } catch (alertError) {
        console.error(`Error sending alert to ${recipient.email}:`, alertError);
      }
    }

    if (successCount > 0) {
      this.setCooldown(alertKey);
    }

    return successCount > 0;
  }

  // Send alert for high-priority issues
  async sendHighPriorityAlert(
    title: string,
    message: string,
    details?: any
  ): Promise<boolean> {
    if (!this.config.enabled) {
      console.log("Alerting disabled, would send high priority alert:", title);
      return false;
    }

    const alertKey = `high_priority_${title
      .replace(/\s+/g, "_")
      .toLowerCase()}`;
    if (this.isOnCooldown(alertKey)) {
      console.log("Alert on cooldown, skipping:", alertKey);
      return false;
    }

    const recipients = this.config.recipients.filter((r) =>
      r.alertTypes.includes("high")
    );

    if (recipients.length === 0) {
      console.log("No recipients configured for high priority alerts");
      return false;
    }

    let successCount = 0;
    for (const recipient of recipients) {
      try {
        const success = await emailService.sendSystemAlert(
          recipient.email,
          title,
          message,
          details
        );

        if (success) {
          successCount++;
          console.log(`High priority alert sent to ${recipient.email}`);
        } else {
          console.error(
            `Failed to send high priority alert to ${recipient.email}`
          );
        }
      } catch (alertError) {
        console.error(`Error sending alert to ${recipient.email}:`, alertError);
      }
    }

    if (successCount > 0) {
      this.setCooldown(alertKey);
    }

    return successCount > 0;
  }

  // Send alert for database connection issues
  async sendDatabaseAlert(issue: string, details?: any): Promise<boolean> {
    const title = "Database Connection Issue";
    const message = `
Database connectivity problem detected.

Issue: ${issue}
Time: ${new Date().toISOString()}

This may affect system operations. Please investigate immediately.

${details ? `Details: ${JSON.stringify(details, null, 2)}` : ""}
    `.trim();

    return this.sendHighPriorityAlert(title, message, details);
  }

  // Send alert for system performance issues
  async sendPerformanceAlert(
    metric: string,
    value: number,
    threshold: number,
    details?: any
  ): Promise<boolean> {
    const title = "System Performance Alert";
    const message = `
System performance threshold exceeded.

Metric: ${metric}
Current Value: ${value}
Threshold: ${threshold}
Time: ${new Date().toISOString()}

System performance may be degraded. Please investigate.

${details ? `Details: ${JSON.stringify(details, null, 2)}` : ""}
    `.trim();

    return this.sendHighPriorityAlert(title, message, {
      metric,
      value,
      threshold,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  // Send alert for security issues
  async sendSecurityAlert(
    threat: string,
    details: {
      ipAddress?: string;
      userId?: number;
      endpoint?: string;
      userAgent?: string;
      severity: "low" | "medium" | "high" | "critical";
    }
  ): Promise<boolean> {
    const title = "Security Alert";
    const message = `
Security threat detected.

Threat: ${threat}
Severity: ${details.severity}
IP Address: ${details.ipAddress || "Unknown"}
User ID: ${details.userId || "Unknown"}
Endpoint: ${details.endpoint || "Unknown"}
User Agent: ${details.userAgent || "Unknown"}
Time: ${new Date().toISOString()}

Please investigate this security incident immediately.
    `.trim();

    // Security alerts always go to critical recipients regardless of severity
    const alertKey = `security_${threat
      .replace(/\s+/g, "_")
      .toLowerCase()}_${Date.now()}`;

    if (this.isOnCooldown(alertKey)) {
      console.log("Security alert on cooldown, skipping:", alertKey);
      return false;
    }

    const recipients = this.config.recipients.filter((r) =>
      r.alertTypes.includes("critical")
    );

    if (recipients.length === 0) {
      console.log("No recipients configured for security alerts");
      return false;
    }

    let successCount = 0;
    for (const recipient of recipients) {
      try {
        const success = await emailService.sendSystemAlert(
          recipient.email,
          title,
          message,
          details
        );

        if (success) {
          successCount++;
          console.log(`Security alert sent to ${recipient.email}`);
        } else {
          console.error(`Failed to send security alert to ${recipient.email}`);
        }
      } catch (alertError) {
        console.error(
          `Error sending security alert to ${recipient.email}:`,
          alertError
        );
      }
    }

    if (successCount > 0) {
      this.setCooldown(alertKey);
    }

    return successCount > 0;
  }

  // Update configuration
  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): AlertConfig {
    return { ...this.config };
  }

  // Test alerting system
  async testAlert(recipientEmail?: string): Promise<boolean> {
    const testEmail = recipientEmail || this.config.recipients[0]?.email;

    if (!testEmail) {
      console.error("No email configured for testing");
      return false;
    }

    return emailService.sendSystemAlert(
      testEmail,
      "Alert System Test",
      "This is a test alert from the CLIRDEC:PRESENCE alerting system. If you received this, the alerting system is working correctly.",
      {
        test: true,
        timestamp: new Date().toISOString(),
      }
    );
  }

  private isOnCooldown(alertKey: string): boolean {
    const lastAlert = this.lastAlertTimes.get(alertKey);
    if (!lastAlert) return false;

    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert.getTime() < cooldownMs;
  }

  private setCooldown(alertKey: string): void {
    this.lastAlertTimes.set(alertKey, new Date());
  }

  // Clean up old cooldown entries (run periodically)
  cleanupCooldowns(): void {
    const cutoff = Date.now() - this.config.cooldownMinutes * 60 * 1000 * 2; // 2x cooldown period

    for (const [key, time] of this.lastAlertTimes.entries()) {
      if (time.getTime() < cutoff) {
        this.lastAlertTimes.delete(key);
      }
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService();

// Set up periodic cleanup
setInterval(() => {
  alertingService.cleanupCooldowns();
}, 30 * 60 * 1000); // Clean up every 30 minutes
