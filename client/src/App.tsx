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
import { LabComputers } from "./pages/LabComputers";
import { LiveAttendance } from "./pages/LiveAttendance";
import { Schedule } from "./pages/Schedule";
import { ForgotPassword } from "./pages/ForgotPassword";
import { FacultyManagement } from "./pages/FacultyManagement";
import { Settings } from "./pages/Settings";
import { Roster } from "./pages/Roster";
import { UserManagement } from "./pages/UserManagement";
import { ResetPassword } from "./pages/ResetPassword";
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
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
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
        path="/lab-computers"
        component={() => (
          <Layout>
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <LabComputers />
            </ProtectedRoute>
          </Layout>
        )}
      />
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
        path="/settings"
        component={() => (
          <Layout>
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <Settings />
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
