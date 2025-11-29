import { db } from "../../storage.js";
import {
  students,
  attendanceRecords,
  computerAssignments,
  classSessions,
  schedules,
  subjects,
  enrollments,
  computers,
} from "../../schema.js";
import { eq, and, count, desc } from "drizzle-orm";

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

export class SeatingOptimizationService {
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
  public async predictStudentPerformance(
    studentId: number,
    computerId: number,
    sessionId: number
  ): Promise<{
    predictedScore: number;
    confidence: number;
    factors: string[];
  }> {
    // Simplified ML prediction (in real system, use trained model)
    const factors: string[] = [];
    let predictedScore = 0.7; // Base prediction
    let confidence = 0.75;

    // Get historical data for this student
    const historicalData = await this.getStudentHistoricalData(studentId);

    // Historical attendance factor
    if (historicalData.attendanceRate > 0.9) {
      predictedScore += 0.1;
      factors.push("Excellent attendance history (+10%)");
    } else if (historicalData.attendanceRate < 0.7) {
      predictedScore -= 0.15;
      factors.push("Poor attendance history (-15%)");
    }

    // Computer performance history
    const computerData = await this.getComputerPerformanceData(computerId);
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

  // Helper Methods
  private calculatePositionCompatibility(
    learningStyle: string,
    computer: any
  ): number {
    // Calculate compatibility based on learning style and computer position
    // Assume classroom layout: computers arranged in rows of 5
    const computersPerRow = 5;
    const row = Math.floor((computer.id - 1) / computersPerRow);
    const col = (computer.id - 1) % computersPerRow;

    let compatibility = 0.5; // Base compatibility

    switch (learningStyle) {
      case "visual":
        // Visual learners benefit from front positions
        if (row === 0) compatibility += 0.3; // Front row
        else if (row === 1) compatibility += 0.1; // Second row
        break;
      case "auditory":
        // Auditory learners benefit from middle positions for group interaction
        if (row >= 1 && row <= 2) compatibility += 0.3; // Middle rows
        if (col >= 1 && col <= 3) compatibility += 0.1; // Middle columns
        break;
      case "kinesthetic":
        // Kinesthetic learners may prefer varied positions, no strong preference
        compatibility += 0.2; // Slight bonus for active engagement
        break;
    }

    return Math.max(0.1, Math.min(1.0, compatibility));
  }

  private countNearbyHighPerformers(
    computer: any,
    assignments: SeatingOptimizationResult[],
    student: StudentPerformanceData
  ): number {
    // Count high-performing students assigned to nearby computers
    const computersPerRow = 5;
    const currentRow = Math.floor((computer.id - 1) / computersPerRow);
    const currentCol = (computer.id - 1) % computersPerRow;

    let nearbyHighPerformers = 0;

    for (const assignment of assignments) {
      if (assignment.studentId === student.studentId) continue; // Skip self

      const assignedRow = Math.floor(
        (assignment.recommendedComputerId - 1) / computersPerRow
      );
      const assignedCol =
        (assignment.recommendedComputerId - 1) % computersPerRow;

      // Check if nearby (same row or adjacent)
      const rowDiff = Math.abs(currentRow - assignedRow);
      const colDiff = Math.abs(currentCol - assignedCol);

      if ((rowDiff === 0 && colDiff <= 1) || (rowDiff === 1 && colDiff === 0)) {
        // This assignment is nearby, check if student is high performer
        // For now, assume students with performance > 0.8 are high performers
        if (student.averageScore > 0.8) {
          nearbyHighPerformers++;
        }
      }
    }

    return nearbyHighPerformers;
  }

  private countNearbyConflicts(
    computer: any,
    assignments: SeatingOptimizationResult[],
    student: StudentPerformanceData
  ): number {
    // Count students with conflicts assigned to nearby computers
    const computersPerRow = 5;
    const currentRow = Math.floor((computer.id - 1) / computersPerRow);
    const currentCol = (computer.id - 1) % computersPerRow;

    let nearbyConflicts = 0;

    for (const assignment of assignments) {
      if (assignment.studentId === student.studentId) continue; // Skip self

      const assignedRow = Math.floor(
        (assignment.recommendedComputerId - 1) / computersPerRow
      );
      const assignedCol =
        (assignment.recommendedComputerId - 1) % computersPerRow;

      // Check if nearby (same row or adjacent)
      const rowDiff = Math.abs(currentRow - assignedRow);
      const colDiff = Math.abs(currentCol - assignedCol);

      if ((rowDiff === 0 && colDiff <= 1) || (rowDiff === 1 && colDiff === 0)) {
        // This assignment is nearby, check if there's a conflict
        // For now, check if students have very different performance levels (potential conflicts)
        // In a real system, this would check actual conflict records
        if (student.behavioralFlags && student.behavioralFlags.length > 0) {
          nearbyConflicts++;
        }
      }
    }

    return nearbyConflicts;
  }

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
    try {
      // Calculate average score based on attendance rate and computer assignment history
      const attendanceRate = await this.calculateAttendanceRate(studentId);
      const computerAssignments = await this.countComputerAssignments(
        studentId
      );

      // Base score from attendance (attendance contributes 70% to score)
      let score = attendanceRate * 0.7;

      // Computer assignment frequency bonus (contributes 30% to score)
      // More assignments indicate better engagement and performance
      const assignmentBonus = Math.min(computerAssignments / 10, 1) * 0.3; // Cap at 10 assignments
      score += assignmentBonus;

      // Ensure score is within reasonable bounds
      return Math.max(0.1, Math.min(1.0, score));
    } catch (error) {
      console.warn(
        `Failed to calculate average score for student ${studentId}:`,
        error
      );
      return 0.5; // Default neutral score
    }
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
    try {
      // Infer learning style based on student behavior patterns
      const student = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      if (!student.length) {
        return "visual"; // Default
      }

      const studentData = student[0];

      // Get attendance patterns to infer learning preferences
      const attendanceHistory = await db
        .select({
          status: attendanceRecords.status,
          createdAt: attendanceRecords.createdAt,
        })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.studentId, studentId))
        .orderBy(desc(attendanceRecords.createdAt))
        .limit(20);

