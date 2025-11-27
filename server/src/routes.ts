import { Router } from "express";
import { monitoringService } from "./services/monitoringService.js";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/students.js";
import attendanceRoutes from "./routes/attendance.js";
import classroomRoutes from "./routes/classrooms.js";
import scheduleRoutes from "./routes/schedules.js";
import classSessionRoutes from "./routes/classSessions.js";
import subjectRoutes from "./routes/subjects.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";
import computerRoutes from "./routes/computers.js";
import notificationRoutes from "./routes/notifications.js";
import iotRoutes from "./routes/iot.js";
import dashboardRoutes from "./routes/dashboard.js";
import enrollmentRoutes from "./routes/enrollments.js";
import aiAnalyticsRoutes from "./routes/aiAnalytics.js";
import mobileRoutes from "./routes/mobile.js";
import integrationRoutes from "./routes/integrations.js";
import settingsRoutes from "./routes/settings.js";
import healthRoutes from "./routes/health.js";
// Removed audit routes - not in paper scope

const router = Router();

// Apply monitoring middleware to all routes
router.use(monitoringService.createRequestMiddleware());

// Health and monitoring routes
router.use("/", healthRoutes);

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
router.use("/iot", iotRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/subjects", subjectRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/ai-analytics", aiAnalyticsRoutes);
router.use("/mobile", mobileRoutes);
router.use("/integrations", integrationRoutes);
router.use("/settings", settingsRoutes);

export default router;
