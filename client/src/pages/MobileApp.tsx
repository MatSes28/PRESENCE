import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { mobileApi } from "../lib/mobileApi";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Session {
  id: number;
  subject: string;
  date: string;
  startTime: string;
  classroom: string;
}

export const MobileApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  useEffect(() => {
    checkConnectivity();
    loadUserData();
  }, []);

  const checkConnectivity = async () => {
    const online = await mobileApi.checkConnectivity();
    setIsOnline(online);
  };

  const loadUserData = async () => {
    try {
      const userResponse = await api.getCurrentUser();
      if (userResponse.success && userResponse.data) {
        const u = userResponse.data as User;
        setUser({
          id: u.id,
          name: u.name ?? u.email ?? "User",
          email: u.email ?? "",
          role: u.role ?? "faculty",
        });
        const dashboardResponse = await mobileApi.getMobileDashboard(u.id);
        if (dashboardResponse.success && dashboardResponse.data) {
          setDashboard(dashboardResponse.data);
        }
      } else {
        setUser(null);
        setDashboard(null);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
      setUser(null);
      setDashboard(null);
    }
  };

  const generateQRCode = async (sessionId: number) => {
    try {
      setLoading(true);
      const response = await mobileApi.generateQRCode(sessionId);
      if (response.success) {
        setQrCode(response.data.qrCode);
        setCurrentSession(
          dashboard?.upcomingSessions?.find((s: any) => s.id === sessionId) ||
            null
        );
      }
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    } finally {
      setLoading(false);
    }
  };

  const simulateStudentCheckIn = async () => {
    if (!currentSession) return;
    const studentId = selectedStudentId.trim();
    if (!studentId) {
      setAttendanceStatus("❌ Enter a student ID first");
      return;
    }
    try {
      setLoading(true);
      const response = await mobileApi.recordQRAttendance({
        qrData: JSON.stringify({
          sessionId: currentSession.id,
          type: "attendance_check",
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
        studentId,
        rfidDetected: false,
      });

      if (response.success) {
        setAttendanceStatus(`✅ Attendance recorded: ${response.data.status}`);
        // Refresh dashboard
        if (user) {
          const dashboardResponse = await mobileApi.getMobileDashboard(user.id);
          if (dashboardResponse.success) {
            setDashboard(dashboardResponse.data);
          }
        }
      } else {
        setAttendanceStatus(`❌ ${response.message}`);
      }
    } catch (error) {
      console.error("Failed to record attendance:", error);
      setAttendanceStatus("❌ Failed to record attendance");
    } finally {
      setLoading(false);
    }
  };

  const registerDevice = async () => {
    if (!user) return;

    try {
      let deviceToken = typeof localStorage !== "undefined" ? localStorage.getItem("mobile_device_id") : null;
      if (!deviceToken) {
        deviceToken = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        if (typeof localStorage !== "undefined") localStorage.setItem("mobile_device_id", deviceToken);
      }
      const response = await mobileApi.registerDevice({
        userId: user.id.toString(),
        deviceToken,
        deviceType: "mobile",
        platform: "web-mobile",
      });

      if (response.success) {
        alert("Device registered for push notifications!");
      }
    } catch (error) {
      console.error("Failed to register device:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="bg-teal-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">📱 CLIRDEC Mobile</h1>
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isOnline ? "bg-green-400" : "bg-red-400"
              }`}
            ></div>
            <span className="text-sm">{isOnline ? "Online" : "Offline"}</span>
          </div>
        </div>
        {user && (
          <div className="mt-2 text-sm">
            Welcome, {user.name} ({user.role})
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {!user && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center text-amber-800">
            Please log in to view the mobile dashboard.
          </div>
        )}
        {/* Dashboard Cards */}
        {dashboard && user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold mb-3">🔔 Notifications</h2>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {dashboard.notifications
                  ?.slice(0, 3)
                  .map((notification: any) => (
                    <div
                      key={notification.id}
                      className="text-sm p-2 bg-gray-50 rounded"
                    >
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-gray-600">
                        {notification.message}
                      </div>
                    </div>
                  )) || <div className="text-gray-500">No notifications</div>}
              </div>
            </div>

            {/* Upcoming Sessions */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold mb-3">
                📅 Upcoming Sessions
              </h2>
              <div className="space-y-2">
                {dashboard.upcomingSessions?.slice(0, 3).map((session: any) => (
                  <div
                    key={session.id}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <div>
                      <div className="font-medium">{session.subject}</div>
                      <div className="text-sm text-gray-600">
                        {session.classroom} • {session.startTime}
                      </div>
                    </div>
                    <button
                      onClick={() => generateQRCode(session.id)}
                      className="px-3 py-1 bg-teal-500 text-white text-sm rounded hover:bg-teal-600"
                      disabled={loading}
                    >
                      QR Code
                    </button>
                  </div>
                )) || <div className="text-gray-500">No upcoming sessions</div>}
              </div>
            </div>
          </div>
        )}

        {/* QR Code Section */}
        {qrCode && currentSession && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-3">
              📱 QR Code for {currentSession.subject}
            </h2>
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
              <div className="text-center">
                <img
                  src={qrCode}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto border-2 border-gray-300 rounded"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Scan to mark attendance
                </p>
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
                  <input
                    type="text"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    placeholder="Enter student ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="text-center">
                  <button
                    onClick={simulateStudentCheckIn}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Recording..." : "📱 Simulate Student Check-in"}
                  </button>
                </div>

                {attendanceStatus && (
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">{attendanceStatus}</div>
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Session:</strong> {currentSession.subject}
                  </p>
                  <p>
                    <strong>Classroom:</strong> {currentSession.classroom}
                  </p>
                  <p>
                    <strong>Time:</strong> {currentSession.startTime}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {dashboard?.recentActivity && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-semibold mb-3">📊 Recent Activity</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {dashboard.recentActivity.map((activity: any, index: number) => (
                <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                  {activity.message}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Actions */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-3">⚙️ Mobile Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={registerDevice}
              className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              📱 Register Device
            </button>

            <button
              onClick={checkConnectivity}
              className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              🌐 Check Connection
            </button>

            <button
              onClick={loadUserData}
              className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>

        {/* Offline Indicator */}
        {!isOnline && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
            <div className="flex items-center">
              <div className="text-yellow-700">
                ⚠️ You are currently offline. Some features may not be
                available.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
