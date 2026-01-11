import db from "../storage.js";
import {
  students,
  attendanceRecords,
  emailNotifications,
  userSessions,
  errorLogs,
  pushNotifications,
  iotDeviceHeartbeats,
} from "../schema.js";
import { lt, eq, and, sql } from "drizzle-orm";
import { auditService } from "./auditService.js";

interface RetentionPolicy {
  table: string;
  field: string;
  retentionDays: number;
  archiveBeforeDelete?: boolean;
  anonymizeBeforeDelete?: boolean;
}

class DataRetentionService {
  private policies: RetentionPolicy[] = [
    {
      table: "attendance_records",
      field: "created_at",
      retentionDays: 2555, // 7 years
      archiveBeforeDelete: true,
    },
    {
      table: "email_notifications",
      field: "sent_at",
      retentionDays: 2555, // 7 years
    },
    {
      table: "user_sessions",
      field: "created_at",
      retentionDays: 365, // 1 year
      anonymizeBeforeDelete: true,
    },
    {
      table: "error_logs",
      field: "timestamp",
      retentionDays: 730, // 2 years
    },
    {
      table: "push_notifications",
      field: "created_at",
      retentionDays: 365, // 1 year
    },
    {
      table: "iot_device_heartbeats",
      field: "timestamp",
      retentionDays: 365, // 1 year
    },
  ];

  // Execute data retention cleanup
  async executeRetentionCleanup(): Promise<any> {
    const results = {
      totalRecordsProcessed: 0,
      recordsArchived: 0,
      recordsAnonymized: 0,
      recordsDeleted: 0,
      errors: [] as string[],
      executedAt: new Date(),
    };

    for (const policy of this.policies) {
      try {
        const policyResults = await this.processRetentionPolicy(policy);
        results.totalRecordsProcessed += policyResults.processed;
        results.recordsArchived += policyResults.archived;
        results.recordsAnonymized += policyResults.anonymized;
        results.recordsDeleted += policyResults.deleted;
      } catch (error) {
        console.error(
          `Error processing retention policy for ${policy.table}:`,
          error
        );
        results.errors.push(`${policy.table}: ${error.message}`);
      }
    }

    // Log the cleanup operation
    await auditService.logSystemEvent("data_retention_cleanup", results);

    return results;
  }

  // Process a single retention policy
  private async processRetentionPolicy(policy: RetentionPolicy): Promise<{
    processed: number;
    archived: number;
    anonymized: number;
    deleted: number;
  }> {
    const cutoffDate = new Date(
      Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000
    );

    let processed = 0;
    let archived = 0;
    let anonymized = 0;
    let deleted = 0;

    switch (policy.table) {
      case "attendance_records":
        ({ processed, archived, deleted } = await this.processAttendanceRecords(
          cutoffDate,
          policy
        ));
        break;
      case "email_notifications":
        ({ processed, deleted } = await this.processEmailNotifications(
          cutoffDate
        ));
        break;
      case "user_sessions":
        ({ processed, anonymized, deleted } = await this.processUserSessions(
          cutoffDate,
          policy
        ));
        break;
      case "error_logs":
        ({ processed, deleted } = await this.processErrorLogs(cutoffDate));
        break;
      case "push_notifications":
        ({ processed, deleted } = await this.processPushNotifications(
          cutoffDate
        ));
        break;
      case "iot_device_heartbeats":
        ({ processed, deleted } = await this.processIoTHeartbeats(cutoffDate));
        break;
    }

    return { processed, archived, anonymized, deleted };
  }

  // Process attendance records retention
  private async processAttendanceRecords(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; archived: number; deleted: number }> {
    // Get old records
    const oldRecords = await db
      .select()
      .from(attendanceRecords)
      .where(lt(attendanceRecords.createdAt, cutoffDate));

    if (oldRecords.length === 0) {
      return { processed: 0, archived: 0, deleted: 0 };
    }

    let archived = 0;
    let deleted = 0;

    if (policy.archiveBeforeDelete) {
      // In a real implementation, this would archive to a separate table or file
      // For now, we'll just mark as inactive
      await db
        .update(attendanceRecords)
        .set({ isActive: false })
        .where(lt(attendanceRecords.createdAt, cutoffDate));
      archived = oldRecords.length;
    } else {
      // Delete old records
      await db
        .delete(attendanceRecords)
        .where(lt(attendanceRecords.createdAt, cutoffDate));
      deleted = oldRecords.length;
    }

    return { processed: oldRecords.length, archived, deleted };
  }

