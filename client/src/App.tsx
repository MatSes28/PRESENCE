import { Router, Route } from "wouter";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { Reports } from "./pages/Reports";
import { IoTDevices } from "./pages/IoTDevices";
import { LiveAttendance } from "./pages/LiveAttendance";
import { ForgotPassword } from "./pages/ForgotPassword";
import { FacultyManagement } from "./pages/FacultyManagement";
import { Settings } from "./pages/Settings";

function AppContent() {
  const { user, loading } = useAuth();

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
        <Route path="/login" component={LoginForm} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="*" component={LoginForm} />
      </Router>
    );
  }

  return (
    <Router>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/students" component={Students} />
      <Route path="/reports" component={Reports} />
      <Route path="/devices" component={IoTDevices} />
      <Route path="/attendance" component={LiveAttendance} />
      <Route path="/faculty" component={FacultyManagement} />
      <Route path="/settings" component={Settings} />
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
