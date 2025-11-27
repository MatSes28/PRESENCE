import { Router } from "express";
import { aiAnalyticsService } from "../services/aiAnalytics.js";

const router = Router();

// AI-Powered Seating Optimization
router.post("/optimize-seating/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const optimization = await aiAnalyticsService.optimizeSeatingArrangement(
      parseInt(sessionId)
    );

    res.json({
      success: true,
      message: "AI seating optimization completed",
      data: optimization,
    });
  } catch (error) {
    console.error("Seating optimization error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to optimize seating arrangement",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Predictive Performance Analysis
router.get(
  "/predict-performance/:studentId/:computerId/:sessionId",
  async (req, res) => {
    try {
      const { studentId, computerId, sessionId } = req.params;
      const prediction = await aiAnalyticsService.predictStudentPerformance(
        parseInt(studentId),
        parseInt(computerId),
        parseInt(sessionId)
      );

      res.json({
        success: true,
        message: "Performance prediction generated",
        data: prediction,
      });
    } catch (error) {
      console.error("Performance prediction error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate performance prediction",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Automated Conflict Detection and Resolution
router.post("/detect-conflicts/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await aiAnalyticsService.detectAndResolveConflicts(
      parseInt(sessionId)
    );

    res.json({
      success: true,
      message: "Conflict analysis completed",
      data: result,
    });
  } catch (error) {
    console.error("Conflict detection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to detect conflicts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Learning Analytics Dashboard
router.get("/learning-analytics", async (req, res) => {
  try {
    const { facultyId, startDate, endDate } = req.query;

    const analytics = await aiAnalyticsService.generateLearningAnalytics(
      facultyId ? parseInt(facultyId as string) : undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      message: "Learning analytics generated",
      data: analytics,
    });
  } catch (error) {
    console.error("Learning analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate learning analytics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// AI Insights and Recommendations
router.get("/insights", async (req, res) => {
  try {
    const { facultyId, startDate, endDate } = req.query;

    const analytics = await aiAnalyticsService.generateLearningAnalytics(
      facultyId ? parseInt(facultyId as string) : undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    // Extract insights from analytics
    const insights = analytics.predictiveInsights || [];

    res.json({
      success: true,
      message: "AI insights generated",
      data: {
        insights,
        performance: analytics.performanceTrends,
        attendance: analytics.attendancePatterns,
        seating: analytics.seatingEffectiveness,
        engagement: analytics.engagementMetrics,
      },
    });
  } catch (error) {
    console.error("AI insights error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI insights",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Performance Trends Analysis
router.get("/performance-trends", async (req, res) => {
  try {
    const { facultyId, startDate, endDate } = req.query;

    const analytics = await aiAnalyticsService.generateLearningAnalytics(
      facultyId ? parseInt(facultyId as string) : undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      message: "Performance trends analyzed",
      data: analytics.performanceTrends,
    });
  } catch (error) {
    console.error("Performance trends error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze performance trends",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Attendance Pattern Analysis
router.get("/attendance-patterns", async (req, res) => {
  try {
    const { facultyId, startDate, endDate } = req.query;

    const analytics = await aiAnalyticsService.generateLearningAnalytics(
      facultyId ? parseInt(facultyId as string) : undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      message: "Attendance patterns analyzed",
      data: analytics.attendancePatterns,
    });
  } catch (error) {
    console.error("Attendance patterns error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze attendance patterns",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Seating Effectiveness Analysis
router.get("/seating-effectiveness", async (req, res) => {
  try {
    const { facultyId, startDate, endDate } = req.query;

    const analytics = await aiAnalyticsService.generateLearningAnalytics(
      facultyId ? parseInt(facultyId as string) : undefined,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      message: "Seating effectiveness analyzed",
      data: analytics.seatingEffectiveness,
    });
  } catch (error) {
    console.error("Seating effectiveness error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to analyze seating effectiveness",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
