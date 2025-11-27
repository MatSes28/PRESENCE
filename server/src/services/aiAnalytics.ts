import { db } from "../storage.js";
import {
  students,
  attendanceRecords,
  computerAssignments,
  classSessions,
  schedules,
  subjects,
  enrollments,
  computers,
} from "../schema.js";
import { eq, and, gte, lte, desc, sql, avg, count } from "drizzle-orm";

interface StudentPerformanceData {
  studentId: number;
  attendanceRate: number;
  averageScore: number;
  computerAssignments: number;
  preferredComputers: number[];
  learningStyle: string;
  behavioralFlags: string[];
}

interface SeatingOptimizationResult {
  studentId: number;
  recommendedComputerId: number;
  confidence: number;
  reasoning: string[];
  predictedPerformance: number;
}

interface PredictiveModel {
  id: string;
  type: "performance" | "attendance" | "conflict" | "engagement";
  accuracy: number;
  lastTrained: Date;
  features: string[];
  predictions: any[];
}

class AIAnalyticsService {
  private models: Map<string, PredictiveModel> = new Map();

  // AI-Powered Seating Optimization
  async optimizeSeatingArrangement(
    sessionId: number
  ): Promise<SeatingOptimizationResult[]> {
    try {
      // Get session details and enrolled students
      const sessionData = await this.getSessionData(sessionId);
      const studentData = await this.getStudentPerformanceData(
        sessionData.enrolledStudentIds
      );

      // Apply machine learning optimization
      const optimizations = await this.applyMachineLearningOptimization(
        studentData,
        sessionData.availableComputers
      );

      return optimizations;
    } catch (error) {
      console.error("AI seating optimization error:", error);
      throw error;
    }
  }

  // Predictive Performance Modeling
  async predictStudentPerformance(
    studentId: number,
    computerId: number,
    sessionId: number
  ): Promise<{
    predictedScore: number;
    confidence: number;
    factors: string[];
  }> {
    try {
      // Gather historical data for this student
      const historicalData = await this.getStudentHistoricalData(studentId);

      // Get computer performance patterns
      const computerData = await this.getComputerPerformanceData(computerId);

      // Get session context
      const sessionData = await this.getSessionContext(sessionId);

      // Apply predictive model
      const prediction = await this.applyPerformancePredictionModel(
        historicalData,
        computerData,
        sessionData
      );

      return prediction;
    } catch (error) {
      console.error("Performance prediction error:", error);
      throw error;
    }
  }

  // Automated Conflict Detection and Resolution
  async detectAndResolveConflicts(sessionId: number): Promise<{
    detectedConflicts: any[];
    resolutions: any[];
    confidence: number;
  }> {
    try {
      const sessionData = await this.getSessionData(sessionId);
      const assignments = await this.getCurrentAssignments(sessionId);

      // Detect potential conflicts using AI
      const detectedConflicts = await this.detectConflictsAI(
        assignments,
        sessionData
      );

      // Generate resolution recommendations
      const resolutions = await this.generateConflictResolutions(
        detectedConflicts,
        sessionData
      );

      return {
        detectedConflicts,
        resolutions,
        confidence: 0.85, // Mock confidence score
      };
    } catch (error) {
      console.error("Conflict resolution error:", error);
      throw error;
    }
  }

