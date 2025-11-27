import { Router } from "express";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import { db } from "../storage.js";
import {
  computers,
  computerAssignments,
  computerMaintenance,
  students,
  users,
  schedules,
  classSessions,
  enrollments,
} from "../schema.js";
import {
  requireAuth,
  requireAdmin,
  requireAdminOrFaculty,
} from "../middleware/auth.js";
import { smartAssignmentService } from "../services/smartAssignment.js";

const router = Router();

// GET /api/computers - TEMPORARILY BYPASSING ROLE-BASED FILTERING FOR DEBUGGING
router.get("/", requireAuth, async (req, res) => {
  try {
    console.log(`[COMPUTERS] TEMPORARY DEBUG: Bypassing role-based filtering`);
    console.log(
      `[COMPUTERS] Session info:`,
      JSON.stringify(
        {
          userId: req.session?.userId,
          userRole: req.session?.userRole,
          hasSession: !!req.session,
        },
        null,
        2
      )
    );

    // TEMPORARY: Return all computers regardless of role
    const allComputers = await db.select().from(computers);
    console.log(`[COMPUTERS] Found ${allComputers.length} computers total`);
    console.log(`[COMPUTERS] Sample computer:`, allComputers[0]);

    res.json({ success: true, data: allComputers });
  } catch (error) {
    console.error("Error fetching computers:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: `Failed to fetch computers: ${error.message}`,
      stack: error.stack,
    });
  }
});

// GET /api/computers/assignments - Get all computer assignments with student names
router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const assignments = await db
      .select({
        id: computerAssignments.id,
        computerId: computerAssignments.computerId,
        studentId: computerAssignments.studentId,
        studentName: students.name,
        classSessionId: computerAssignments.classSessionId,
        status: computerAssignments.status,
        assignedAt: computerAssignments.assignedAt,
        releasedAt: computerAssignments.releasedAt,
        loginTime: computerAssignments.loginTime,
        logoutTime: computerAssignments.logoutTime,
        sessionDuration: computerAssignments.sessionDuration,
      })
      .from(computerAssignments)
      .leftJoin(students, eq(computerAssignments.studentId, students.id));

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch assignments" });
  }
});

// GET /api/computers/:id - Get computer by ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);
    if (isNaN(computerId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid computer ID" });
    }

    const computer = await db
      .select()
      .from(computers)
      .where(eq(computers.id, computerId))
      .limit(1);

    if (computer.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Computer not found" });
    }

    res.json({ success: true, data: computer[0] });
  } catch (error) {
    console.error("Error fetching computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch computer" });
  }
});

// POST /api/computers - Create new computer (admin or faculty)
router.post("/", requireAdminOrFaculty, async (req, res) => {
  try {
    const { classroomId, computerCount } = req.body;

    if (!classroomId) {
      return res.status(400).json({
        success: false,
        message: "Classroom ID is required",
      });
    }

    const count = parseInt(computerCount) || 1;
    if (count < 1 || count > 50) {
      return res.status(400).json({
        success: false,
        message: "Computer count must be between 1 and 50",
      });
    }

    // Get existing computers in this classroom to determine numbering
    const existingComputers = await db
      .select()
      .from(computers)
      .where(eq(computers.classroomId, classroomId));

    const maxNumber =
      existingComputers.length > 0
        ? Math.max(
            ...existingComputers.map((c) => {
              const match = c.name.match(/Computer (\d+)/);
              return match ? parseInt(match[1]) : 0;
            })
          )
        : 0;

    // Create multiple computers
    const newComputers = [];
    for (let i = 1; i <= count; i++) {
      const computerNumber = maxNumber + i;
      const computer = await db
        .insert(computers)
        .values({
          classroomId,
          name: `Computer ${computerNumber}`,
          status: "available",
        })
        .returning();
      newComputers.push(computer[0]);
    }

    res.status(201).json({
      success: true,
      data: newComputers,
      message: `Created ${count} computer(s) in classroom ${classroomId}`,
    });
  } catch (error) {
    console.error("Error creating computers:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create computers" });
  }
});

