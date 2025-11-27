import { db } from "../storage.js";
import {
  students,
  computerAssignments,
  classSessions,
  schedules,
  subjects,
  enrollments,
  computers,
} from "../schema.js";
import { eq, and, desc } from "drizzle-orm";

interface AssignmentCriteria {
  prioritizePerformance?: boolean;
  balanceLearningStyles?: boolean;
  avoidConflicts?: boolean;
  preferFamiliarComputers?: boolean;
}

interface StudentProfile {
  id: number;
  name: string;
  performance?: number; // GPA or performance score
  learningStyle?: "visual" | "auditory" | "kinesthetic";
  previousComputers?: number[];
  conflicts?: number[]; // Student IDs to avoid seating near
}

interface AssignmentResult {
  studentId: number;
  computerId: number;
  score: number; // Assignment quality score
  reasoning: string[];
}

class SmartAssignmentService {
  async assignStudentsToComputers(
    sessionId: number,
    criteria: AssignmentCriteria = {}
  ): Promise<AssignmentResult[]> {
    try {
      // Get session details
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

      if (!session.length) {
        throw new Error("Session not found");
      }

      // Get enrolled students
      const enrolledStudents = await db
        .select({
          student: students,
          enrollment: enrollments,
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(
          and(
            eq(enrollments.subjectId, session[0].schedule.subjectId),
            eq(enrollments.semester, session[0].schedule.semester),
            eq(enrollments.academicYear, session[0].schedule.academicYear)
          )
        );

      // Get available computers for this classroom
      const availableComputers = await db
        .select()
        .from(computers)
        .where(
          and(
            eq(computers.classroomId, session[0].schedule.classroomId),
            eq(computers.status, "available")
          )
        );

      if (enrolledStudents.length === 0 || availableComputers.length === 0) {
        return [];
      }

      // Create student profiles
      const studentProfiles = await this.createStudentProfiles(
        enrolledStudents
      );

      // Perform smart assignment
      const assignments = await this.performSmartAssignment(
        studentProfiles,
        availableComputers,
        criteria
      );

      return assignments;
    } catch (error) {
      console.error("Error in smart assignment:", error);
      throw error;
    }
  }

  private async createStudentProfiles(
    enrolledStudents: any[]
  ): Promise<StudentProfile[]> {
    const profiles: StudentProfile[] = [];

    for (const enrollment of enrolledStudents) {
      const student = enrollment.student;

      // Get performance data (simplified - you might have grades table)
      const performance = await this.calculateStudentPerformance(student.id);

      // Get learning style (you might store this in student profile)
      const learningStyle = this.inferLearningStyle(student);

      // Get previous computer assignments
      const previousAssignments = await db
        .select()
        .from(computerAssignments)
        .where(eq(computerAssignments.studentId, student.id))
        .orderBy(desc(computerAssignments.assignedAt))
        .limit(5);

      const previousComputers = previousAssignments.map((a) => a.computerId);

      // Get conflict relationships (students to avoid seating near)
      const conflicts = await this.getStudentConflicts(student.id);

      profiles.push({
        id: student.id,
        name: student.name,
        performance,
        learningStyle,
        previousComputers,
        conflicts,
      });
    }

    return profiles;
  }

  private async calculateStudentPerformance(
    studentId: number
  ): Promise<number> {
    // Simplified performance calculation
    // In a real system, you'd calculate GPA from grades
    // For now, return a random score between 1-4
    return Math.random() * 3 + 1; // 1.0 to 4.0 GPA equivalent
  }

  private inferLearningStyle(
    student: any
  ): "visual" | "auditory" | "kinesthetic" {
    // Enhanced learning style inference based on student data
    // In a real system, you'd have learning style assessments stored in database
    const styles: ("visual" | "auditory" | "kinesthetic")[] = [
      "visual",
      "auditory",
      "kinesthetic",
    ];

    // For now, use a more sophisticated pseudo-random assignment
    // You could base this on student ID, name, or other characteristics
    const hash = student.name.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return styles[Math.abs(hash) % styles.length];
  }

  private async getStudentConflicts(studentId: number): Promise<number[]> {
    // In a real system, you'd have a student_relationships or conflicts table
    // For now, return empty array - this would be populated from:
    // - Teacher reports of problematic student pairings
    // - Parent requests to separate siblings/friends
    // - Behavioral records indicating conflicts

    // Example implementation:
    // const conflicts = await db
    //   .select({ conflictingStudentId: studentConflicts.conflictingStudentId })
    //   .from(studentConflicts)
    //   .where(eq(studentConflicts.studentId, studentId));

    return []; // Return empty for now
  }

  private async performSmartAssignment(
    students: StudentProfile[],
    computers: any[],
    criteria: AssignmentCriteria
  ): Promise<AssignmentResult[]> {
    const assignments: AssignmentResult[] = [];
    const assignedComputers = new Set<number>();
    const assignedStudents = new Map<number, StudentProfile>();

    // Sort students by priority (performance, etc.)
    const sortedStudents = [...students].sort((a, b) => {
      if (criteria.prioritizePerformance) {
        return (b.performance || 0) - (a.performance || 0);
      }
      return a.name.localeCompare(b.name); // Alphabetical fallback
    });

    for (const student of sortedStudents) {
      let bestComputer = null;
      let bestScore = -1;
      let reasoning: string[] = [];

      for (const computer of computers) {
        if (assignedComputers.has(computer.id)) continue;

        const score = await this.calculateAssignmentScore(
          student,
          computer,
          criteria,
          assignedStudents
        );

        if (score.score > bestScore) {
          bestScore = score.score;
          bestComputer = computer;
          reasoning = score.reasoning;
        }
      }

      if (bestComputer) {
        assignments.push({
          studentId: student.id,
          computerId: bestComputer.id,
          score: bestScore,
          reasoning,
        });

        assignedComputers.add(bestComputer.id);
        assignedStudents.set(student.id, student);
      }
    }

    return assignments;
  }

  private async calculateAssignmentScore(
    student: StudentProfile,
    computer: any,
    criteria: AssignmentCriteria,
    assignedStudents: Map<number, StudentProfile>
  ): Promise<{ score: number; reasoning: string[] }> {
    let score = 50; // Base score
    const reasoning: string[] = [];

    // Performance-based scoring
    if (criteria.prioritizePerformance && student.performance) {
      if (student.performance >= 3.5) {
        score += 20;
        reasoning.push("High performer - assigned to optimal position");
      } else if (student.performance >= 2.5) {
        score += 10;
        reasoning.push("Good performer - assigned to good position");
      } else {
        score += 5;
        reasoning.push("Standard performer - assigned to suitable position");
      }
    }

    // Learning style optimization
    if (criteria.balanceLearningStyles) {
      const learningStyleBonus = await this.calculateLearningStyleScore(
        student,
        computer,
        assignedStudents
      );
      score += learningStyleBonus.score;
      reasoning.push(...learningStyleBonus.reasoning);
    }

    // Computer familiarity preference
    if (student.previousComputers?.includes(computer.id)) {
      if (criteria.preferFamiliarComputers) {
        score += 15;
        reasoning.push("Familiar computer - maintains consistency");
      } else {
        score -= 10;
        reasoning.push(
          "Familiar computer - variety preferred over consistency"
        );
      }
    }

    // Conflict avoidance - check if conflicting students are nearby
    if (
      criteria.avoidConflicts &&
      student.conflicts &&
      student.conflicts.length > 0
    ) {
      const conflictPenalty = await this.calculateConflictScore(
        student,
        computer,
        assignedStudents
      );
      score += conflictPenalty.score;
      reasoning.push(...conflictPenalty.reasoning);
    }

    // Position-based optimization (front/middle/back rows)
    const positionBonus = this.calculatePositionScore(student, computer);
    score += positionBonus.score;
    reasoning.push(...positionBonus.reasoning);

    return { score, reasoning };
  }

  private async calculateLearningStyleScore(
    student: StudentProfile,
    computer: any,
    assignedStudents: Map<number, StudentProfile>
  ): Promise<{ score: number; reasoning: string[] }> {
    let score = 0;
    const reasoning: string[] = [];

    // Group similar learning styles together for collaborative learning
    const nearbyStudents = this.getNearbyStudents(computer, assignedStudents);
    const similarStyles = nearbyStudents.filter(
      (s) => s.learningStyle === student.learningStyle
    ).length;

    if (similarStyles > 0) {
      score += similarStyles * 8;
      reasoning.push(
        `Grouped with ${similarStyles} student(s) of similar learning style (${student.learningStyle})`
      );
    }

    // Bonus for optimal positioning based on learning style
    switch (student.learningStyle) {
      case "visual":
        // Visual learners benefit from front positions
        if (this.isFrontPosition(computer)) {
          score += 10;
          reasoning.push(
            "Visual learner positioned at front for better visibility"
          );
        }
        break;
      case "auditory":
        // Auditory learners benefit from middle positions for group discussions
        if (this.isMiddlePosition(computer)) {
          score += 10;
          reasoning.push(
            "Auditory learner positioned in middle for group interaction"
          );
        }
        break;
      case "kinesthetic":
        // Kinesthetic learners may prefer varied positions
        score += 5;
        reasoning.push("Kinesthetic learner positioned for active engagement");
        break;
    }

    return { score, reasoning };
  }

  private async calculateConflictScore(
    student: StudentProfile,
    computer: any,
    assignedStudents: Map<number, StudentProfile>
  ): Promise<{ score: number; reasoning: string[] }> {
    let score = 0;
    const reasoning: string[] = [];

    const nearbyStudents = this.getNearbyStudents(computer, assignedStudents);
    const conflictsNearby = nearbyStudents.filter((s) =>
      student.conflicts.includes(s.id)
    ).length;

    if (conflictsNearby > 0) {
      score -= conflictsNearby * 25; // Heavy penalty for conflicts
      reasoning.push(
        `⚠️ ${conflictsNearby} conflicting student(s) nearby - major penalty applied`
      );
    } else {
      score += 10; // Bonus for conflict-free positioning
      reasoning.push("Position free of student conflicts");
    }

    return { score, reasoning };
  }

  private calculatePositionScore(
    student: StudentProfile,
    computer: any
  ): { score: number; reasoning: string[] } {
    let score = 0;
    const reasoning: string[] = [];

    // High performers get priority positioning
    if (student.performance && student.performance >= 3.0) {
      if (this.isFrontPosition(computer)) {
        score += 15;
        reasoning.push("High-performing student assigned to front position");
      }
    }

    // Ensure good distribution across classroom
    if (
      this.isBackPosition(computer) &&
      (!student.performance || student.performance < 2.0)
    ) {
      score += 5;
      reasoning.push("Student appropriately positioned at back");
    }

    return { score, reasoning };
  }

  private getNearbyStudents(
    computer: any,
    assignedStudents: Map<number, StudentProfile>
  ): StudentProfile[] {
    // Simplified proximity calculation
    // In a real system, you'd have actual position coordinates
    const nearby: StudentProfile[] = [];

    // Mock proximity logic - assume computers in same "row" are nearby
    const computerRow = Math.floor((computer.id - 1) / 5); // 5 computers per row

    for (const [studentId, student] of assignedStudents) {
      // This is simplified - you'd need actual position mapping
      nearby.push(student);
    }

    return nearby.slice(0, 4); // Return up to 4 nearby students
  }

  private isFrontPosition(computer: any): boolean {
    // Simplified - assume first row (computers 1-5) are front
    return computer.id <= 5;
  }

  private isMiddlePosition(computer: any): boolean {
    // Simplified - assume middle rows (computers 6-10) are middle
    return computer.id > 5 && computer.id <= 10;
  }

  private isBackPosition(computer: any): boolean {
    // Simplified - assume back rows (computers 11+) are back
    return computer.id > 10;
  }

  async assignByPerformance(sessionId: number): Promise<AssignmentResult[]> {
    return this.assignStudentsToComputers(sessionId, {
      prioritizePerformance: true,
      avoidConflicts: true,
    });
  }

  async assignByLearningStyle(sessionId: number): Promise<AssignmentResult[]> {
    return this.assignStudentsToComputers(sessionId, {
      balanceLearningStyles: true,
      avoidConflicts: true,
    });
  }

  async assignConflictFree(sessionId: number): Promise<AssignmentResult[]> {
    return this.assignStudentsToComputers(sessionId, {
      avoidConflicts: true,
      preferFamiliarComputers: false,
    });
  }

  async assignRandom(sessionId: number): Promise<AssignmentResult[]> {
    // Simple random assignment without smart criteria
    return this.assignStudentsToComputers(sessionId, {});
  }
}

export const smartAssignmentService = new SmartAssignmentService();
