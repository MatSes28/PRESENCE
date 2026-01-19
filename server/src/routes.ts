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

// Mount route modules with API versioning
router.use("/api/v1/auth", authRoutes);
router.use("/api/v1/students", studentRoutes);
router.use("/api/v1/attendance", attendanceRoutes);
router.use("/api/v1/classrooms", classroomRoutes);
router.use("/api/v1/schedules", scheduleRoutes);
router.use("/api/v1/sessions", classSessionRoutes);
router.use("/api/v1/reports", reportRoutes);
router.use("/api/v1/users", userRoutes);
router.use("/api/v1/computers", computerRoutes);
router.use("/api/v1/notifications", notificationRoutes);
router.use("/api/v1/iot", iotRoutes);
router.use("/api/v1/dashboard", dashboardRoutes);
router.use("/api/v1/subjects", subjectRoutes);
router.use("/api/v1/enrollments", enrollmentRoutes);
router.use("/api/v1/ai-analytics", aiAnalyticsRoutes);
router.use("/api/v1/mobile", mobileRoutes);
router.use("/api/v1/integrations", integrationRoutes);
router.use("/api/v1/settings", settingsRoutes);
router.use("/api/v1/gdpr", gdprRoutes);
router.use("/api/v1/privacy", privacyRoutes);
router.use("/api/v1/audit", auditRoutes);

export default router;