// PUT /api/computers/:id - Update computer (admin or faculty)
router.put("/:id", requireAdminOrFaculty, async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;
    const { name, ipAddress, macAddress, status } = req.body;

    // If faculty, check if they have access to this computer
    if (userRole === "faculty") {
      console.log(
        `[COMPUTER ASSIGN] Faculty access check for computerId=${computerId}, userId=${userId}`
      );
      const computerCheck = await db
        .select()
        .from(computers)
        .innerJoin(schedules, eq(computers.classroomId, schedules.classroomId))
        .where(
          and(eq(computers.id, computerId), eq(schedules.facultyId, userId))
        )
        .limit(1);

      console.log(
        `[COMPUTER ASSIGN] Faculty access check result: ${computerCheck.length} matching records`
      );
      if (computerCheck.length === 0) {
        console.log(
          `[COMPUTER ASSIGN] Access denied for faculty userId=${userId} to computerId=${computerId}`
        );
        return res.status(403).json({
          success: false,
          message: "Access denied to this computer",
        });
      }
    }

    const updatedComputer = await db
      .update(computers)
      .set({
        name,
        ipAddress,
        macAddress,
        status,
        updatedAt: new Date(),
      })
      .where(eq(computers.id, computerId))
      .returning();

    if (updatedComputer.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Computer not found" });
    }

    res.json({ success: true, data: updatedComputer[0] });
  } catch (error) {
    console.error("Error updating computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update computer" });
  }
});

// DELETE /api/computers/:id - Delete computer (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);

    await db.delete(computers).where(eq(computers.id, computerId));

    res.json({ success: true, message: "Computer deleted successfully" });
  } catch (error) {
    console.error("Error deleting computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete computer" });
  }
});

// GET /api/computers/assignments - Get all computer assignments with student names
router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const assignments = await db
      .select({
        id: computerAssignments.id,
        computerId: computerAssignments.computerId,
        studentId: computerAssignments.studentId,
        studentName: students.name,
        classSessionId: computerAssignments.classSessionId,
        status: computerAssignments.status,
        assignedAt: computerAssignments.assignedAt,
        releasedAt: computerAssignments.releasedAt,
        loginTime: computerAssignments.loginTime,
        logoutTime: computerAssignments.logoutTime,
        sessionDuration: computerAssignments.sessionDuration,
      })
      .from(computerAssignments)
      .leftJoin(students, eq(computerAssignments.studentId, students.id));

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch assignments" });
  }
});

