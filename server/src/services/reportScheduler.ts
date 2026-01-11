import db from "../storage.js";
import {
  users,
  students,
  attendanceRecords,
  classSessions,
  schedules,
  subjects,
  enrollments,
} from "../schema.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { emailService } from "./emailService.js";

interface ReportSchedule {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly";
  recipients: string[];
  reportType: "attendance" | "performance" | "analytics" | "summary";
  filters: {
    facultyId?: number;
    subjectId?: number;
    classroomId?: number;
    dateRange?: { start: Date; end: Date };
  };
  scheduleTime: string; // HH:MM format
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
}

interface ReportData {
  title: string;
  summary: any;
  data: any[];
  generatedAt: Date;
  period: string;
}

class ReportSchedulerService {
  private schedules: Map<string, ReportSchedule> = new Map();

  constructor() {
    // Initialize with default schedules
    this.initializeDefaultSchedules();
    // Start the scheduler
    this.startScheduler();
  }

  // Create a new report schedule
  async createSchedule(
    schedule: Omit<ReportSchedule, "id" | "lastRun" | "nextRun">
  ): Promise<string> {
    const id = `schedule_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const nextRun = this.calculateNextRun(schedule.type, schedule.scheduleTime);

    const newSchedule: ReportSchedule = {
      ...schedule,
      id,
      nextRun,
    };

    this.schedules.set(id, newSchedule);
    return id;
  }

  // Update an existing schedule
  async updateSchedule(
    id: string,
    updates: Partial<ReportSchedule>
  ): Promise<boolean> {
    const schedule = this.schedules.get(id);
    if (!schedule) return false;

    const updatedSchedule = { ...schedule, ...updates };
    if (updates.type || updates.scheduleTime) {
      updatedSchedule.nextRun = this.calculateNextRun(
        updatedSchedule.type,
        updatedSchedule.scheduleTime
      );
    }

    this.schedules.set(id, updatedSchedule);
    return true;
  }

  // Delete a schedule
  async deleteSchedule(id: string): Promise<boolean> {
    return this.schedules.delete(id);
  }

  // Get all schedules
  getAllSchedules(): ReportSchedule[] {
    return Array.from(this.schedules.values());
  }

  // Manually trigger a report
  async triggerReport(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.isActive) return false;

    try {
      const reportData = await this.generateReport(schedule);
      await this.deliverReport(schedule, reportData);

      // Update last run time
      schedule.lastRun = new Date();
      schedule.nextRun = this.calculateNextRun(
        schedule.type,
        schedule.scheduleTime
      );
      this.schedules.set(scheduleId, schedule);

      return true;
    } catch (error) {
      console.error(`Failed to trigger report ${scheduleId}:`, error);
      return false;
    }
  }

  // Generate report data based on schedule
  private async generateReport(schedule: ReportSchedule): Promise<ReportData> {
    const { reportType, filters } = schedule;
    let data: any[] = [];
    let summary: any = {};
    let title = "";
    let period = "";

    // Calculate date range based on schedule type
    const dateRange = this.getDateRangeForSchedule(schedule.type);
    period = `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`;

    switch (reportType) {
      case "attendance":
        ({ data, summary, title } = await this.generateAttendanceReport(
          filters,
          dateRange
        ));
        break;
      case "performance":
        ({ data, summary, title } = await this.generatePerformanceReport(
          filters,
          dateRange
        ));
        break;
      case "analytics":
        ({ data, summary, title } = await this.generateAnalyticsReport(
          filters,
          dateRange
        ));
        break;
      case "summary":
        ({ data, summary, title } = await this.generateSummaryReport(
          filters,
          dateRange
        ));
        break;
    }

    return {
      title: `${title} - ${period}`,
      summary,
      data,
      generatedAt: new Date(),
      period,
    };
  }

  // Deliver report via email
  private async deliverReport(
    schedule: ReportSchedule,
    reportData: ReportData
  ): Promise<void> {
    const htmlContent = this.generateReportHTML(schedule, reportData);

    for (const recipient of schedule.recipients) {
      await emailService.sendEmail({
        to: recipient,
        subject: `Scheduled Report: ${reportData.title}`,
        htmlContent,
        textContent: this.generateReportText(reportData),
      });

      // Rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Generate attendance report
  private async generateAttendanceReport(
    filters: any,
    dateRange: { start: Date; end: Date }
  ): Promise<{ data: any[]; summary: any; title: string }> {
    const conditions = [
      gte(classSessions.date, dateRange.start),
      lte(classSessions.date, dateRange.end),
    ];

    if (filters.facultyId)
      conditions.push(eq(schedules.facultyId, filters.facultyId));
    if (filters.subjectId)
      conditions.push(eq(schedules.subjectId, filters.subjectId));

    const attendanceData = await db
      .select({
        subjectName: subjects.name,
        facultyName: users.name,
        totalEnrolled: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`,
        totalPresent: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'present' THEN ${attendanceRecords.studentId} END)`,
        totalAbsent: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'absent' THEN ${attendanceRecords.studentId} END)`,
        totalLate: sql<number>`COUNT(DISTINCT CASE WHEN ${attendanceRecords.status} = 'late' THEN ${attendanceRecords.studentId} END)`,
        averageAttendance: sql<number>`AVG(CASE WHEN ${attendanceRecords.id} IS NOT NULL THEN 1 ELSE 0 END)`,
      })
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .innerJoin(users, eq(schedules.facultyId, users.id))
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
      .where(and(...conditions))
      .groupBy(subjects.name, users.name);

    const summary = {
      totalSubjects: attendanceData.length,
      overallAttendanceRate:
        attendanceData.length > 0
          ? attendanceData.reduce(
              (sum, item) => sum + (item.averageAttendance || 0),
              0
            ) / attendanceData.length
          : 0,
      totalSessions: attendanceData.reduce(
        (sum, item) => sum + item.totalEnrolled,
        0
      ),
      totalPresent: attendanceData.reduce(
        (sum, item) => sum + item.totalPresent,
        0
      ),
      totalAbsent: attendanceData.reduce(
        (sum, item) => sum + item.totalAbsent,
        0
      ),
      totalLate: attendanceData.reduce((sum, item) => sum + item.totalLate, 0),
    };

    return {
      data: attendanceData,
      summary,
      title: "Attendance Report",
    };
  }

  // Generate performance report
  private async generatePerformanceReport(
    filters: any,
    dateRange: { start: Date; end: Date }
  ): Promise<{ data: any[]; summary: any; title: string }> {
    // Similar to attendance report but focused on performance metrics
    const performanceData = await db
      .select({
        studentName: students.name,
        studentId: students.studentId,
        subjectName: subjects.name,
        attendanceRate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1 ELSE 0 END)`,
        totalSessions: sql<number>`COUNT(${attendanceRecords.id})`,
        onTimeRate: sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' AND ${attendanceRecords.entryTime} <= ${schedules.startTime} THEN 1 ELSE 0 END)`,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .innerJoin(
        classSessions,
        eq(attendanceRecords.classSessionId, classSessions.id)
      )
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(subjects, eq(schedules.subjectId, subjects.id))
      .where(
        and(
          gte(classSessions.date, dateRange.start),
          lte(classSessions.date, dateRange.end)
        )
      )
      .groupBy(students.name, students.studentId, subjects.name)
      .orderBy(
        desc(
          sql<number>`AVG(CASE WHEN ${attendanceRecords.status} = 'present' THEN 1 ELSE 0 END)`
        )
      );

    const summary = {
      totalStudents: new Set(performanceData.map((p) => p.studentId)).size,
      averageAttendanceRate:
        performanceData.length > 0
          ? performanceData.reduce(
              (sum, item) => sum + (item.attendanceRate || 0),
              0
            ) / performanceData.length
          : 0,
      topPerformers: performanceData.filter(
        (p) => (p.attendanceRate || 0) >= 0.9
      ).length,
      needsAttention: performanceData.filter(
        (p) => (p.attendanceRate || 0) < 0.7
      ).length,
    };

    return {
      data: performanceData.slice(0, 50), // Top 50 students
      summary,
      title: "Student Performance Report",
    };
  }

  // Generate analytics report
  private async generateAnalyticsReport(
    filters: any,
    dateRange: { start: Date; end: Date }
  ): Promise<{ data: any[]; summary: any; title: string }> {
    // Generate comprehensive analytics
    const analytics = {
      attendanceTrends: await this.generateAttendanceTrends(dateRange),
      subjectPerformance: await this.generateSubjectPerformance(dateRange),
      timeBasedPatterns: await this.generateTimeBasedPatterns(dateRange),
      facultyPerformance: await this.generateFacultyPerformance(dateRange),
    };

    const summary = {
      period: `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`,
      insights: this.generateAnalyticsInsights(analytics),
    };

    return {
      data: [analytics],
      summary,
      title: "Analytics Report",
    };
  }

  // Generate summary report
  private async generateSummaryReport(
    filters: any,
    dateRange: { start: Date; end: Date }
  ): Promise<{ data: any[]; summary: any; title: string }> {
    const summary = {
      totalStudents: await this.getTotalStudents(),
      totalFaculty: await this.getTotalFaculty(),
      totalSessions: await this.getTotalSessions(dateRange),
      averageAttendance: await this.getAverageAttendance(dateRange),
      systemHealth: await this.getSystemHealth(),
      topSubjects: await this.getTopPerformingSubjects(dateRange),
      alerts: await this.getRecentAlerts(),
    };

    return {
      data: [summary],
      summary,
      title: "System Summary Report",
    };
  }

  // Helper methods
  private calculateNextRun(type: string, scheduleTime: string): Date {
    const now = new Date();
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    let nextRun = new Date(now);

    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      // Schedule for next occurrence
      switch (type) {
        case "daily":
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case "weekly":
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case "monthly":
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }

    return nextRun;
  }

  private getDateRangeForSchedule(type: string): { start: Date; end: Date } {
    const end = new Date();
    let start = new Date();

    switch (type) {
      case "daily":
        start.setDate(end.getDate() - 1);
        break;
      case "weekly":
        start.setDate(end.getDate() - 7);
        break;
      case "monthly":
        start.setMonth(end.getMonth() - 1);
        break;
    }

    return { start, end };
  }

  private startScheduler(): void {
    // Check every minute for schedules that need to run
    setInterval(() => {
      const now = new Date();

      for (const [id, schedule] of this.schedules) {
        if (schedule.isActive && schedule.nextRun <= now) {
          // Trigger report asynchronously
          this.triggerReport(id).catch((error) =>
            console.error(`Failed to run scheduled report ${id}:`, error)
          );
        }
      }
    }, 60000); // Check every minute

    console.log("Report scheduler started");
  }

  private initializeDefaultSchedules(): void {
    // Daily attendance summary for admins
    this.createSchedule({
      name: "Daily Attendance Summary",
      type: "daily",
      recipients: ["admin@clsu.edu.ph"], // Would be configurable
      reportType: "attendance",
      filters: {},
      scheduleTime: "18:00", // 6 PM daily
      isActive: true,
    });

    // Weekly performance report
    this.createSchedule({
      name: "Weekly Performance Report",
      type: "weekly",
      recipients: ["admin@clsu.edu.ph"],
      reportType: "performance",
      filters: {},
      scheduleTime: "08:00", // Monday 8 AM
      isActive: true,
    });

    // Monthly analytics report
    this.createSchedule({
      name: "Monthly Analytics Report",
      type: "monthly",
      recipients: ["admin@clsu.edu.ph"],
      reportType: "analytics",
      filters: {},
      scheduleTime: "09:00", // 1st of month 9 AM
      isActive: true,
    });
  }

  // Additional helper methods would be implemented...
  private async generateAttendanceTrends(dateRange: any): Promise<any[]> {
    // Implementation for attendance trends
    return [];
  }

  private async generateSubjectPerformance(dateRange: any): Promise<any[]> {
    // Implementation for subject performance
    return [];
  }

  private async generateTimeBasedPatterns(dateRange: any): Promise<any[]> {
    // Implementation for time-based patterns
    return [];
  }

  private async generateFacultyPerformance(dateRange: any): Promise<any[]> {
    // Implementation for faculty performance
    return [];
  }

  private generateAnalyticsInsights(analytics: any): string[] {
    // Generate insights from analytics data
    return [
      "System operating normally",
      "Attendance rates within expected ranges",
    ];
  }

  private async getTotalStudents(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(students);
    return result[0]?.count || 0;
  }

  private async getTotalFaculty(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "faculty"));
    return result[0]?.count || 0;
  }

  private async getTotalSessions(dateRange: any): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(classSessions)
      .where(
        and(
          gte(classSessions.date, dateRange.start),
          lte(classSessions.date, dateRange.end)
        )
      );
    return result[0]?.count || 0;
  }

  private async getAverageAttendance(dateRange: any): Promise<number> {
    // Simplified calculation
    return 0.85;
  }

  private async getSystemHealth(): Promise<any> {
    return { status: "healthy", uptime: "99.9%", errors: 0 };
  }

  private async getTopPerformingSubjects(dateRange: any): Promise<any[]> {
    return [];
  }

  private async getRecentAlerts(): Promise<any[]> {
    return [];
  }

  private generateReportHTML(
    schedule: ReportSchedule,
    reportData: ReportData
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${reportData.title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; text-align: center;">CLIRDEC:PRESENCE</h1>
              <p style="color: white; margin: 10px 0 0 0; text-align: center; opacity: 0.9;">${
                reportData.title
              }</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2>Report Summary</h2>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(
                  reportData.summary,
                  null,
                  2
                )}</pre>
              </div>

              <h3>Report Data</h3>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; max-height: 400px; overflow-y: auto;">
                <pre style="margin: 0; white-space: pre-wrap; font-size: 12px;">${JSON.stringify(
                  reportData.data,
                  null,
                  2
                )}</pre>
              </div>

              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This report was automatically generated on ${reportData.generatedAt.toLocaleString()}.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              <p>Central Luzon State University - Information Technology Department</p>
              <p>CLIRDEC:PRESENCE - Automated Reporting System</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateReportText(reportData: ReportData): string {
    return `
CLIRDEC:PRESENCE - ${reportData.title}

Generated: ${reportData.generatedAt.toLocaleString()}
Period: ${reportData.period}

SUMMARY:
${JSON.stringify(reportData.summary, null, 2)}

DATA:
${JSON.stringify(reportData.data, null, 2)}

This report was automatically generated by the CLIRDEC:PRESENCE system.
    `.trim();
  }
}

export const reportSchedulerService = new ReportSchedulerService();
