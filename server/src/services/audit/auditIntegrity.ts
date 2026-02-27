import db from "../../storage.js";
import { auditLogs } from "../../schema.js";
import { and, asc, gte, lte, sql } from "drizzle-orm";
import crypto from "crypto";

type VerifyOptions = {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
};

const normalizeMaybeJson = (value: any) => {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

export class AuditIntegrityService {
  async verifyHashChain(options: VerifyOptions = {}): Promise<{
    ok: boolean;
    checked: number;
    startDate?: Date;
    endDate?: Date;
    firstMismatchIndex: number | null;
    mismatches: Array<{
      index: number;
      id: string;
      reason: string;
      expectedPreviousHash: string;
      storedPreviousHash: string;
      expectedHash: string;
      storedHash: string;
    }>;
    lastHash: string;
  }> {
    const conditions: any[] = [];
    if (options.startDate)
      conditions.push(gte(auditLogs.timestamp, options.startDate));
    if (options.endDate)
      conditions.push(lte(auditLogs.timestamp, options.endDate));

    const whereClause = conditions.length ? and(...conditions) : sql`1=1`;

    const rows = await db
      .select({
        id: auditLogs.id,
        timestamp: auditLogs.timestamp,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        sessionId: auditLogs.sessionId,
        success: auditLogs.success,
        errorMessage: auditLogs.errorMessage,
        metadata: auditLogs.metadata,
        hash: auditLogs.hash,
        previousHash: auditLogs.previousHash,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(asc(auditLogs.timestamp))
      .limit(options.limit || 5000);

    const mismatches: any[] = [];
    let prevHash = "";

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as any;
      const expectedPreviousHash = prevHash;
      const storedPreviousHash = r.previousHash || "";

      // Recompute hash using the same field ordering as [`AuditLogger.logEvent()`](server/src/services/audit/auditLogger.ts:27)
      const eventData = JSON.stringify({
        id: r.id,
        timestamp: new Date(r.timestamp).toISOString(),
        userId: r.userId,
        action: r.action,
        resource: r.resource,
        resourceId: r.resourceId,
        oldValues: normalizeMaybeJson(r.oldValues),
        newValues: normalizeMaybeJson(r.newValues),
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        sessionId: r.sessionId,
        success: r.success,
        errorMessage: r.errorMessage,
        metadata: normalizeMaybeJson(r.metadata),
        previousHash: expectedPreviousHash,
      });

      const expectedHash = crypto
        .createHash("sha256")
        .update(eventData)
        .digest("hex");

      const storedHash = r.hash || "";

      if (storedPreviousHash !== expectedPreviousHash) {
        mismatches.push({
          index: i,
          id: r.id,
          reason: "previous_hash_mismatch",
          expectedPreviousHash,
          storedPreviousHash,
          expectedHash,
          storedHash,
        });
      } else if (storedHash !== expectedHash) {
        mismatches.push({
          index: i,
          id: r.id,
          reason: "hash_mismatch",
          expectedPreviousHash,
          storedPreviousHash,
          expectedHash,
          storedHash,
        });
      }

      prevHash = storedHash;
    }

    return {
      ok: mismatches.length === 0,
      checked: rows.length,
      startDate: options.startDate,
      endDate: options.endDate,
      firstMismatchIndex: mismatches.length ? mismatches[0].index : null,
      mismatches,
      lastHash: prevHash,
    };
  }
}

export const auditIntegrityService = new AuditIntegrityService();
