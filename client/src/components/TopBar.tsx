import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
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
  "/roles": "Roles",
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
  const { user } = useAuth();
  const [location] = useLocation();
  const [liveState, setLiveState] =
    useState<WebSocketConnectionState>("disconnected");

  const currentTitle =
    pageTitles[location] ||
    (location.startsWith("/students/") ? "Student Details" : "Dashboard");

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
    <header className="border-b border-gray-700 bg-gray-800 px-2 py-4 pt-safe-top shadow-sm ios-safe-header ios-gesture-area sm:px-4 md:px-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Mobile Menu Button */}
        {showMenuButton && (
          <button
            data-sidebar-toggle
            onClick={onMenuClick}
            className="mr-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white ios-button ios-touch-target ios-gesture-area md:hidden sm:mr-4"
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
          <h1 className="truncate text-lg font-semibold text-cyan-400 ios-font-optimized sm:text-xl md:text-2xl">
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
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className="hidden items-center gap-2 text-xs text-gray-300 lg:flex"
            title={liveLabel}
          >
            <span className={`w-2 h-2 rounded-full ${liveDotClass}`}></span>
            <span>{liveLabel}</span>
          </div>

        </div>
      </div>
    </header>
  );
};
