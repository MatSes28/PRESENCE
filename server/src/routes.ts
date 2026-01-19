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
import gdprRoutes from "./routes/gdpr.js";
import privacyRoutes from "./routes/privacy.js";
import auditRoutes from "./routes/audit.js";

const router = Router();

// Apply monitoring middleware to all routes
router.use(monitoringService.createRequestMiddleware());

// Health and monitoring routes
router.use("/", healthRoutes);

// Mount route modules without API versioning
router.use("/api/auth", authRoutes);
router.use("/api/students", studentRoutes);
router.use("/api/attendance", attendanceRoutes);
router.use("/api/classrooms", classroomRoutes);
router.use("/api/schedules", scheduleRoutes);
router.use("/api/sessions", classSessionRoutes);
router.use("/api/reports", reportRoutes);
router.use("/api/users", userRoutes);
router.use("/api/computers", computerRoutes);
router.use("/api/notifications", notificationRoutes);
router.use("/api/iot", iotRoutes);
router.use("/api/dashboard", dashboardRoutes);
router.use("/api/subjects", subjectRoutes);
router.use("/api/enrollments", enrollmentRoutes);
router.use("/api/ai-analytics", aiAnalyticsRoutes);
router.use("/api/mobile", mobileRoutes);
router.use("/api/integrations", integrationRoutes);
router.use("/api/settings", settingsRoutes);
router.use("/api/gdpr", gdprRoutes);
router.use("/api/privacy", privacyRoutes);
router.use("/api/audit", auditRoutes);

export default router;
