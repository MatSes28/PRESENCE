// Re-export the refactored Monitoring Service
export { monitoringService } from "./monitoring/index.js";

// Re-export types for backward compatibility
export type {
  SystemMetrics,
  DatabaseMetrics,
  ApplicationMetrics,
  AlertRule,
  Alert,
  PerformanceTrace,
  ErrorLogEntry,
} from "./monitoring/index.js";