// POST /api/computers/assign - Assign computer to student (admin or faculty)
router.post("/assign", requireAdminOrFaculty, async (req, res) => {
  try {
    const { computerId, studentId, classSessionId } = req.body;
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    console.log(
      `[COMPUTER ASSIGN] Attempting assignment: computerId=${computerId}, studentId=${studentId}, classSessionId=${classSessionId}, userRole=${userRole}, userId=${userId}`
    );

    if (!computerId || !studentId || !classSessionId) {
      console.log(
        `[COMPUTER ASSIGN] Missing required fields: computerId=${computerId}, studentId=${studentId}, classSessionId=${classSessionId}`
      );
      return res.status(400).json({
        success: false,
        message: "Computer ID, Student ID, and Class Session ID are required",
      });
    }

    // If faculty, check if they have access to this computer and class session
    if (userRole === "faculty") {
      console.log(
        `[COMPUTER ASSIGN] Faculty access check for computerId=${computerId}, classSessionId=${classSessionId}, userId=${userId}`
      );

      // Check if faculty teaches this specific class session
      const sessionCheck = await db
        .select()
        .from(classSessions)
        .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
        .where(
          and(
            eq(classSessions.id, classSessionId),
            eq(schedules.facultyId, userId)
          )
        )
        .limit(1);

      console.log(
        `[COMPUTER ASSIGN] Faculty session access check result: ${sessionCheck.length} matching records`
      );
      if (sessionCheck.length === 0) {
        console.log(
          `[COMPUTER ASSIGN] Access denied for faculty userId=${userId} to classSessionId=${classSessionId}`
        );
        return res.status(403).json({
          success: false,
          message: "Access denied: You do not teach this class session",
        });
      }
    }

    // Validate that student is enrolled in the subject of this class session
    console.log(
      `[COMPUTER ASSIGN] Checking student enrollment for studentId=${studentId}, classSessionId=${classSessionId}`
    );
    const enrollmentCheck = await db
      .select()
      .from(classSessions)
      .innerJoin(schedules, eq(classSessions.scheduleId, schedules.id))
      .innerJoin(
        enrollments,
        and(
          eq(enrollments.subjectId, schedules.subjectId),
          eq(enrollments.studentId, studentId)
        )
      )
      .where(eq(classSessions.id, classSessionId))
      .limit(1);

    console.log(
      `[COMPUTER ASSIGN] Student enrollment check result: ${enrollmentCheck.length} matching records`
    );
    if (enrollmentCheck.length === 0) {
      console.log(
        `[COMPUTER ASSIGN] Student ${studentId} is not enrolled in the subject for classSessionId=${classSessionId}`
      );
      return res.status(400).json({
        success: false,
        message: "Student is not enrolled in this class subject",
      });
    }

    // Check if computer is already assigned
    const existingAssignment = await db
      .select()
      .from(computerAssignments)
      .where(
        and(
          eq(computerAssignments.computerId, computerId),
          isNull(computerAssignments.releasedAt)
        )
      )
      .limit(1);

    if (existingAssignment.length > 0) {
      console.log(
        `[COMPUTER ASSIGN] Computer ${computerId} is already assigned (assignmentId=${existingAssignment[0].id})`
      );
      return res.status(409).json({
        success: false,
        message: "Computer is already assigned to another student",
      });
    }

    console.log(
      `[COMPUTER ASSIGN] Updating computer ${computerId} status to in_use`
    );
    // Update computer status to in_use
    await db
      .update(computers)
      .set({
        status: "in_use",
        updatedAt: new Date(),
      })
      .where(eq(computers.id, computerId));

    console.log(
      `[COMPUTER ASSIGN] Creating assignment record for computerId=${computerId}, studentId=${studentId}, classSessionId=${classSessionId}`
    );
    // Create assignment record
    const assignment = await db
      .insert(computerAssignments)
      .values({
        computerId,
        studentId,
        classSessionId,
        status: "active",
        assignedAt: new Date(),
      })
      .returning();

    console.log(
      `[COMPUTER ASSIGN] Assignment created successfully: assignmentId=${assignment[0].id}`
    );
    res.status(201).json({ success: true, data: assignment[0] });
  } catch (error) {
    console.error("Error assigning computer:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to assign computer" });
  }
});

// POST /api/computers/release/:assignmentId - Release computer assignment (admin or faculty)
router.post(
  "/release/:assignmentId",
  requireAdminOrFaculty,
  async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const userRole = req.session?.userRole;
      const userId = req.session?.userId;

      console.log(
        `[COMPUTER RELEASE] Attempting release: assignmentId=${assignmentId}, userRole=${userRole}, userId=${userId}`
      );

      // Get assignment to find computer
      const assignment = await db
        .select()
        .from(computerAssignments)
        .where(eq(computerAssignments.id, assignmentId))
        .limit(1);

      if (assignment.length === 0) {
        console.log(
          `[COMPUTER RELEASE] Assignment not found: assignmentId=${assignmentId}`
        );
        return res
          .status(404)
          .json({ success: false, message: "Assignment not found" });
      }

      console.log(
        `[COMPUTER RELEASE] Found assignment: computerId=${assignment[0].computerId}, studentId=${assignment[0].studentId}`
      );

      const computerId = assignment[0].computerId;

      // If faculty, check if they have access to this computer
      if (userRole === "faculty") {
        console.log(
          `[COMPUTER RELEASE] Faculty access check for computerId=${computerId}, userId=${userId}`
        );
        const computerCheck = await db
          .select()
          .from(computers)
          .innerJoin(
            schedules,
            eq(computers.classroomId, schedules.classroomId)
          )
          .where(
            and(eq(computers.id, computerId), eq(schedules.facultyId, userId))
          )
          .limit(1);

        console.log(
          `[COMPUTER RELEASE] Faculty access check result: ${computerCheck.length} matching records`
        );
        if (computerCheck.length === 0) {
          console.log(
            `[COMPUTER RELEASE] Access denied for faculty userId=${userId} to computerId=${computerId}`
          );
          return res.status(403).json({
            success: false,
            message: "Access denied to this computer",
          });
        }
      }

      console.log(
        `[COMPUTER RELEASE] Updating computer ${computerId} status to available`
      );
      // Update computer status to available
      await db
        .update(computers)
        .set({ status: "available", updatedAt: new Date() })
        .where(eq(computers.id, computerId));

      console.log(
        `[COMPUTER RELEASE] Updating assignment ${assignmentId} with releasedAt timestamp`
      );
      // Update assignment with release time and status
      await db
        .update(computerAssignments)
        .set({
          releasedAt: new Date(),
          status: "completed",
        })
        .where(eq(computerAssignments.id, assignmentId));

      console.log(`[COMPUTER RELEASE] Computer released successfully`);
      res.json({ success: true, message: "Computer released successfully" });
    } catch (error) {
      console.error("Error releasing computer:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to release computer" });
    }
  }
);