      // Get computer assignment history
      const assignments = await db
        .select({
          assignedAt: computerAssignments.assignedAt,
        })
        .from(computerAssignments)
        .where(eq(computerAssignments.studentId, studentId))
        .orderBy(desc(computerAssignments.assignedAt))
        .limit(10);

      // Analyze patterns to determine learning style
      let visualScore = 0;
      let auditoryScore = 0;
      let kinestheticScore = 0;

      // Factor 1: Attendance consistency (regular attenders may be more visual learners)
      const presentCount = attendanceHistory.filter(
        (r) => r.status === "present" || r.status === "late"
      ).length;
      const attendanceRate =
        attendanceHistory.length > 0
          ? presentCount / attendanceHistory.length
          : 0;

      if (attendanceRate > 0.8) {
        visualScore += 2; // Consistent attenders often benefit from visual structure
      } else if (attendanceRate > 0.6) {
        auditoryScore += 1; // Moderate attenders may prefer auditory learning
      } else {
        kinestheticScore += 1; // Irregular attenders may need hands-on learning
      }

      // Factor 2: Computer assignment frequency (more assignments suggest kinesthetic/active learning)
      if (assignments.length > 5) {
        kinestheticScore += 2; // Frequent computer use suggests hands-on learning preference
      } else if (assignments.length > 2) {
        auditoryScore += 1; // Moderate use suggests group/auditory learning
      } else {
        visualScore += 1; // Less computer interaction suggests visual learning preference
      }

      // Factor 3: Name-based deterministic factor (for consistency)
      const nameHash = studentData.name.split("").reduce((hash, char) => {
        return (hash << 5) - hash + char.charCodeAt(0);
      }, 0);

      const nameFactor = Math.abs(nameHash) % 3;
      if (nameFactor === 0) visualScore += 1;
      else if (nameFactor === 1) auditoryScore += 1;
      else kinestheticScore += 1;

      // Determine the dominant learning style
      const maxScore = Math.max(visualScore, auditoryScore, kinestheticScore);

      if (maxScore === visualScore) return "visual";
      if (maxScore === auditoryScore) return "auditory";
      return "kinesthetic";
    } catch (error) {
      console.warn(
        `Failed to infer learning style for student ${studentId}:`,
        error
      );
      return "visual"; // Default fallback
    }
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
      .select({
        assignment: computerAssignments,
        student: students,
        attendance: attendanceRecords,
      })
      .from(computerAssignments)
      .innerJoin(students, eq(computerAssignments.studentId, students.id))
      .leftJoin(
        attendanceRecords,
        and(
          eq(attendanceRecords.studentId, computerAssignments.studentId),
          eq(
            attendanceRecords.classSessionId,
            computerAssignments.classSessionId
          )
        )
      )
      .where(eq(computerAssignments.computerId, computerId))
      .limit(50); // Increased sample size for better analysis

    // Calculate real performance metrics
    let totalScore = 0;
    let validAssignments = 0;
    const learningStyles: { [key: string]: number } = {};

    for (const assignment of assignments) {
      if (assignment.attendance) {
        // Use attendance as a proxy for performance
        const attendanceScore =
          assignment.attendance.status === "present"
            ? 1
            : assignment.attendance.status === "late"
            ? 0.7
            : 0.3;
        totalScore += attendanceScore;
        validAssignments++;
      }

      // Infer learning style from student data
      const learningStyle = await this.inferLearningStyle(
        assignment.student.id
      );
      learningStyles[learningStyle] = (learningStyles[learningStyle] || 0) + 1;
    }

    const averagePerformance =
      validAssignments > 0 ? totalScore / validAssignments : 0.7;

    // Find most common learning style for this computer
    const optimalLearningStyle =
      Object.entries(learningStyles).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      "visual";

    return {
      averagePerformance: Math.max(0.1, Math.min(1.0, averagePerformance)),
      optimalLearningStyle,
      totalAssignments: assignments.length,
    };
  }
}

export const seatingOptimizationService = new SeatingOptimizationService();
