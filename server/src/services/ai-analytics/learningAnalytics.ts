import db from "../../storage.js";
import {
  classSessions,
  schedules,
  subjects,
  enrollments,
  attendanceRecords,
  computerAssignments,
} from "../../schema.js";
import { eq, and, gte, lte, count, sql } from "drizzle-orm";

export class LearningAnalyticsService {
  // Learning Analytics Dashboard Data
  async generateLearningAnalytics(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    // Wrap each analytics method in try-catch for resilience
    // This ensures that if one method fails, others still return data

    let performanceTrends,
      attendancePatterns,
      seatingEffectiveness,
      engagementMetrics,
      predictiveInsights,
      attendancePredictions;

    try {
      performanceTrends = await this.analyzePerformanceTrends(
        facultyId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error("Performance trends analysis error:", err);
      performanceTrends = { trends: [], summary: null };
    }

    try {
      attendancePatterns = await this.analyzeAttendancePatterns(
        facultyId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error("Attendance patterns analysis error:", err);
      attendancePatterns = { patterns: [], summary: null };
    }

    try {
      seatingEffectiveness = await this.analyzeSeatingEffectiveness(
        facultyId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error("Seating effectiveness analysis error:", err);
      seatingEffectiveness = { effectiveness: [], optimization: null };
    }

    try {
      engagementMetrics = await this.calculateEngagementMetrics(
        facultyId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error("Engagement metrics analysis error:", err);
      engagementMetrics = {
        attendanceConsistency: 0,
        participationRate: 0,
        avgSessionDuration: 0,
      };
    }

    try {
      predictiveInsights = await this.generatePredictiveInsights(
        facultyId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error("Predictive insights analysis error:", err);
      predictiveInsights = [];
    }

    try {
      attendancePredictions = await this.predictAttendancePatterns(
        facultyId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error("Attendance predictions analysis error:", err);
      attendancePredictions = { predictions: [], confidence: 0 };
    }

    return {
      performanceTrends,
      attendancePatterns,
      seatingEffectiveness,
      engagementMetrics,
      predictiveInsights,
      attendancePredictions,
    };
  }

  private async analyzePerformanceTrends(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
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
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .leftJoin(
        enrollments,
        and(
          eq(enrollments.subjectId, schedules.subjectId),
          eq(enrollments.semester, schedules.semester),
          eq(enrollments.academicYear, schedules.academicYear),
        ),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(subjects.name, classSessions.date);

    return {
      trends: performanceData,
      insights: this.generatePerformanceInsights(performanceData),
    };
  }

  private async analyzeAttendancePatterns(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    // Analyze attendance patterns by time, day, subject
    // Using explicit casts to handle potential type mismatches
    const patterns = await db
      .select({
        dayOfWeek: sql<number>`EXTRACT(DOW FROM ${classSessions.date}::timestamp)`,
        hour: sql<number>`EXTRACT(HOUR FROM ${schedules.startTime}::time)`,
        attendanceRate: sql<number>`AVG(CASE WHEN ${attendanceRecords.id} IS NOT NULL THEN 1 ELSE 0 END)`,
        subject: subjects.name,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .where(facultyId ? eq(schedules.facultyId, facultyId) : undefined)
      .groupBy(
        sql`EXTRACT(DOW FROM ${classSessions.date}::timestamp)`,
        sql`EXTRACT(HOUR FROM ${schedules.startTime}::time)`,
        subjects.name,
      );

    return {
      patterns,
      recommendations: this.generateAttendanceRecommendations(patterns),
    };
  }

  private async analyzeSeatingEffectiveness(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    // Analyze how seating arrangements affect performance
    const seatingData = await db
      .select({
        computerId: computerAssignments.computerId,
        studentPerformance: sql<number>`AVG(${attendanceRecords.isValid}::int)`, // Simplified metric
        sessionCount: count(computerAssignments.id),
      })
      .from(computerAssignments)
      .innerJoin(
        attendanceRecords,
        eq(attendanceRecords.studentId, computerAssignments.studentId),
      )
      .where(
        facultyId
          ? eq(
              computerAssignments.classSessionId,
              sql`ANY(SELECT id FROM class_sessions WHERE schedule_id IN (SELECT id FROM schedules WHERE faculty_id = ${facultyId}))`,
            )
          : undefined,
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
    endDate?: Date,
  ): Promise<any> {
    const conditions = [];
    if (facultyId) conditions.push(eq(schedules.facultyId, facultyId));
    if (startDate) conditions.push(gte(classSessions.date, startDate));
    if (endDate) conditions.push(lte(classSessions.date, endDate));
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [attendanceRow, utilizationRow] = await Promise.all([
      db
        .select({
          presentRate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1.0 ELSE 0.0 END)`,
          recordCount: count(attendanceRecords.id),
        })
        .from(attendanceRecords)
        .innerJoin(
          classSessions,
          eq(attendanceRecords.classSessionId, classSessions.id),
        )
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(whereClause),
      db
        .select({
          assignmentCount: count(computerAssignments.id),
          sessionCount: sql<number>`COUNT(DISTINCT ${computerAssignments.classSessionId})`,
        })
        .from(computerAssignments)
        .innerJoin(
          classSessions,
          eq(computerAssignments.classSessionId, classSessions.id),
        )
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(whereClause),
    ]);

    const presentRate = Number(attendanceRow[0]?.presentRate ?? 0);
    const recordCount = Number(attendanceRow[0]?.recordCount ?? 0);
    const assignmentCount = Number(utilizationRow[0]?.assignmentCount ?? 0);
    const sessionCount = Number(utilizationRow[0]?.sessionCount ?? 0);
    const computerUtilization =
      sessionCount > 0
        ? Math.min(1, Math.round((assignmentCount / (sessionCount * 2)) * 100) / 100)
        : 0;

    return {
      attendanceConsistency: Math.round(presentRate * 100) / 100,
      participationRate: Math.round(presentRate * 100) / 100,
      computerUtilization: Math.round(computerUtilization * 100) / 100,
      interactionPatterns:
        recordCount > 0
          ? Math.round((presentRate * 0.9 + computerUtilization * 0.1) * 100) / 100
          : 0,
    };
  }

  private async generatePredictiveInsights(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const conditions = [];
    if (facultyId) conditions.push(eq(schedules.facultyId, facultyId));
    if (startDate) conditions.push(gte(classSessions.date, startDate));
    if (endDate) conditions.push(lte(classSessions.date, endDate));
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rateByHour = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${schedules.startTime}::time)`,
        rate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1.0 ELSE 0.0 END)`,
        count: count(attendanceRecords.id),
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .where(whereClause)
      .groupBy(sql`EXTRACT(HOUR FROM ${schedules.startTime}::time)`);

    const insights: any[] = [];
    if (rateByHour.length >= 2) {
      const sorted = [...rateByHour].sort(
        (a, b) => Number(b.rate) - Number(a.rate)
      );
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const bestRate = Number(best?.rate ?? 0);
      const worstRate = Number(worst?.rate ?? 0);
      const diff = bestRate - worstRate;
      if (diff > 0.05) {
        insights.push({
          type: "attendance",
          title: "Session time preference",
          description: `Attendance is ${Math.round(diff * 100)}% higher in ${Number(best?.hour ?? 0)}:00 sessions vs ${Number(worst?.hour ?? 0)}:00`,
          confidence: Math.min(0.9, 0.5 + diff),
          recommendation: "Schedule important sessions at higher-attendance times",
        });
      }
    }

    const overallRate = await db
      .select({
        rate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1.0 ELSE 0.0 END)`,
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(whereClause);
    const avgRate = Number(overallRate[0]?.rate ?? 0);
    if (avgRate < 0.8 && avgRate > 0) {
      insights.push({
        type: "performance",
        title: "Attendance below 80%",
        description: `Current attendance rate is ${Math.round(avgRate * 100)}%. Consider follow-up or makeup sessions.`,
        confidence: 0.85,
        recommendation: "Consider rescheduling or providing makeup sessions",
      });
    }

    if (insights.length === 0 && rateByHour.length > 0) {
      insights.push({
        type: "engagement",
        title: "Engagement data available",
        description: "Run AI seating optimization to get recommendations.",
        confidence: 0.7,
        recommendation: "Run AI seating optimization for next session",
      });
    }
    return insights;
  }

  private async predictAttendancePatterns(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const conditions = [];
    if (facultyId) conditions.push(eq(schedules.facultyId, facultyId));
    if (startDate) conditions.push(gte(classSessions.date, startDate));
    if (endDate) conditions.push(lte(classSessions.date, endDate));
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rateResult = await db
      .select({
        rate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1.0 ELSE 0.0 END)`,
        total: count(attendanceRecords.id),
      })
      .from(attendanceRecords)
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .where(whereClause);

    const rate = Number(rateResult[0]?.rate ?? 0);
    const total = Number(rateResult[0]?.total ?? 0);
    let overallTrend: "stable" | "improving" | "declining" = "stable";
    if (total > 10 && rate >= 0.85) overallTrend = "improving";
    else if (total > 10 && rate < 0.7) overallTrend = "declining";

    return {
      predictions: [],
      trends: {
        overallTrend,
        seasonalPatterns: [],
        riskFactors: total === 0 ? ["No attendance data in range"] : [],
      },
    };
  }

  private async detectAttendanceAnomalies(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const conditions = [];
    if (facultyId) conditions.push(eq(schedules.facultyId, facultyId));
    if (startDate) conditions.push(gte(classSessions.date, startDate));
    if (endDate) conditions.push(lte(classSessions.date, endDate));
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const sessionRates = await db
      .select({
        sessionId: classSessions.id,
        rate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1.0 ELSE 0.0 END)`,
        count: count(attendanceRecords.id),
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .leftJoin(
        attendanceRecords,
        eq(attendanceRecords.classSessionId, classSessions.id),
      )
      .where(whereClause)
      .groupBy(classSessions.id);

    const rates = sessionRates
      .filter((r) => Number(r.count) > 0)
      .map((r) => Number(r.rate));
    const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const variance =
      rates.length > 1
        ? rates.reduce((s, r) => s + (r - avg) ** 2, 0) / (rates.length - 1)
        : 0;
    const anomalies = rates.filter((r) => Math.abs(r - avg) > Math.sqrt(variance) + 0.2);

    return {
      anomalies: anomalies.map((_, i) => ({
        sessionIndex: i,
        deviation: "low",
      })),
      patterns: {
        identified: rates.length > 0 ? ["Session-level variance computed"] : [],
        confidence: rates.length > 5 ? Math.min(0.8, 0.5 + variance * 2) : 0,
        impact: anomalies.length > 0 ? "low" : "none",
      },
    };
  }

  private generatePerformanceInsights(data: any[]): any[] {
    if (!data?.length) return [];
    const withRates = data.filter(
      (r: any) => r.attendanceCount != null && r.totalStudents > 0
    );
    if (withRates.length === 0) return [];
    const rates = withRates.map(
      (r: any) => Number(r.attendanceCount) / Number(r.totalStudents)
    );
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const insights: any[] = [];
    if (avg >= 0.85) {
      insights.push({
        type: "trend",
        message: `Average session attendance is ${Math.round(avg * 100)}%`,
        impact: "positive",
      });
    } else if (avg < 0.7 && avg > 0) {
      insights.push({
        type: "alert",
        message: `Session attendance is ${Math.round(avg * 100)}%. Consider follow-up.`,
        impact: "negative",
      });
    }
    return insights;
  }

  private generateAttendanceRecommendations(patterns: any[]): any[] {
    if (!patterns?.length) return [];
    const byRate = [...patterns].sort(
      (a: any, b: any) => Number(b.attendanceRate) - Number(a.attendanceRate)
    );
    const recs: string[] = [];
    if (byRate.length > 0 && Number(byRate[0].attendanceRate) > 0.8) {
      recs.push(
        `Best attendance in subject ${(byRate[0] as any).subject} (${Math.round(Number(byRate[0].attendanceRate) * 100)}%)`
      );
    }
    if (recs.length === 0) {
      recs.push("Schedule complex subjects in morning sessions");
    }
    return recs;
  }

  private generateSeatingOptimization(data: any[]): any[] {
    if (!data?.length) return [];
    const withPerf = data.filter(
      (r: any) => r.studentPerformance != null && r.sessionCount > 0
    );
    if (withPerf.length === 0) return [];
    const avgPerf =
      withPerf.reduce((s, r) => s + Number(r.studentPerformance), 0) /
      withPerf.length;
    return [
      `Average seating effectiveness is ${Math.round(avgPerf * 100)}%`,
      "Run AI seating optimization for session-specific recommendations",
    ];
  }
}

export const learningAnalyticsService = new LearningAnalyticsService();