// Smart Assignment Routes
// POST /api/computers/smart-assign/performance/:sessionId - Assign by performance
router.post(
  "/smart-assign/performance/:sessionId",
  requireAdminOrFaculty,
  async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const assignments = await smartAssignmentService.assignByPerformance(
        sessionId
      );

      // Create actual assignments in database
      const createdAssignments = [];
      for (const assignment of assignments) {
        try {
          // Check if computer is available
          const computerCheck = await db
            .select()
            .from(computers)
            .where(
              and(
                eq(computers.id, assignment.computerId),
                eq(computers.status, "available")
              )
            )
            .limit(1);

          if (computerCheck.length === 0) continue; // Skip if computer not available

          // Update computer status
          await db
            .update(computers)
            .set({ status: "in_use", updatedAt: new Date() })
            .where(eq(computers.id, assignment.computerId));

          // Create assignment record
          const newAssignment = await db
            .insert(computerAssignments)
            .values({
              computerId: assignment.computerId,
              studentId: assignment.studentId,
              classSessionId: sessionId,
              status: "active",
              assignedAt: new Date(),
            })
            .returning();

          createdAssignments.push({
            ...assignment,
            id: newAssignment[0].id,
          });
        } catch (error) {
          console.error(
            `Failed to create assignment for student ${assignment.studentId}:`,
            error
          );
        }
      }

      res.json({
        success: true,
        data: createdAssignments,
        message: `Smart assignment completed for ${createdAssignments.length} students`,
      });
    } catch (error) {
      console.error("Error in performance-based assignment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform smart assignment",
      });
    }
  }
);

// Helper function to create assignments from smart assignment results
async function createAssignmentsFromResults(
  assignments: any[],
  sessionId: number
) {
  const createdAssignments = [];
  for (const assignment of assignments) {
    try {
      // Check if computer is available
      const computerCheck = await db
        .select()
        .from(computers)
        .where(
          and(
            eq(computers.id, assignment.computerId),
            eq(computers.status, "available")
          )
        )
        .limit(1);

      if (computerCheck.length === 0) continue; // Skip if computer not available

      // Update computer status
      await db
        .update(computers)
        .set({ status: "in_use", updatedAt: new Date() })
        .where(eq(computers.id, assignment.computerId));

      // Create assignment record
      const newAssignment = await db
        .insert(computerAssignments)
        .values({
          computerId: assignment.computerId,
          studentId: assignment.studentId,
          classSessionId: sessionId,
          status: "active",
          assignedAt: new Date(),
        })
        .returning();

      createdAssignments.push({
        ...assignment,
        id: newAssignment[0].id,
      });
    } catch (error) {
      console.error(
        `Failed to create assignment for student ${assignment.studentId}:`,
        error
      );
    }
  }
  return createdAssignments;
}

// POST /api/computers/smart-assign/learning-style/:sessionId - Assign by learning style
router.post(
  "/smart-assign/learning-style/:sessionId",
  requireAdminOrFaculty,
  async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const assignments = await smartAssignmentService.assignByLearningStyle(
        sessionId
      );

      const createdAssignments = await createAssignmentsFromResults(
        assignments,
        sessionId
      );

      res.json({
        success: true,
        data: createdAssignments,
        message: `Learning style-based assignment completed for ${createdAssignments.length} students`,
      });
    } catch (error) {
      console.error("Error in learning style assignment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform smart assignment",
      });
    }
  }
);