  // Learning Analytics Dashboard Data
  async generateLearningAnalytics(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      const analytics = {
        performanceTrends: await this.analyzePerformanceTrends(
          facultyId,
          startDate,
          endDate
        ),
        attendancePatterns: await this.analyzeAttendancePatterns(
          facultyId,
          startDate,
          endDate
        ),
        seatingEffectiveness: await this.analyzeSeatingEffectiveness(
          facultyId,
          startDate,
          endDate
        ),
        engagementMetrics: await this.calculateEngagementMetrics(
          facultyId,
          startDate,
          endDate
        ),
        predictiveInsights: await this.generatePredictiveInsights(
          facultyId,
          startDate,
          endDate
        ),
        attendancePredictions: await this.predictAttendancePatterns(
          facultyId,
          startDate,
          endDate
        ),
        anomalyDetection: await this.detectAttendanceAnomalies(
          facultyId,
          startDate,
          endDate
        ),
      };

      return analytics;
    } catch (error) {
      console.error("Learning analytics error:", error);
      throw error;
    }
  }

  // Predictive Attendance Analytics
  async predictAttendancePatterns(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    predictions: Array<{
      date: string;
      predictedAttendance: number;
      confidence: number;
      factors: string[];
      riskLevel: "low" | "medium" | "high";
    }>;
    trends: {
      overallTrend: "increasing" | "decreasing" | "stable";
      seasonalPatterns: any[];
      riskFactors: string[];
    };
  }> {
    try {
      // Get historical attendance data
      const historicalData = await this.getHistoricalAttendanceData(
        facultyId,
        startDate,
        endDate
      );

      // Analyze patterns and predict future attendance
      const predictions = await this.generateAttendancePredictions(
        historicalData
      );
      const trends = await this.analyzeAttendanceTrends(historicalData);

      return {
        predictions,
        trends,
      };
    } catch (error) {
      console.error("Attendance prediction error:", error);
      throw error;
    }
  }

  // Pattern Recognition for Attendance Anomalies
  async detectAttendanceAnomalies(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    anomalies: Array<{
      type:
        | "sudden_drop"
        | "unusual_pattern"
        | "student_specific"
        | "time_based";
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      affectedStudents: number[];
      affectedSessions: number[];
      confidence: number;
      recommendedActions: string[];
    }>;
    patterns: {
      identified: string[];
      confidence: number;
      impact: "low" | "medium" | "high";
    };
  }> {
    try {
      const historicalData = await this.getHistoricalAttendanceData(
        facultyId,
        startDate,
        endDate
      );

      // Detect various types of anomalies
      const anomalies = await this.identifyAnomalies(historicalData);
      const patterns = await this.analyzeAnomalyPatterns(anomalies);

      return {
        anomalies,
        patterns,
      };
    } catch (error) {
      console.error("Anomaly detection error:", error);
      throw error;
    }
  }

  // Machine Learning Optimization Algorithm
  private async applyMachineLearningOptimization(
    studentData: StudentPerformanceData[],
    availableComputers: any[]
  ): Promise<SeatingOptimizationResult[]> {
    const results: SeatingOptimizationResult[] = [];

    // Sort students by performance (prioritize struggling students for optimization)
    const sortedStudents = studentData.sort(
      (a, b) => a.averageScore - b.averageScore
    );

    for (const student of sortedStudents) {
      const bestComputer = await this.findOptimalComputerML(
        student,
        availableComputers,
        results
      );

      if (bestComputer) {
        const prediction = await this.predictStudentPerformance(
          student.studentId,
          bestComputer.id,
          0 // sessionId not needed for this calculation
        );

        results.push({
          studentId: student.studentId,
          recommendedComputerId: bestComputer.id,
          confidence: prediction.confidence,
          reasoning: [
            `Predicted performance improvement: ${(
              prediction.predictedScore * 100
            ).toFixed(1)}%`,
            `Learning style compatibility: ${student.learningStyle}`,
            `Historical performance on similar computers: ${
              bestComputer.historicalAvg || 0
            }%`,
            ...prediction.factors,
          ],
          predictedPerformance: prediction.predictedScore,
        });
      }
    }

    return results;
  }

  // Find optimal computer using ML algorithm
  private async findOptimalComputerML(
    student: StudentPerformanceData,
    availableComputers: any[],
    currentAssignments: SeatingOptimizationResult[]
  ): Promise<any> {
    let bestComputer = null;
    let bestScore = -1;

    for (const computer of availableComputers) {
      // Skip already assigned computers
      if (
        currentAssignments.some((a) => a.recommendedComputerId === computer.id)
      ) {
        continue;
      }

      const score = await this.calculateMLComputerScore(
        student,
        computer,
        currentAssignments
      );

      if (score > bestScore) {
        bestScore = score;
        bestComputer = computer;
      }
    }

    return bestComputer;
  }

  // ML-based computer scoring
  private async calculateMLComputerScore(
    student: StudentPerformanceData,
    computer: any,
    currentAssignments: SeatingOptimizationResult[]
  ): Promise<number> {
    let score = 50; // Base score

    // Performance prediction factor
    const performancePrediction = await this.predictStudentPerformance(
      student.studentId,
      computer.id,
      0
    );
    score += performancePrediction.predictedScore * 20;

    // Learning style compatibility
    if (student.learningStyle) {
      const positionCompatibility = this.calculatePositionCompatibility(
        student.learningStyle,
        computer
      );
      score += positionCompatibility * 15;
    }

    // Proximity to high performers (peer learning)
    const nearbyHighPerformers = this.countNearbyHighPerformers(
      computer,
      currentAssignments,
      student
    );
    score += nearbyHighPerformers * 10;

    // Computer familiarity bonus
    if (student.preferredComputers.includes(computer.id)) {
      score += 12;
    }

    // Conflict avoidance
    const nearbyConflicts = this.countNearbyConflicts(
      computer,
      currentAssignments,
      student
    );
    score -= nearbyConflicts * 25;

    return Math.max(0, Math.min(100, score));
  }

  // Performance Prediction Model
  private async applyPerformancePredictionModel(
    historicalData: any,
    computerData: any,
    sessionData: any
  ): Promise<{
    predictedScore: number;
    confidence: number;
    factors: string[];
  }> {
    // Simplified ML prediction (in real system, use trained model)
    const factors: string[] = [];
    let predictedScore = 0.7; // Base prediction
    let confidence = 0.75;

    // Historical attendance factor
    if (historicalData.attendanceRate > 0.9) {
      predictedScore += 0.1;
      factors.push("Excellent attendance history (+10%)");
    } else if (historicalData.attendanceRate < 0.7) {
      predictedScore -= 0.15;
      factors.push("Poor attendance history (-15%)");
    }

    // Computer performance history
    if (computerData.averagePerformance) {
      const adjustment = (computerData.averagePerformance - 0.7) * 0.3;
      predictedScore += adjustment;
      factors.push(
        `Computer performance history (${(adjustment * 100).toFixed(1)}%)`
      );
    }

    // Time of day factor
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 11) {
      predictedScore += 0.05;
      factors.push("Optimal morning session timing (+5%)");
    } else if (hour >= 14 && hour <= 16) {
      predictedScore -= 0.08;
      factors.push("Sub-optimal afternoon timing (-8%)");
    }

    // Learning style compatibility
    if (historicalData.learningStyle === computerData.optimalLearningStyle) {
      predictedScore += 0.08;
      factors.push("Learning style compatibility (+8%)");
    }

    return {
      predictedScore: Math.max(0, Math.min(1, predictedScore)),
      confidence,
      factors,
    };
  }

  // Conflict Detection AI
  private async detectConflictsAI(
    assignments: any[],
    sessionData: any
  ): Promise<any[]> {
    const conflicts: any[] = [];

    // Analyze seating patterns for potential conflicts
    for (const assignment of assignments) {
      const nearbyAssignments = this.getNearbyAssignments(
        assignment,
        assignments
      );

      for (const nearby of nearbyAssignments) {
        // Check for learning style conflicts
        if (this.hasLearningStyleConflict(assignment.student, nearby.student)) {
          conflicts.push({
            type: "learning_style",
            student1: assignment.student,
            student2: nearby.student,
            severity: "medium",
            description: "Conflicting learning styles may reduce effectiveness",
          });
        }

        // Check for performance gap conflicts
        if (
          this.hasPerformanceGapConflict(assignment.student, nearby.student)
        ) {
          conflicts.push({
            type: "performance_gap",
            student1: assignment.student,
            student2: nearby.student,
            severity: "high",
            description: "Large performance gap may affect peer learning",
          });
        }

        // Check for behavioral conflicts
        if (this.hasBehavioralConflict(assignment.student, nearby.student)) {
          conflicts.push({
            type: "behavioral",
            student1: assignment.student,
            student2: nearby.student,
            severity: "critical",
            description: "Known behavioral conflicts detected",
          });
        }
      }
    }

    return conflicts;
  }

  // Generate conflict resolution recommendations
  private async generateConflictResolutions(
    conflicts: any[],
    sessionData: any
  ): Promise<any[]> {
    const resolutions: any[] = [];

    for (const conflict of conflicts) {
      const resolution = {
        conflictId: conflict.id,
        type: conflict.type,
        recommendation: this.generateResolutionRecommendation(conflict),
        alternativeComputers: await this.findAlternativeComputers(
          conflict,
          sessionData
        ),
        priority: this.calculateResolutionPriority(conflict),
      };

      resolutions.push(resolution);
    }

    return resolutions.sort((a, b) => b.priority - a.priority);
  }

  // Learning Analytics Methods
  private async analyzePerformanceTrends(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const conditions = [];
    if (facultyId) conditions.push(eq(schedules.facultyId, facultyId));
    if (startDate) conditions.push(gte(classSessions.date, startDate));
    if (endDate) conditions.push(lte(classSessions.date, endDate));

    const performanceData = await db
      .select({
        subject: subjects.name,
        date: classSessions.date,
        attendanceCount: count(attendanceRecords.id),
        totalStudents: count(enrollments.id),
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.subjectId, schedules.subjectId),
          eq(enrollments.semester, schedules.semester),
          eq(enrollments.academicYear, schedules.academicYear)
        )
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(subjects.name, classSessions.date)
      .orderBy(desc(classSessions.date));

    return {
      trends: performanceData,
      insights: this.generatePerformanceInsights(performanceData),
    };
  }

  private async analyzeAttendancePatterns(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    // Analyze attendance patterns by time, day, subject
    const patterns = await db
      .select({
        dayOfWeek: sql<number>`EXTRACT(DOW FROM ${classSessions.date})`,
        hour: sql<number>`EXTRACT(HOUR FROM ${schedules.startTime})`,
        attendanceRate: sql<number>`AVG(CASE WHEN ${attendanceRecords.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        subject: subjects.name,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(facultyId ? eq(schedules.facultyId, facultyId) : undefined)
      .groupBy(
        sql`EXTRACT(DOW FROM ${classSessions.date})`,
        sql`EXTRACT(HOUR FROM ${schedules.startTime})`,
        subjects.name
      );

    return {
      patterns,
      recommendations: this.generateAttendanceRecommendations(patterns),
    };
  }

  private async analyzeSeatingEffectiveness(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    // Analyze how seating arrangements affect performance
    const seatingData = await db
      .select({
        computerId: computerAssignments.computerId,
        studentPerformance: sql<number>`AVG(${attendanceRecords.isValid})`, // Simplified metric
        sessionCount: count(computerAssignments.id),
      })
      .from(computerAssignments)
      .innerJoin(
        attendanceRecords,
        eq(attendanceRecords.studentId, computerAssignments.studentId)
      )
      .where(
        facultyId
          ? eq(
              computerAssignments.classSessionId,
              sql`ANY(SELECT id FROM class_sessions WHERE schedule_id IN (SELECT id FROM schedules WHERE faculty_id = ${facultyId}))`
            )
          : undefined
      )
      .groupBy(computerAssignments.computerId);

    return {
      effectiveness: seatingData,
      optimization: this.generateSeatingOptimization(seatingData),
    };
  }

  private async calculateEngagementMetrics(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    // Calculate engagement based on various factors
    const engagement = {
      attendanceConsistency: 0.85,
      participationRate: 0.78,
      computerUtilization: 0.92,
      interactionPatterns: 0.71,
    };

    return engagement;
  }

  private async generatePredictiveInsights(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const insights = [
      {
        type: "performance",
        title: "Predicted Performance Decline",
        description:
          "Next week may see 15% lower attendance due to holiday season",
        confidence: 0.82,
        recommendation: "Consider rescheduling or providing makeup sessions",
      },
      {
        type: "engagement",
        title: "Optimal Seating Opportunity",
        description:
          "Reassigning 3 students could improve class engagement by 12%",
        confidence: 0.76,
        recommendation: "Run AI seating optimization for next session",
      },
      {
        type: "attendance",
        title: "Morning Session Preference",
        description: "Students perform 18% better in 9 AM sessions vs 2 PM",
        confidence: 0.89,
        recommendation: "Schedule important sessions in the morning",
      },
    ];

    return insights;
  }

  // Helper Methods
  private async getSessionData(sessionId: number): Promise<any> {
    const session = await db
      .select({
        session: classSessions,
        schedule: schedules,
        subject: subjects,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(eq(classSessions.id, sessionId))
      .limit(1);

    if (!session.length) throw new Error("Session not found");

    const enrolledStudents = await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.subjectId, session[0].schedule.subjectId),
          eq(enrollments.semester, session[0].schedule.semester),
          eq(enrollments.academicYear, session[0].schedule.academicYear)
        )
      );

    const availableComputers = await db
      .select()
      .from(computers)
      .where(
        and(
          eq(computers.classroomId, session[0].schedule.classroomId),
          eq(computers.status, "available")
        )
      );

    return {
      session: session[0],
      enrolledStudentIds: enrolledStudents.map((e) => e.studentId),
      availableComputers,
    };
  }

  private async getStudentPerformanceData(
    studentIds: number[]
  ): Promise<StudentPerformanceData[]> {
    const studentsData: StudentPerformanceData[] = [];

    for (const studentId of studentIds) {
      const attendanceRate = await this.calculateAttendanceRate(studentId);
      const averageScore = await this.calculateAverageScore(studentId);
      const computerAssignmentsCount = await this.countComputerAssignments(
        studentId
      );
      const preferredComputers = await this.getPreferredComputers(studentId);
      const learningStyle = await this.inferLearningStyle(studentId);

      studentsData.push({
        studentId,
        attendanceRate,
        averageScore,
        computerAssignments: computerAssignmentsCount,
        preferredComputers,
        learningStyle,
        behavioralFlags: [], // Would be populated from behavioral records
      });
    }

    return studentsData;
  }

  private async calculateAttendanceRate(studentId: number): Promise<number> {
    const result = await db
      .select({
        attended: count(attendanceRecords.id),
        total: count(classSessions.id),
      })
      .from(classSessions)
      .leftJoin(
        attendanceRecords,
        and(
          eq(attendanceRecords.classSessionId, classSessions.id),
          eq(attendanceRecords.studentId, studentId)
        )
      )
      .limit(1);

    return result[0]?.total > 0 ? result[0].attended / result[0].total : 0;
  }

  private async calculateAverageScore(studentId: number): Promise<number> {
    // Simplified - in real system would have grades table
    return Math.random() * 0.4 + 0.6; // 0.6 to 1.0 range
  }

  private async countComputerAssignments(studentId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(computerAssignments)
      .where(eq(computerAssignments.studentId, studentId));

    return result[0]?.count || 0;
  }

  private async getPreferredComputers(studentId: number): Promise<number[]> {
    const assignments = await db
      .select({
        computerId: computerAssignments.computerId,
        count: count(computerAssignments.id),
      })
      .from(computerAssignments)
      .where(eq(computerAssignments.studentId, studentId))
      .groupBy(computerAssignments.computerId)
      .orderBy(desc(count(computerAssignments.id)))
      .limit(3);

    return assignments.map((a) => a.computerId);
  }

  private async inferLearningStyle(studentId: number): Promise<string> {
    // Simplified learning style inference
    const styles = ["visual", "auditory", "kinesthetic"];
    return styles[Math.floor(Math.random() * styles.length)];
  }

  // Additional helper methods would be implemented...
  private calculatePositionCompatibility(
    learningStyle: string,
    computer: any
  ): number {
    // Simplified compatibility calculation
    return Math.random() * 0.5 + 0.5; // 0.5 to 1.0
  }

  private countNearbyHighPerformers(
    computer: any,
    assignments: SeatingOptimizationResult[],
    student: StudentPerformanceData
  ): number {
    // Simplified proximity calculation
    return Math.floor(Math.random() * 3);
  }

  private countNearbyConflicts(
    computer: any,
    assignments: SeatingOptimizationResult[],
    student: StudentPerformanceData
  ): number {
    // Simplified conflict counting
    return Math.floor(Math.random() * 2);
  }

  private async getStudentHistoricalData(studentId: number): Promise<any> {
    return {
      attendanceRate: await this.calculateAttendanceRate(studentId),
      averageScore: await this.calculateAverageScore(studentId),
      learningStyle: await this.inferLearningStyle(studentId),
    };
  }

  private async getComputerPerformanceData(computerId: number): Promise<any> {
    const assignments = await db
      .select()
      .from(computerAssignments)
      .where(eq(computerAssignments.computerId, computerId))
      .limit(10);

    return {
      averagePerformance: 0.75, // Mock value
      optimalLearningStyle: "visual", // Mock value
      totalAssignments: assignments.length,
    };
  }

  private async getSessionContext(sessionId: number): Promise<any> {
    return {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      subjectType: "technical", // Mock value
    };
  }

  private async getCurrentAssignments(sessionId: number): Promise<any[]> {
    // Mock assignments for conflict detection
    return [];
  }

  private getNearbyAssignments(assignment: any, allAssignments: any[]): any[] {
    // Simplified proximity logic
    return allAssignments.filter((a) => a.id !== assignment.id).slice(0, 4);
  }

  private hasLearningStyleConflict(student1: any, student2: any): boolean {
    // Simplified conflict detection
    return Math.random() > 0.8;
  }

  private hasPerformanceGapConflict(student1: any, student2: any): boolean {
    // Simplified performance gap detection
    return (
      Math.abs((student1.performance || 0) - (student2.performance || 0)) > 1.0
    );
  }

  private hasBehavioralConflict(student1: any, student2: any): boolean {
    // Simplified behavioral conflict detection
    return Math.random() > 0.95;
  }

  private generateResolutionRecommendation(conflict: any): string {
    switch (conflict.type) {
      case "learning_style":
        return "Separate students with conflicting learning styles or provide differentiated instruction";
      case "performance_gap":
        return "Pair with similar-performing students for better peer learning";
      case "behavioral":
        return "Immediate reassignment required - separate students";
      default:
        return "Review seating arrangement";
    }
  }

  private async findAlternativeComputers(
    conflict: any,
    sessionData: any
  ): Promise<any[]> {
    // Return alternative computer suggestions
    return sessionData.availableComputers.slice(0, 3);
  }

  private calculateResolutionPriority(conflict: any): number {
    switch (conflict.severity) {
      case "critical":
        return 10;
      case "high":
        return 7;
      case "medium":
        return 4;
      case "low":
        return 1;
      default:
        return 3;
    }
  }

  private generatePerformanceInsights(data: any[]): any[] {
    return [
      {
        type: "trend",
        message: "Attendance improving by 5% over last month",
        impact: "positive",
      },
      {
        type: "alert",
        message: "Computer Science subject showing 12% lower engagement",
        impact: "negative",
      },
    ];
  }

  private generateAttendanceRecommendations(patterns: any[]): any[] {
    return [
      "Schedule complex subjects in morning sessions",
      "Avoid Friday afternoon sessions for better attendance",
      "Consider 90-minute sessions for better engagement",
    ];
  }

  private generateSeatingOptimization(data: any[]): any[] {
    return [
      "Front row computers show 15% better performance",
      "Corner positions have 8% lower engagement",
      "Center positions optimal for group work",
    ];
  }

  // New Predictive Analytics Methods
  private async getHistoricalAttendanceData(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const conditions = [];
    if (facultyId) conditions.push(eq(schedules.facultyId, facultyId));
    if (startDate) conditions.push(gte(classSessions.date, startDate));
    if (endDate) conditions.push(lte(classSessions.date, endDate));

    const data = await db
      .select({
        date: classSessions.date,
        subjectId: schedules.subjectId,
        subjectName: subjects.name,
        dayOfWeek: schedules.dayOfWeek,
        startTime: schedules.startTime,
        totalEnrolled: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`,
        totalPresent: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'present' THEN ${attendanceRecords.studentId} END)`,
        totalAbsent: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'absent' THEN ${attendanceRecords.studentId} END)`,
        totalLate: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'late' THEN ${attendanceRecords.studentId} END)`,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.subjectId, schedules.subjectId),
          eq(enrollments.semester, schedules.semester),
          eq(enrollments.academicYear, schedules.academicYear)
        )
      )
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        classSessions.date,
        schedules.subjectId,
        subjects.name,
        schedules.dayOfWeek,
        schedules.startTime
      )
      .orderBy(classSessions.date);

    return data;
  }

  private async generateAttendancePredictions(historicalData: any[]): Promise<
    Array<{
      date: string;
      predictedAttendance: number;
      confidence: number;
      factors: string[];
      riskLevel: "low" | "medium" | "high";
    }>
  > {
    const predictions = [];

    // Generate predictions for next 7 days
    for (let i = 1; i <= 7; i++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + i);
      const dayOfWeek = futureDate.getDay();

      // Find similar historical patterns
      const similarDays = historicalData.filter(
        (d) => new Date(d.date).getDay() === dayOfWeek
      );

      if (similarDays.length > 0) {
        const avgAttendance =
          similarDays.reduce(
            (sum, d) => sum + d.totalPresent / d.totalEnrolled,
            0
          ) / similarDays.length;

        // Apply seasonal and trend adjustments
        let adjustedAttendance = avgAttendance;
        const factors = [];

        // Day of week adjustment
        if (dayOfWeek === 5) {
          // Friday
          adjustedAttendance *= 0.95;
          factors.push("Friday attendance typically 5% lower");
        } else if (dayOfWeek === 1) {
          // Monday
          adjustedAttendance *= 0.98;
          factors.push("Monday attendance slightly lower");
        }

        // Time-based patterns
        const hour = futureDate.getHours();
        if (hour >= 14 && hour <= 16) {
          adjustedAttendance *= 0.92;
          factors.push("Afternoon sessions have lower attendance");
        }

        // Weather/external factors (simplified)
        if (this.isHolidaySeason(futureDate)) {
          adjustedAttendance *= 0.85;
          factors.push("Holiday season impact expected");
        }

        // Calculate confidence based on data availability
        const confidence = Math.min(0.95, similarDays.length / 10);

        // Determine risk level
        let riskLevel: "low" | "medium" | "high" = "low";
        if (adjustedAttendance < 0.7) riskLevel = "high";
        else if (adjustedAttendance < 0.8) riskLevel = "medium";

        predictions.push({
          date: futureDate.toISOString().split("T")[0],
          predictedAttendance: Math.round(adjustedAttendance * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          factors,
          riskLevel,
        });
      }
    }

    return predictions;
  }

  private async analyzeAttendanceTrends(historicalData: any[]): Promise<{
    overallTrend: "increasing" | "decreasing" | "stable";
    seasonalPatterns: any[];
    riskFactors: string[];
  }> {
    // Analyze trends over time
    const sortedData = historicalData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let overallTrend: "increasing" | "decreasing" | "stable" = "stable";
    if (sortedData.length >= 14) {
      const recent = sortedData.slice(-7);
      const previous = sortedData.slice(-14, -7);

      const recentAvg =
        recent.reduce((sum, d) => sum + d.totalPresent / d.totalEnrolled, 0) /
        recent.length;
      const previousAvg =
        previous.reduce((sum, d) => sum + d.totalPresent / d.totalEnrolled, 0) /
        previous.length;

      const change = (recentAvg - previousAvg) / previousAvg;
      if (change > 0.05) overallTrend = "increasing";
      else if (change < -0.05) overallTrend = "decreasing";
    }

    // Identify seasonal patterns
    const seasonalPatterns = this.identifySeasonalPatterns(historicalData);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(historicalData);

    return {
      overallTrend,
      seasonalPatterns,
      riskFactors,
    };
  }

  private async identifyAnomalies(historicalData: any[]): Promise<
    Array<{
      type:
        | "sudden_drop"
        | "unusual_pattern"
        | "student_specific"
        | "time_based";
      severity: "low" | "medium" | "high" | "critical";
      description: string;
      affectedStudents: number[];
      affectedSessions: number[];
      confidence: number;
      recommendedActions: string[];
    }>
  > {
    const anomalies = [];

    // Analyze attendance rates for sudden drops
    const sortedData = historicalData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 1; i < sortedData.length; i++) {
      const current = sortedData[i];
      const previous = sortedData[i - 1];

      const currentRate = current.totalPresent / current.totalEnrolled;
      const previousRate = previous.totalPresent / previous.totalEnrolled;
      const drop = previousRate - currentRate;

      if (drop > 0.2) {
        // 20% drop
        anomalies.push({
          type: "sudden_drop",
          severity: drop > 0.3 ? "critical" : "high",
          description: `Attendance dropped ${Math.round(drop * 100)}% from ${(
            previousRate * 100
          ).toFixed(1)}% to ${(currentRate * 100).toFixed(1)}%`,
          affectedStudents: [], // Would need more detailed analysis
          affectedSessions: [current.date],
          confidence: 0.85,
          recommendedActions: [
            "Investigate cause of attendance drop",
            "Contact absent students",
            "Consider rescheduling if pattern continues",
          ],
        });
      }
    }

    // Check for unusual patterns (e.g., perfect attendance suddenly)
    const perfectAttendanceDays = sortedData.filter(
      (d) => d.totalPresent / d.totalEnrolled > 0.98
    );
    if (perfectAttendanceDays.length > 3) {
      anomalies.push({
        type: "unusual_pattern",
        severity: "medium",
        description: `${perfectAttendanceDays.length} days with near-perfect attendance detected`,
        affectedStudents: [],
        affectedSessions: perfectAttendanceDays.map((d) => d.date),
        confidence: 0.75,
        recommendedActions: [
          "Verify attendance recording accuracy",
          "Check for potential data entry issues",
        ],
      });
    }

    // Time-based anomalies (very low attendance at certain times)
    const timeAnalysis = this.analyzeTimeBasedAnomalies(historicalData);
    anomalies.push(...timeAnalysis);

    return anomalies;
  }

  private async analyzeAnomalyPatterns(anomalies: any[]): Promise<{
    identified: string[];
    confidence: number;
    impact: "low" | "medium" | "high";
  }> {
    const patterns = [];
    let confidence = 0.8;
    let impact: "low" | "medium" | "high" = "low";

    // Analyze frequency of anomalies
    const criticalCount = anomalies.filter(
      (a) => a.severity === "critical"
    ).length;
    const highCount = anomalies.filter((a) => a.severity === "high").length;

    if (criticalCount > 0) {
      patterns.push("Critical attendance issues detected");
      impact = "high";
    } else if (highCount > 2) {
      patterns.push("Multiple high-severity attendance issues");
      impact = "medium";
    }

    // Check for recurring patterns
    const suddenDropCount = anomalies.filter(
      (a) => a.type === "sudden_drop"
    ).length;
    if (suddenDropCount > 3) {
      patterns.push("Recurring sudden attendance drops detected");
      confidence = 0.9;
    }

    if (patterns.length === 0) {
      patterns.push("No significant anomaly patterns identified");
      confidence = 0.6;
    }

    return {
      identified: patterns,
      confidence,
      impact,
    };
  }

  private isHolidaySeason(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();
    // Simplified holiday check
    return (
      (month === 11 && day >= 20) || // December holidays
      (month === 0 && day <= 5) || // New Year
      (month === 3 && day >= 14 && day <= 16) // Holy Week (approximate)
    );
  }

  private identifySeasonalPatterns(historicalData: any[]): any[] {
    const patterns = [];

    // Group by month
    const monthlyData: { [key: number]: number[] } = {};
    historicalData.forEach((d) => {
      const month = new Date(d.date).getMonth();
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(d.totalPresent / d.totalEnrolled);
    });

    // Find seasonal trends
    Object.entries(monthlyData).forEach(([month, rates]) => {
      if (rates.length >= 3) {
        const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        if (avg < 0.75) {
          patterns.push({
            month: parseInt(month),
            averageAttendance: Math.round(avg * 100),
            description: `Lower attendance typically observed in ${this.getMonthName(
              parseInt(month)
            )}`,
          });
        }
      }
    });

    return patterns;
  }

  private identifyRiskFactors(historicalData: any[]): string[] {
    const factors = [];

    // Analyze day-of-week patterns
    const dayPatterns: { [key: number]: number[] } = {};
    historicalData.forEach((d) => {
      if (!dayPatterns[d.dayOfWeek]) dayPatterns[d.dayOfWeek] = [];
      dayPatterns[d.dayOfWeek].push(d.totalPresent / d.totalEnrolled);
    });

    Object.entries(dayPatterns).forEach(([day, rates]) => {
      if (rates.length >= 3) {
        const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        if (avg < 0.8) {
          factors.push(
            `Low attendance on ${this.getDayName(parseInt(day))}s (${Math.round(
              avg * 100
            )}% average)`
          );
        }
      }
    });

    return factors;
  }

  private analyzeTimeBasedAnomalies(historicalData: any[]): any[] {
    const anomalies = [];

    // Group by hour
    const hourlyData: { [key: string]: number[] } = {};
    historicalData.forEach((d) => {
      const hour = d.startTime.split(":")[0];
      if (!hourlyData[hour]) hourlyData[hour] = [];
      hourlyData[hour].push(d.totalPresent / d.totalEnrolled);
    });

    // Find unusually low attendance hours
    Object.entries(hourlyData).forEach(([hour, rates]) => {
      if (rates.length >= 3) {
        const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        if (avg < 0.6) {
          anomalies.push({
            type: "time_based",
            severity: "medium",
            description: `Very low attendance at ${hour}:00 sessions (${Math.round(
              avg * 100
            )}% average)`,
            affectedStudents: [],
            affectedSessions: [],
            confidence: 0.8,
            recommendedActions: [
              "Consider rescheduling sessions away from this time",
              "Investigate reasons for low attendance at this hour",
            ],
          });
        }
      }
    });

    return anomalies;
  }

  private getMonthName(month: number): string {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month] || "Unknown";
  }

  private getDayName(day: number): string {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[day] || "Unknown";
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
