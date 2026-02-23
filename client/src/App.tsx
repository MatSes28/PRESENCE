import { Router, Route, useLocation } from "wouter";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import {
  NotificationProvider,
  NotificationContainer,
} from "./components/NotificationSystem";
import { LoginForm } from "./components/LoginForm";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { Reports } from "./pages/Reports";
import { LiveAttendance } from "./pages/LiveAttendance";
import { Schedule } from "./pages/Schedule";
import { ForgotPassword } from "./pages/ForgotPassword";
import { FacultyManagement } from "./pages/FacultyManagement";
import { Settings } from "./pages/Settings";
import { Roster } from "./pages/Roster";
import { UserManagement } from "./pages/UserManagement";
import { ResetPassword } from "./pages/ResetPassword";
import { AIAnalytics } from "./pages/AIAnalytics";
import { Subjects } from "./pages/Subjects";
import { EnrollmentManagement } from "./pages/EnrollmentManagement";
import { StudentDetail } from "./pages/StudentDetail";
import { StudentEdit } from "./pages/StudentEdit";
import { useEffect } from "react";

function AppContent() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  console.log("AppContent render - user:", user, "loading:", loading);

  // Handle redirect after successful login
  useEffect(() => {
    if (!loading && user) {
      console.log("User authenticated, redirecting to dashboard");
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
    console.log("No user, showing login form");
    return (
      <Router>
        <Route path="/login" component={LoginForm} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="*" component={LoginForm} />
      </Router>
    );
  }

  console.log("User authenticated, showing dashboard");
  return (
    <Router>
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
        path="/reports/export"
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
