import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { ConfirmationDialog } from "./ConfirmationDialog";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/attendance": "Live Attendance",
  "/schedule": "Schedule",
  "/students": "Students",
  "/roster": "Class Roster",
  "/monitor": "Monitor",
  "/iot": "IoT Devices",
  "/health": "System Health",
  "/testing": "System Testing",
  "/reports": "Reports",
  "/users": "User Management",
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

  const currentTitle = pageTitles[location] || "Dashboard";

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  return (
    <header className="bg-gray-800 shadow-sm border-b border-gray-700 px-4 md:px-6 py-4 pt-safe-top ios-safe-header ios-gesture-area">
      <div className="flex items-center justify-between">
        {/* Mobile Menu Button */}
        {showMenuButton && (
          <button
            data-sidebar-toggle
            onClick={onMenuClick}
            className="md:hidden p-2 mr-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors ios-button ios-touch-target ios-gesture-area"
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
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-cyan-400 truncate ios-font-optimized">
            {currentTitle}
          </h1>
          <nav className="text-sm text-gray-400 hidden sm:block">
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
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
            🔔
          </button>

          {/* User Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center space-x-3 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors"
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
