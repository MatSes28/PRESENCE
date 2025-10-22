import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/attendance": "Live Attendance",
  "/schedule": "Schedule",
  "/students": "Students",
  "/roster": "Class Roster",
  "/lab-computers": "Lab Computers",
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

export const TopBar: React.FC = () => {
  const { user } = useAuth();
  const [location] = useLocation();

  const currentTitle = pageTitles[location] || "Dashboard";

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Page Title / Breadcrumb */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {currentTitle}
          </h1>
          <nav className="text-sm text-gray-500">
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
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            🔔
          </button>

          {/* User Avatar Dropdown */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
