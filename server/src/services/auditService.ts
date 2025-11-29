/**
 * Legacy Audit Service
 *
 * This file has been refactored into a modular architecture.
 * The new audit service is located in ./audit/ directory.
 *
 * This file now serves as a backward compatibility layer.
 */

// Re-export the new modular audit service
export { auditService } from "./audit/index.js";

// Re-export types for backward compatibility
export type { AuditEvent, AuditQuery, AuditStats } from "./audit/index.js";