  // Process email notifications retention
  private async processEmailNotifications(
    cutoffDate: Date
  ): Promise<{ processed: number; deleted: number }> {
    const oldNotifications = await db
      .select()
      .from(emailNotifications)
      .where(lt(emailNotifications.sentAt, cutoffDate));

    if (oldNotifications.length > 0) {
      await db
        .delete(emailNotifications)
        .where(lt(emailNotifications.sentAt, cutoffDate));
    }

    return {
      processed: oldNotifications.length,
      deleted: oldNotifications.length,
    };
  }

  // Process user sessions retention
  private async processUserSessions(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<{ processed: number; anonymized: number; deleted: number }> {
    const oldSessions = await db
      .select()
      .from(userSessions)
      .where(lt(userSessions.createdAt, cutoffDate));

    if (oldSessions.length === 0) {
      return { processed: 0, anonymized: 0, deleted: 0 };
    }

    let anonymized = 0;
    let deleted = 0;

    if (policy.anonymizeBeforeDelete) {
      // Anonymize sensitive session data before deletion
      for (const session of oldSessions) {
        // In a real implementation, this would anonymize the data
        // For now, just delete
        await db.delete(userSessions).where(eq(userSessions.id, session.id));
        anonymized++;
      }
    } else {
      await db
        .delete(userSessions)
        .where(lt(userSessions.createdAt, cutoffDate));
      deleted = oldSessions.length;
    }

    return { processed: oldSessions.length, anonymized, deleted };
  }

  // Process error logs retention
  private async processErrorLogs(
    cutoffDate: Date
  ): Promise<{ processed: number; deleted: number }> {
    const oldLogs = await db
      .select()
      .from(errorLogs)
      .where(lt(errorLogs.timestamp, cutoffDate));

    if (oldLogs.length > 0) {
      await db.delete(errorLogs).where(lt(errorLogs.timestamp, cutoffDate));
    }

    return { processed: oldLogs.length, deleted: oldLogs.length };
  }

  // Process push notifications retention
  private async processPushNotifications(
    cutoffDate: Date
  ): Promise<{ processed: number; deleted: number }> {
    const oldNotifications = await db
      .select()
      .from(pushNotifications)
      .where(lt(pushNotifications.createdAt, cutoffDate));

    if (oldNotifications.length > 0) {
      await db
        .delete(pushNotifications)
        .where(lt(pushNotifications.createdAt, cutoffDate));
    }

    return {
      processed: oldNotifications.length,
      deleted: oldNotifications.length,
    };
  }

  // Process IoT heartbeats retention
  private async processIoTHeartbeats(
    cutoffDate: Date
  ): Promise<{ processed: number; deleted: number }> {
    const oldHeartbeats = await db
      .select()
      .from(iotDeviceHeartbeats)
      .where(lt(iotDeviceHeartbeats.timestamp, cutoffDate));

    if (oldHeartbeats.length > 0) {
      await db
        .delete(iotDeviceHeartbeats)
        .where(lt(iotDeviceHeartbeats.timestamp, cutoffDate));
    }

    return { processed: oldHeartbeats.length, deleted: oldHeartbeats.length };
  }

  // Update retention policies (admin function)
  updateRetentionPolicy(table: string, retentionDays: number): void {
    const policy = this.policies.find((p) => p.table === table);
    if (policy) {
      policy.retentionDays = retentionDays;
    }
  }

  // Get current retention policies
  getRetentionPolicies(): RetentionPolicy[] {
    return [...this.policies];
  }

  // Preview what would be cleaned up
  async previewRetentionCleanup(): Promise<any> {
    const preview = {};

    for (const policy of this.policies) {
      const cutoffDate = new Date(
        Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000
      );

      let count = 0;
      switch (policy.table) {
        case "attendance_records":
          const attendanceCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(attendanceRecords)
            .where(lt(attendanceRecords.createdAt, cutoffDate));
          count = attendanceCount[0].count;
          break;
        case "email_notifications":
          const emailCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(emailNotifications)
            .where(lt(emailNotifications.sentAt, cutoffDate));
          count = emailCount[0].count;
          break;
        // Add other tables as needed
      }

      preview[policy.table] = {
        retentionDays: policy.retentionDays,
        cutoffDate,
        recordsToProcess: count,
      };
    }

    return preview;
  }

  // Start automated retention cleanup
  startAutomatedCleanup(): void {
    // Run daily at 2 AM
    const runCleanup = () => {
      const now = new Date();
      if (now.getHours() === 2) {
        this.executeRetentionCleanup().catch((error) => {
          console.error("Automated retention cleanup failed:", error);
        });
      }
    };

    // Check every hour
    setInterval(runCleanup, 60 * 60 * 1000);
  }
}

export const dataRetentionService = new DataRetentionService();

// Start automated cleanup
dataRetentionService.startAutomatedCleanup();