// POST /api/computers/smart-assign/conflict-free/:sessionId - Assign conflict-free
router.post(
  "/smart-assign/conflict-free/:sessionId",
  requireAdminOrFaculty,
  async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const assignments = await smartAssignmentService.assignConflictFree(
        sessionId
      );

      const createdAssignments = await createAssignmentsFromResults(
        assignments,
        sessionId
      );

      res.json({
        success: true,
        data: createdAssignments,
        message: `Conflict-free assignment completed for ${createdAssignments.length} students`,
      });
    } catch (error) {
      console.error("Error in conflict-free assignment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform smart assignment",
      });
    }
  }
);

// POST /api/computers/smart-assign/random/:sessionId - Random assignment
router.post(
  "/smart-assign/random/:sessionId",
  requireAdminOrFaculty,
  async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const assignments = await smartAssignmentService.assignRandom(sessionId);

      const createdAssignments = await createAssignmentsFromResults(
        assignments,
        sessionId
      );

      res.json({
        success: true,
        data: createdAssignments,
        message: `Random assignment completed for ${createdAssignments.length} students`,
      });
    } catch (error) {
      console.error("Error in random assignment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform smart assignment",
      });
    }
  }
);

// POST /api/computers/smart-assign/custom/:sessionId - Custom assignment criteria
router.post(
  "/smart-assign/custom/:sessionId",
  requireAdminOrFaculty,
  async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const criteria = req.body; // { prioritizePerformance, balanceLearningStyles, avoidConflicts, preferFamiliarComputers }

      const assignments =
        await smartAssignmentService.assignStudentsToComputers(
          sessionId,
          criteria
        );

      const createdAssignments = await createAssignmentsFromResults(
        assignments,
        sessionId
      );

      res.json({
        success: true,
        data: createdAssignments,
        message: `Custom assignment completed for ${createdAssignments.length} students`,
      });
    } catch (error) {
      console.error("Error in custom assignment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to perform smart assignment",
      });
    }
  }
);

// GET /api/computers/status - Get real-time status for all computers
router.get("/status", requireAuth, async (req, res) => {
  try {
    const allComputers = await db.select().from(computers);

    // For now, simulate status based on assignments and random factors
    // In a real implementation, this would come from actual computer monitoring
    const statusData = allComputers.map((computer) => {
      const isAssigned = computer.status === "in_use";
      const randomOnline = Math.random() > 0.1; // 90% online rate
      const lastActivity = new Date(Date.now() - Math.random() * 3600000); // Within last hour

      return {
        computerId: computer.id,
        isOnline: randomOnline,
        lastActivity: lastActivity.toISOString(),
        status: isAssigned ? "active" : "idle",
        currentUser: isAssigned ? "student" : null,
        cpuUsage: Math.floor(Math.random() * 100),
        memoryUsage: Math.floor(Math.random() * 100),
      };
    });

    res.json({ success: true, data: statusData });
  } catch (error) {
    console.error("Error fetching computer status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch computer status",
    });
  }
});

// POST /api/computers/:id/heartbeat - Computer heartbeat endpoint
router.post("/:id/heartbeat", async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);
    const { cpuUsage, memoryUsage, isOnline } = req.body;

    // In a real implementation, this would update a status table
    // For now, we'll just acknowledge the heartbeat
    console.log(
      `Heartbeat from computer ${computerId}: CPU ${cpuUsage}%, Memory ${memoryUsage}%, Online: ${isOnline}`
    );

    // Broadcast status update via WebSocket
    const { broadcastToWebClients } = await import("../services/websocket.js");
    broadcastToWebClients("computerStatusUpdate", {
      computerId,
      isOnline: true,
      lastActivity: new Date().toISOString(),
      status: "active",
      cpuUsage,
      memoryUsage,
    });

    res.json({ success: true, message: "Heartbeat received" });
  } catch (error) {
    console.error("Error processing heartbeat:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process heartbeat",
    });
  }
});

