import db from "../../storage.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { auditLogs } from "../../schema.js";
import type { AuditEvent } from "./auditLogger.js";

export interface AuditQuery {
  userId?: number;
  action?: string;
  resource?: string;
  resourceId?: string | number;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResource: Record<string, number>;
  eventsByUser: Record<number, number>;
  recentActivity: AuditEvent[];
  suspiciousActivity: AuditEvent[];
}

export class AuditQueryService {
  // Query audit events
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    try {
      let conditions = [];

      if (query.userId) {
        conditions.push(eq(auditLogs.userId, query.userId));
      }

      if (query.action) {
        conditions.push(eq(auditLogs.action, query.action));
      }

      if (query.resource) {
        conditions.push(eq(auditLogs.resource, query.resource));
      }

      if (query.resourceId) {
        conditions.push(eq(auditLogs.resourceId, query.resourceId.toString()));
      }

      if (query.startDate) {
        conditions.push(gte(auditLogs.timestamp, query.startDate));
      }

      if (query.endDate) {
        conditions.push(lte(auditLogs.timestamp, query.endDate));
      }

      if (query.ipAddress) {
        conditions.push(eq(auditLogs.ipAddress, query.ipAddress));
      }

      if (query.success !== undefined) {
        conditions.push(eq(auditLogs.success, query.success));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.timestamp))
        .limit(query.limit || 100)
        .offset(query.offset || 0);

      return results.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.userId || undefined,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId || undefined,
        oldValues: row.oldValues || undefined,
        newValues: row.newValues || undefined,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent || undefined,
        sessionId: row.sessionId || undefined,
        success: row.success,
        errorMessage: row.errorMessage || undefined,
        metadata: row.metadata || undefined,
      }));
    } catch (error) {
      console.error("Failed to query audit events:", error);
      return [];
    }
  }

  // Get audit statistics
  async getAuditStats(startDate: Date, endDate: Date): Promise<AuditStats> {
    try {
      // Get total events count
      const totalEventsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate)
          )
        );

      const totalEvents = totalEventsResult[0]?.count || 0;

      // Get events by action
      const eventsByActionResult = await db
        .select({
          action: auditLogs.action,
          count: sql<number>`count(*)`,
        })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate)
          )
        )
        .groupBy(auditLogs.action);

      const eventsByAction = eventsByActionResult.reduce((acc, row) => {
        acc[row.action] = row.count;
        return acc;
      }, {} as Record<string, number>);

      // Get events by resource
      const eventsByResourceResult = await db
        .select({
          resource: auditLogs.resource,
          count: sql<number>`count(*)`,
        })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate)
          )
        )
        .groupBy(auditLogs.resource);

      const eventsByResource = eventsByResourceResult.reduce((acc, row) => {
        acc[row.resource] = row.count;
        return acc;
      }, {} as Record<string, number>);

      // Get events by user
      const eventsByUserResult = await db
        .select({
          userId: auditLogs.userId,
          count: sql<number>`count(*)`,
        })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate),
            sql`${auditLogs.userId} IS NOT NULL`
          )
        )
        .groupBy(auditLogs.userId);

      const eventsByUser = eventsByUserResult.reduce((acc, row) => {
        if (row.userId) {
          acc[row.userId] = row.count;
        }
        return acc;
      }, {} as Record<number, number>);

      // Get recent activity (last 50 events)
      const recentActivityResult = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate)
          )
        )
        .orderBy(desc(auditLogs.timestamp))
        .limit(50);

      const recentActivity = recentActivityResult.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.userId || undefined,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId || undefined,
        oldValues: row.oldValues || undefined,
        newValues: row.newValues || undefined,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent || undefined,
        sessionId: row.sessionId || undefined,
        success: row.success,
        errorMessage: row.errorMessage || undefined,
        metadata: row.metadata || undefined,
      }));

      // Get suspicious activity (failed logins, security events, etc.)
      const suspiciousActivityResult = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.timestamp, startDate),
            lte(auditLogs.timestamp, endDate),
            sql`(${auditLogs.success} = false OR ${auditLogs.action} LIKE 'SECURITY_%')`
          )
        )
        .orderBy(desc(auditLogs.timestamp))
        .limit(50);

      const suspiciousActivity = suspiciousActivityResult.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        userId: row.userId || undefined,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId || undefined,
        oldValues: row.oldValues || undefined,
        newValues: row.newValues || undefined,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent || undefined,
        sessionId: row.sessionId || undefined,
        success: row.success,
        errorMessage: row.errorMessage || undefined,
        metadata: row.metadata || undefined,
      }));

      return {
        totalEvents,
        eventsByAction,
        eventsByResource,
        eventsByUser,
        recentActivity,
        suspiciousActivity,
      };
    } catch (error) {
      console.error("Failed to get audit stats:", error);
      return {
        totalEvents: 0,
        eventsByAction: {},
        eventsByResource: {},
        eventsByUser: {},
        recentActivity: [],
        suspiciousActivity: [],
      };
    }
  }
}

export const auditQueryService = new AuditQueryService();
