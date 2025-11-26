import { db } from "../storage.js";
import { securityEvents } from "../schema.js";
import { desc } from "drizzle-orm";

export interface SecurityEventData {
  userId?: number;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

/**
 * Log a security event for monitoring and audit purposes
 */
export async function logSecurityEvent(
  eventData: SecurityEventData
): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      userId: eventData.userId || null,
      eventType: eventData.eventType,
      ipAddress: eventData.ipAddress || null,
      userAgent: eventData.userAgent || null,
      details: eventData.details || null,
    });
  } catch (error) {
    // Log to console if database logging fails, but don't throw
    console.error("Failed to log security event:", error);
  }
}

/**
 * Get security events for monitoring dashboard
 */
export async function getSecurityEvents(
  limit: number = 100,
  offset: number = 0
) {
  try {
    const events = await db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.createdAt))
      .limit(limit)
      .offset(offset);

    return events;
  } catch (error) {
    console.error("Failed to fetch security events:", error);
    return [];
  }
}

/**
 * Get security statistics
 */
export async function getSecurityStats() {
  try {
    // This would be implemented with more complex queries
    // For now, return basic structure
    return {
      totalEvents: 0,
      failedLogins: 0,
      successfulLogins: 0,
      accountLockouts: 0,
      passwordResets: 0,
    };
  } catch (error) {
    console.error("Failed to fetch security stats:", error);
    return null;
  }
}