// Maintenance Routes

// GET /api/computers/maintenance - Get all maintenance records
router.get("/maintenance", requireAuth, async (req, res) => {
  try {
    const maintenance = await db
      .select({
        maintenance: computerMaintenance,
        computer: {
          id: computers.id,
          name: computers.name,
          classroomId: computers.classroomId,
        },
        performedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(computerMaintenance)
      .innerJoin(computers, eq(computerMaintenance.computerId, computers.id))
      .innerJoin(users, eq(computerMaintenance.performedBy, users.id))
      .orderBy(desc(computerMaintenance.createdAt));

    res.json({ success: true, data: maintenance });
  } catch (error) {
    console.error("Error fetching maintenance records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch maintenance records",
    });
  }
});

// POST /api/computers/maintenance - Schedule maintenance
router.post("/maintenance", requireAdminOrFaculty, async (req, res) => {
  try {
    const {
      computerId,
      maintenanceType,
      description,
      scheduledDate,
      cost,
      parts,
      notes,
    } = req.body;
    const userId = req.session?.userId;

    const newMaintenance = await db
      .insert(computerMaintenance)
      .values({
        computerId,
        maintenanceType,
        description,
        performedBy: userId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        cost,
        parts,
        notes,
      })
      .returning();

    // Update computer's next maintenance date
    if (scheduledDate) {
      await db
        .update(computers)
        .set({ nextMaintenance: new Date(scheduledDate) })
        .where(eq(computers.id, computerId));
    }

    res.status(201).json({ success: true, data: newMaintenance[0] });
  } catch (error) {
    console.error("Error scheduling maintenance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule maintenance",
    });
  }
});

// PUT /api/computers/maintenance/:id - Update maintenance record
router.put("/maintenance/:id", requireAdminOrFaculty, async (req, res) => {
  try {
    const maintenanceId = parseInt(req.params.id);
    const { status, completedDate, cost, parts, notes } = req.body;

    const updateData: any = {
      status,
      cost,
      parts,
      notes,
      updatedAt: new Date(),
    };

    if (completedDate) {
      updateData.completedDate = new Date(completedDate);

      // Update computer's last maintenance date
      const maintenance = await db
        .select()
        .from(computerMaintenance)
        .where(eq(computerMaintenance.id, maintenanceId))
        .limit(1);

      if (maintenance.length > 0) {
        await db
          .update(computers)
          .set({
            lastMaintenance: new Date(completedDate),
            nextMaintenance: null, // Clear next maintenance until rescheduled
          })
          .where(eq(computers.id, maintenance[0].computerId));
      }
    }

    const updatedMaintenance = await db
      .update(computerMaintenance)
      .set(updateData)
      .where(eq(computerMaintenance.id, maintenanceId))
      .returning();

    if (updatedMaintenance.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Maintenance record not found",
      });
    }

    res.json({ success: true, data: updatedMaintenance[0] });
  } catch (error) {
    console.error("Error updating maintenance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update maintenance",
    });
  }
});

// DELETE /api/computers/maintenance/:id - Delete maintenance record
router.delete("/maintenance/:id", requireAdmin, async (req, res) => {
  try {
    const maintenanceId = parseInt(req.params.id);

    await db
      .delete(computerMaintenance)
      .where(eq(computerMaintenance.id, maintenanceId));

    res.json({ success: true, message: "Maintenance record deleted" });
  } catch (error) {
    console.error("Error deleting maintenance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete maintenance record",
    });
  }
});

// GET /api/computers/:id/maintenance - Get maintenance history for a computer
router.get("/:id/maintenance", requireAuth, async (req, res) => {
  try {
    const computerId = parseInt(req.params.id);

    const maintenance = await db
      .select({
        maintenance: computerMaintenance,
        performedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(computerMaintenance)
      .innerJoin(users, eq(computerMaintenance.performedBy, users.id))
      .where(eq(computerMaintenance.computerId, computerId))
      .orderBy(desc(computerMaintenance.createdAt));

    res.json({ success: true, data: maintenance });
  } catch (error) {
    console.error("Error fetching computer maintenance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch maintenance history",
    });
  }
});

export default router;
