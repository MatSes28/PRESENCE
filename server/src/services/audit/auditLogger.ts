import db from "../../storage.js";
import { auditLogs } from "../../schema.js";
import { desc } from "drizzle-orm";
import crypto from "crypto";

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: number | null;
  action: string;
  resource: string;
  resourceId: string | number | null;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: any;
}

export class AuditLogger {
  private auditTableName = "audit_log";

  // Log an audit event
  async logEvent(event: Omit<AuditEvent, "id" | "timestamp">): Promise<void> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    try {
      // Get the previous hash for tamper-proof chaining
      const lastAuditLog = await db
        .select({ hash: auditLogs.hash })
        .from(auditLogs)
        .orderBy(desc(auditLogs.timestamp))
        .limit(1);

      const previousHash = lastAuditLog[0]?.hash || "";

      // Create hash of current event data + previous hash for tamper-proof chain
      const eventData = JSON.stringify({
        id: auditEvent.id,
        timestamp: auditEvent.timestamp.toISOString(),
        userId: auditEvent.userId,
        action: auditEvent.action,
        resource: auditEvent.resource,
        resourceId: auditEvent.resourceId,
        oldValues: auditEvent.oldValues,
        newValues: auditEvent.newValues,
        ipAddress: auditEvent.ipAddress,
        userAgent: auditEvent.userAgent,
        sessionId: auditEvent.sessionId,
        success: auditEvent.success,
        errorMessage: auditEvent.errorMessage,
        metadata: auditEvent.metadata,
        previousHash,
      });

      const hash = crypto.createHash("sha256").update(eventData).digest("hex");

      // Insert into database with tamper-proof hash
      await db.insert(auditLogs).values({
        id: auditEvent.id,
        timestamp: auditEvent.timestamp,
        userId: auditEvent.userId || null,
        action: auditEvent.action,
        resource: auditEvent.resource,
        resourceId: auditEvent.resourceId?.toString() || null,
        oldValues: auditEvent.oldValues || null,
        newValues: auditEvent.newValues || null,
        ipAddress: auditEvent.ipAddress,
        userAgent: auditEvent.userAgent || null,
        sessionId: auditEvent.sessionId || null,
        success: auditEvent.success,
        errorMessage: auditEvent.errorMessage || null,
        metadata: auditEvent.metadata || null,
        hash,
        previousHash,
      });

      // Also log to console for immediate visibility
      console.log("AUDIT EVENT:", {
        id: auditEvent.id,
        timestamp: auditEvent.timestamp.toISOString(),
        userId: auditEvent.userId,
        action: auditEvent.action,
        resource: auditEvent.resource,
        resourceId: auditEvent.resourceId,
        success: auditEvent.success,
        ipAddress: auditEvent.ipAddress,
        errorMessage: auditEvent.errorMessage,
        hash,
      });
    } catch (error) {
      console.error("Failed to log audit event:", error);
      // Don't throw error to avoid breaking the main operation
    }
  }
}

export const auditLogger = new AuditLogger();
