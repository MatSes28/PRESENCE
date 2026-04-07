import { Router, Route, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useInactivityLogout } from "./hooks/useInactivityLogout";
import { setOn401 } from "./lib/onUnauthorized";
import {
  NotificationProvider,
  NotificationContainer,
  useNotifications,
} from "./components/NotificationSystem";
import { LoginForm } from "./components/LoginForm";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Code-split route pages to reduce initial bundle size
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Students = lazy(() =>
  import("./pages/Students").then((m) => ({ default: m.Students })),
);
const Reports = lazy(() =>
  import("./pages/Reports").then((m) => ({ default: m.Reports })),
);
const LiveAttendance = lazy(() =>
  import("./pages/LiveAttendance").then((m) => ({ default: m.LiveAttendance })),
);
const Schedule = lazy(() =>
  import("./pages/Schedule").then((m) => ({ default: m.Schedule })),
);
const ForgotPassword = lazy(() =>
  import("./pages/ForgotPassword").then((m) => ({ default: m.ForgotPassword })),
);
const FacultyManagement = lazy(() =>
  import("./pages/FacultyManagement").then((m) => ({
    default: m.FacultyManagement,
  })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Roster = lazy(() =>
  import("./pages/Roster").then((m) => ({ default: m.Roster })),
);
const UserManagement = lazy(() =>
  import("./pages/UserManagement").then((m) => ({ default: m.UserManagement })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const AIAnalytics = lazy(() =>
  import("./pages/AIAnalytics").then((m) => ({ default: m.AIAnalytics })),
);
const Subjects = lazy(() =>
  import("./pages/Subjects").then((m) => ({ default: m.Subjects })),
);
const Classrooms = lazy(() =>
  import("./pages/Classrooms").then((m) => ({ default: m.Classrooms })),
);
const SubjectEnrollment = lazy(() =>
  import("./pages/SubjectEnrollment").then((m) => ({
    default: m.SubjectEnrollment,
  })),
);
const EnrollmentManagement = lazy(() =>
  import("./pages/EnrollmentManagement").then((m) => ({
    default: m.EnrollmentManagement,
  })),
);
const StudentDetail = lazy(() =>
  import("./pages/StudentDetail").then((m) => ({ default: m.StudentDetail })),
);
const StudentEdit = lazy(() =>
  import("./pages/StudentEdit").then((m) => ({ default: m.StudentEdit })),
);
const Discrepancies = lazy(() =>
  import("./pages/Discrepancies").then((m) => ({ default: m.Discrepancies })),
);

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
    </div>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const { addNotification } = useNotifications();
  const [, setLocation] = useLocation();

  // 10-minute inactivity auto-logout: show message then logout
  const handleInactivityLogout = () => {
    addNotification({
      type: "info",
      title: "Session expired",
      message:
        "You have been logged out due to 10 minutes of inactivity. Please sign in again.",
    });
    logout();
  };
  useInactivityLogout(!!user, handleInactivityLogout);

  // On 401 from API: show session expired message and logout
  useEffect(() => {
    if (user) {
      setOn401(() => {
        addNotification({
          type: "info",
          title: "Session expired",
          message: "Your session has expired. Please sign in again.",
        });
        logout();
      });
    }
    return () => setOn401(null);
  }, [user, logout, addNotification]);

  // Handle redirect after successful login
  useEffect(() => {
    if (!loading && user) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Suspense fallback={<PageFallback />}>
          <Route path="/login" component={LoginForm} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="*" component={LoginForm} />
        </Suspense>
      </Router>
    );
  }

  return (
    <Router>
      <Suspense fallback={<PageFallback />}>
        {/* Dashboard - Single route for overview */}
        <Route
          path="/"
          component={() => (
            <Layout>
              <Dashboard />
            </Layout>
          )}
        />

        {/* Attendance Module */}
        <Route
          path="/attendance"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <LiveAttendance />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/discrepancies"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <Discrepancies />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/roster"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <Roster />
              </ProtectedRoute>
            </Layout>
          )}
        />

        {/* Management Module */}
        <Route
          path="/students"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <Students />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/students/:id"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <StudentDetail />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/students/:id/edit"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <StudentEdit />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/faculty"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <FacultyManagement />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/classrooms"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Classrooms />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/subjects"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <Subjects />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/schedule"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <Schedule />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/subject-enrollment"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <SubjectEnrollment />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/enrollments"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <EnrollmentManagement />
              </ProtectedRoute>
            </Layout>
          )}
        />

        {/* Reports Module */}
        <Route
          path="/reports"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <Reports />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/ai-analytics"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                <AIAnalytics />
              </ProtectedRoute>
            </Layout>
          )}
        />

        {/* Settings Module */}
        <Route
          path="/settings"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Settings />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/users"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <UserManagement />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="/roles"
          component={() => (
            <Layout>
              <ProtectedRoute allowedRoles={["admin"]}>
                <UserManagement />
              </ProtectedRoute>
            </Layout>
          )}
        />
        <Route
          path="*"
          component={() => (
            <Layout>
              <Dashboard />
            </Layout>
          )}
        />
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppContent />
        <NotificationContainer />
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
