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
import { IoTDevices } from "./pages/IoTDevices";
import { LabComputers } from "./pages/LabComputers";
import { LiveAttendance } from "./pages/LiveAttendance";
import { Schedule } from "./pages/Schedule";
import { ForgotPassword } from "./pages/ForgotPassword";
import { FacultyManagement } from "./pages/FacultyManagement";
import { Settings } from "./pages/Settings";
import { Roster } from "./pages/Roster";
import { Monitor } from "./pages/Monitor";
import { SystemHealth } from "./pages/SystemHealth";
import { SystemTesting } from "./pages/SystemTesting";
import { UserManagement } from "./pages/UserManagement";
import { Compliance } from "./pages/Compliance";
import { HelpCenter } from "./pages/HelpCenter";
import { ResetPassword } from "./pages/ResetPassword";

function AppContent() {
  const { user, loading } = useAuth();

  console.log("AppContent render - user:", user, "loading:", loading);

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
    <Layout>
      <Router>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route
          path="/students"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <Students />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/reports"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <Reports />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/devices"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <IoTDevices />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/lab-computers"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <LabComputers />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/attendance"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <LiveAttendance />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/schedule"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <Schedule />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/faculty"
          component={() => (
            <ProtectedRoute allowedRoles={["admin"]}>
              <FacultyManagement />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/settings"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <Settings />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/roster"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <Roster />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/monitor"
          component={() => (
            <ProtectedRoute allowedRoles={["admin"]}>
              <Monitor />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/iot"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <IoTDevices />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/health"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <SystemHealth />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/testing"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <SystemTesting />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/users"
          component={() => (
            <ProtectedRoute allowedRoles={["admin"]}>
              <UserManagement />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/compliance"
          component={() => (
            <ProtectedRoute allowedRoles={["admin"]}>
              <Compliance />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/help"
          component={() => (
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <HelpCenter />
            </ProtectedRoute>
          )}
        />
      </Router>
    </Layout>
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
