import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { ConfirmationDialog } from "./ConfirmationDialog";
import {
  getWebSocketClient,
  type WebSocketConnectionState,
} from "../lib/websocket";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/attendance": "Live Attendance",
  "/discrepancies": "Discrepancies",
  "/schedule": "Schedule",
  "/students": "Students",
  "/faculty": "Faculty Management",
  "/classrooms": "Room Management",
  "/subjects": "Subjects",
  "/subject-enrollment": "Subject Enrollment",
  "/enrollments": "Enrollment Management",
  "/roster": "Class Roster",
  "/monitor": "Monitor",
  "/iot": "IoT Devices",
  "/health": "System Health",
  "/testing": "System Testing",
  "/reports": "Reports",
  "/users": "User Management",
  "/roles": "User Management",
  "/ai-analytics": "AI Analytics",
  "/compliance": "Compliance",
  "/help": "Help Center",
  "/settings": "Settings",
};

interface TopBarProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  showMenuButton = false,
}) => {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [liveState, setLiveState] =
    useState<WebSocketConnectionState>("disconnected");

  const currentTitle =
    pageTitles[location] ||
    (location.startsWith("/students/") ? "Student Details" : "Dashboard");

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  useEffect(() => {
    if (!user?.id) {
      setLiveState("disconnected");
      return;
    }

    const client = getWebSocketClient(user.id);
    setLiveState(client.getConnectionState());
    const handleStatus = (status: { state: WebSocketConnectionState }) => {
      setLiveState(status.state);
    };

    client.on("status", handleStatus);
    return () => client.off("status", handleStatus);
  }, [user?.id]);

  const liveLabel =
    liveState === "connected"
      ? "Live updates connected"
      : liveState === "reconnecting" || liveState === "connecting"
        ? "Live updates reconnecting"
        : liveState === "failed"
          ? "Live updates offline"
          : "Live updates disconnected";
  const liveDotClass =
    liveState === "connected"
      ? "bg-green-400"
      : liveState === "reconnecting" || liveState === "connecting"
        ? "bg-yellow-400"
        : "bg-red-400";

  return (
    <header className="border-b border-gray-700 bg-gray-800 px-4 py-4 pt-safe-top shadow-sm ios-safe-header ios-gesture-area md:px-6">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile Menu Button */}
        {showMenuButton && (
          <button
            data-sidebar-toggle
            onClick={onMenuClick}
            className="mr-4 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white ios-button ios-touch-target ios-gesture-area md:hidden"
            aria-label="Open menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}

        {/* Page Title / Breadcrumb */}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-semibold text-cyan-400 truncate ios-font-optimized">
            {currentTitle}
          </h1>
          <nav className="mt-2 hidden text-sm text-gray-400 sm:block">
            <span>Home</span>
            {location !== "/" && (
              <>
                <span className="mx-2">/</span>
                <span>{currentTitle}</span>
              </>
            )}
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          <div
            className="hidden items-center gap-2 text-xs text-gray-300 lg:flex"
            title={liveLabel}
          >
            <span className={`w-2 h-2 rounded-full ${liveDotClass}`}></span>
            <span>{liveLabel}</span>
          </div>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications coming soon"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            🔔
          </button>

          {/* User Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-4 rounded-lg px-4 py-2 transition-colors hover:bg-gray-700"
            >
              <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Logout Confirmation Modal */}
            <ConfirmationDialog
              isOpen={showLogoutConfirm}
              title="Confirm Logout"
              message="Are you sure you want to log out of your account?"
              confirmText="Yes"
              cancelText="No"
              confirmButtonClass="bg-red-600 hover:bg-red-700"
              onConfirm={handleLogout}
              onCancel={() => setShowLogoutConfirm(false)}
            />
          </div>
        </div>
      </div>
    </header>
  );
};
