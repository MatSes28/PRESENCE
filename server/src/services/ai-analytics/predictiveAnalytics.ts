import { db } from "../../storage.js";
import {
  classSessions,
  schedules,
  subjects,
  enrollments,
  attendanceRecords,
} from "../../schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface AttendancePrediction {
  date: string;
  predictedAttendance: number;
  confidence: number;
  factors: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface AttendanceTrends {
  overallTrend: "increasing" | "decreasing" | "stable";
  seasonalPatterns: any[];
  riskFactors: string[];
}

export interface AnomalyDetection {
  anomalies: Array<{
    type: "sudden_drop" | "unusual_pattern" | "student_specific" | "time_based";
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
}

export class PredictiveAnalyticsService {
  // Predictive Attendance Analytics
  async predictAttendancePatterns(
    facultyId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    predictions: AttendancePrediction[];
    trends: AttendanceTrends;
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
  ): Promise<AnomalyDetection> {
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

  private async generateAttendancePredictions(
    historicalData: any[]
  ): Promise<AttendancePrediction[]> {
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

  private async analyzeAttendanceTrends(
    historicalData: any[]
  ): Promise<AttendanceTrends> {
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

  private async identifyAnomalies(
    historicalData: any[]
  ): Promise<AnomalyDetection["anomalies"]> {
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

  private async analyzeAnomalyPatterns(
    anomalies: any[]
  ): Promise<AnomalyDetection["patterns"]> {
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

export const predictiveAnalyticsService = new PredictiveAnalyticsService();
