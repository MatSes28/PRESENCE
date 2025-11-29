// Re-export the refactored AI Analytics Service
export { aiAnalyticsService } from "./ai-analytics/index.js";

// Re-export types for backward compatibility
export interface StudentPerformanceData {
  studentId: number;
  attendanceRate: number;
  averageScore: number;
  computerAssignments: number;
  preferredComputers: number[];
  learningStyle: string;
  behavioralFlags: string[];
}

export interface SeatingOptimizationResult {
  studentId: number;
  recommendedComputerId: number;
  confidence: number;
  reasoning: string[];
  predictedPerformance: number;
}

export interface PredictiveModel {
  id: string;
  type: "performance" | "attendance" | "conflict" | "engagement";
  accuracy: number;
  lastTrained: Date;
  features: string[];
  predictions: any[];
}
