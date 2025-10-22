import { Router } from "express";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/students.js";
import attendanceRoutes from "./routes/attendance.js";
import classroomRoutes from "./routes/classrooms.js";
import scheduleRoutes from "./routes/schedules.js";
import classSessionRoutes from "./routes/classSessions.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";
import computerRoutes from "./routes/computers.js";
import notificationRoutes from "./routes/notifications.js";
// Removed audit routes - not in paper scope

const router = Router();

// Mount route modules
router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/classrooms", classroomRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/sessions", classSessionRoutes);
router.use("/reports", reportRoutes);
router.use("/users", userRoutes);
router.use("/computers", computerRoutes);
router.use("/notifications", notificationRoutes);

export default router;
