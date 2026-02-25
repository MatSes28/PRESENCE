import db from "../../storage.js";
import {
  classSessions,
  schedules,
  enrollments,
  students,
  computers,
  computerAssignments,
} from "../../schema.js";
import { eq, and } from "drizzle-orm";

export interface ConflictDetectionResult {
  detectedConflicts: any[];
  resolutions: any[];
  confidence: number;
}

export class ConflictDetectionService {
  // Automated Conflict Detection and Resolution
  async detectAndResolveConflicts(
    sessionId: number
  ): Promise<ConflictDetectionResult> {
    try {
      // This would be implemented with actual session data retrieval
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

      const dataQuality =
        sessionData.availableComputers?.length > 0 && assignments.length > 0
          ? 1
          : sessionData.enrolledStudents?.length > 0
            ? 0.6
            : 0.3;
      const conflictFactor = Math.min(detectedConflicts.length * 0.05, 0.3);
      const confidence = Math.min(0.95, Math.max(0.5, dataQuality - conflictFactor));

      return {
        detectedConflicts,
        resolutions,
        confidence,
      };
    } catch (error) {
      console.error("Conflict resolution error:", error);
      throw error;
    }
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

  private getNearbyAssignments(assignment: any, allAssignments: any[]): any[] {
    // Simplified proximity logic
    return allAssignments.filter((a) => a.id !== assignment.id).slice(0, 4);
  }

  private hasLearningStyleConflict(student1: any, student2: any): boolean {
    // Check if learning styles conflict (opposite styles may not work well together)
    const conflictPairs = [
      ["visual", "kinesthetic"], // Visual learners prefer quiet, kinesthetic need movement
      ["auditory", "visual"], // May compete for different types of focus
    ];

    const style1 = student1.learningStyle || "visual";
    const style2 = student2.learningStyle || "visual";

    return conflictPairs.some(
      ([a, b]) =>
        (style1 === a && style2 === b) || (style1 === b && style2 === a)
    );
  }

  private hasPerformanceGapConflict(student1: any, student2: any): boolean {
    // Simplified performance gap detection
    return (
      Math.abs((student1.performance || 0) - (student2.performance || 0)) > 1.0
    );
  }

  private hasBehavioralConflict(student1: any, student2: any): boolean {
    // Check for behavioral conflicts based on flags and performance patterns
    const flags1 = student1.behavioralFlags || [];
    const flags2 = student2.behavioralFlags || [];

    // If either student has behavioral flags, there's potential for conflict
    if (flags1.length > 0 || flags2.length > 0) {
      return true;
    }

    // Check for extreme performance differences (may indicate behavioral issues)
    const perf1 = student1.performance || student1.averageScore || 0;
    const perf2 = student2.performance || student2.averageScore || 0;

    // Large performance gaps might indicate different behavioral patterns
    return Math.abs(perf1 - perf2) > 1.5;
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

  private async getSessionData(sessionId: number): Promise<any> {
    const session = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .limit(1);
    if (!session.length) {
      return { availableComputers: [], enrolledStudents: [] };
    }
    const sched = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, session[0].scheduleId))
      .limit(1);
    if (!sched.length) {
      return { availableComputers: [], enrolledStudents: [] };
    }
    const classroomId = sched[0].classroomId;
    const availableComputers = await db
      .select({ id: computers.id, name: computers.name, classroomId: computers.classroomId })
      .from(computers)
      .where(eq(computers.classroomId, classroomId));
    const enrolled = await db
      .select({
        studentId: enrollments.studentId,
        name: students.name,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.subjectId, sched[0].subjectId),
          eq(enrollments.semester, sched[0].semester),
          eq(enrollments.academicYear, sched[0].academicYear),
          eq(enrollments.isActive, true)
        )
      );
    return {
      availableComputers,
      enrolledStudents: enrolled.map((r) => ({ id: r.studentId, name: r.name })),
    };
  }

  private async getCurrentAssignments(sessionId: number): Promise<any[]> {
    const rows = await db
      .select({
        id: computerAssignments.id,
        computerId: computerAssignments.computerId,
        studentId: computerAssignments.studentId,
        studentName: students.name,
      })
      .from(computerAssignments)
      .innerJoin(students, eq(computerAssignments.studentId, students.id))
      .where(
        and(
          eq(computerAssignments.classSessionId, sessionId),
          eq(computerAssignments.isActive, true)
        )
      );
    return rows.map((r) => ({
      id: r.id,
      computerId: r.computerId,
      student: { id: r.studentId, name: r.studentName },
    }));
  }
}

export const conflictDetectionService = new ConflictDetectionService();
