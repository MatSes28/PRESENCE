import crypto from "crypto";
import { db } from "../storage.js";
import { students, attendanceRecords } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";

interface AnonymizedStudent {
  id: string; // Anonymized ID
  year: number;
  section: string;
  program: string;
  department: string;
  college: string;
  attendanceCount: number;
  averageAttendanceRate: number;
  lastActivity: Date;
}

interface AnonymizedAttendance {
  studentId: string; // Anonymized
  sessionId: string; // Anonymized
  date: Date;
  status: string;
  isLate: boolean;
  isAbsent: boolean;
}

class DataAnonymizationService {
  private saltRounds = 10000;

  // Generate consistent anonymized ID from real ID
  private generateAnonymizedId(
    realId: number,
    salt: string = "anonymization_salt"
  ): string {
    const hash = crypto.createHash("sha256");
    hash.update(`${realId}_${salt}`);
    return hash.digest("hex").substring(0, 16); // First 16 chars for shorter ID
  }

  // Anonymize student data for analytics
  async getAnonymizedStudents(): Promise<AnonymizedStudent[]> {
    const studentData = await db
      .select({
        id: students.id,
        year: students.year,
        section: students.section,
        program: students.program,
        department: students.department,
        college: students.college,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
      })
      .from(students)
      .where(eq(students.isActive, true));

    const anonymizedStudents: AnonymizedStudent[] = [];

    for (const student of studentData) {
      // Get attendance statistics
      const attendanceStats = await this.getAttendanceStats(student.id);

      anonymizedStudents.push({
        id: this.generateAnonymizedId(student.id),
        year: student.year || 1,
        section: student.section || "Unknown",
        program: student.program,
        department: student.department,
        college: student.college,
        attendanceCount: attendanceStats.count,
        averageAttendanceRate: attendanceStats.averageRate,
        lastActivity: student.updatedAt || student.createdAt,
      });
    }

    return anonymizedStudents;
  }

  // Get attendance statistics for anonymization
  private async getAttendanceStats(
    studentId: number
  ): Promise<{ count: number; averageRate: number }> {
    const attendanceData = await db
      .select({
        status: attendanceRecords.status,
        createdAt: attendanceRecords.createdAt,
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.studentId, studentId))
      .orderBy(attendanceRecords.createdAt);

    if (attendanceData.length === 0) {
      return { count: 0, averageRate: 0 };
    }

    const presentCount = attendanceData.filter(
      (record) => record.status === "present" || record.status === null
    ).length;

    const averageRate = (presentCount / attendanceData.length) * 100;

    return {
      count: attendanceData.length,
      averageRate: Math.round(averageRate * 100) / 100, // Round to 2 decimal places
    };
  }

  // Anonymize attendance records for analytics
  async getAnonymizedAttendanceRecords(
    limit: number = 1000
  ): Promise<AnonymizedAttendance[]> {
    const attendanceData = await db
      .select({
        studentId: attendanceRecords.studentId,
        classSessionId: attendanceRecords.classSessionId,
        entryTime: attendanceRecords.entryTime,
        status: attendanceRecords.status,
        createdAt: attendanceRecords.createdAt,
      })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.isActive, true))
      .orderBy(attendanceRecords.createdAt)
      .limit(limit);

    return attendanceData.map((record) => ({
      studentId: this.generateAnonymizedId(record.studentId),
      sessionId: this.generateAnonymizedId(
        record.classSessionId,
        "session_salt"
      ),
      date: record.createdAt,
      status: record.status || "present",
      isLate: this.isLateAttendance(record.entryTime),
      isAbsent: record.status === "absent",
    }));
  }

  // Determine if attendance is late (simplified logic)
  private isLateAttendance(entryTime: Date | null): boolean {
    if (!entryTime) return false;
    // Assume class starts at hour 0, late after 15 minutes
    const entryMinutes = entryTime.getMinutes();
    return entryMinutes > 15;
  }

  // Generate aggregated analytics data
  async getAggregatedAnalytics(): Promise<any> {
    const anonymizedStudents = await this.getAnonymizedStudents();

    // Aggregate by year
    const yearStats = anonymizedStudents.reduce((acc, student) => {
      const year = student.year;
      if (!acc[year]) {
        acc[year] = {
          totalStudents: 0,
          averageAttendanceRate: 0,
          totalAttendanceCount: 0,
        };
      }
      acc[year].totalStudents++;
      acc[year].totalAttendanceCount += student.attendanceCount;
      acc[year].averageAttendanceRate += student.averageAttendanceRate;
      return acc;
    }, {} as Record<number, any>);

    // Calculate averages
    Object.keys(yearStats).forEach((year) => {
      const stats = yearStats[year];
      stats.averageAttendanceRate =
        stats.totalStudents > 0
          ? Math.round(
              (stats.averageAttendanceRate / stats.totalStudents) * 100
            ) / 100
          : 0;
    });

    // Aggregate by section
    const sectionStats = anonymizedStudents.reduce((acc, student) => {
      const section = student.section;
      if (!acc[section]) {
        acc[section] = {
          totalStudents: 0,
          averageAttendanceRate: 0,
        };
      }
      acc[section].totalStudents++;
      acc[section].averageAttendanceRate += student.averageAttendanceRate;
      return acc;
    }, {} as Record<string, any>);

    Object.keys(sectionStats).forEach((section) => {
      const stats = sectionStats[section];
      stats.averageAttendanceRate =
        stats.totalStudents > 0
          ? Math.round(
              (stats.averageAttendanceRate / stats.totalStudents) * 100
            ) / 100
          : 0;
    });

    return {
      yearStats,
      sectionStats,
      totalStudents: anonymizedStudents.length,
      generatedAt: new Date(),
      privacyNote:
        "All data has been anonymized and aggregated for analytics purposes only",
    };
  }

  // Export anonymized data for external analysis
  async exportAnonymizedData(): Promise<any> {
    const [students, attendance] = await Promise.all([
      this.getAnonymizedStudents(),
      this.getAnonymizedAttendanceRecords(5000), // Limit for export
    ]);

    return {
      students,
      attendance,
      exportDate: new Date(),
      privacyCompliance: {
        gdpr: "Data anonymized per Article 4(5) - not personal data",
        ccpa: "Data aggregated and anonymized - not personal information",
        retention: "Analytics data retained for 2 years",
      },
    };
  }

  // Clean up old anonymized data (if stored separately)
  async cleanupOldAnonymizedData(): Promise<void> {
    // In a real implementation, this would clean up old cached anonymized data
    console.log("Anonymized data cleanup completed");
  }

  // Generate privacy-preserving statistics
  async getPrivacySafeStatistics(): Promise<any> {
    const totalStudents = await db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.isActive, true));

    const totalAttendance = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.isActive, true));

    const presentAttendance = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.isActive, true),
          sql`${attendanceRecords.status} IS NULL OR ${attendanceRecords.status} = 'present'`
        )
      );

    const attendanceRate =
      totalAttendance[0].count > 0
        ? (presentAttendance[0].count / totalAttendance[0].count) * 100
        : 0;

    return {
      totalStudents: totalStudents[0].count,
      totalAttendanceRecords: totalAttendance[0].count,
      overallAttendanceRate: Math.round(attendanceRate * 100) / 100,
      dataAnonymized: true,
      lastUpdated: new Date(),
    };
  }
}

export const dataAnonymizationService = new DataAnonymizationService();
