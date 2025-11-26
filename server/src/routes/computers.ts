import { Router } from "express";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "../storage.js";
import {
  computers,
  computerAssignments,
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

const router = Router();

// GET /api/computers - Get all computers (with role-based filtering)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    if (userRole === "faculty") {
      // Faculty can only see computers they created (based on schedules they teach)
      const facultyComputers = await db
        .select({ id: computers.id })
        .from(computers)
        .innerJoin(schedules, eq(computers.classroomId, schedules.classroomId))
        .where(eq(schedules.facultyId, userId));

      const computerIds = [...new Set(facultyComputers.map((c) => c.id))];

      if (computerIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const allComputers = await db
        .select()
        .from(computers)
        .where(inArray(computers.id, computerIds));

      return res.json({ success: true, data: allComputers });
    }

    // Admin sees all computers
    const allComputers = await db.select().from(computers);
    res.json({ success: true, data: allComputers });
  } catch (error) {
    console.error("Error fetching computers:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch computers" });
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

export default router;
