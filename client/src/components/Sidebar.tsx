import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: ("admin" | "faculty")[];
}

const navigationItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: "📊", roles: ["admin", "faculty"] },
  {
    path: "/attendance",
    label: "Live Attendance",
    icon: "📍",
    roles: ["admin", "faculty"],
  },
  {
    path: "/schedule",
    label: "Schedule",
    icon: "📅",
    roles: ["admin", "faculty"],
  },
  {
    path: "/students",
    label: "Students",
    icon: "👥",
    roles: ["admin", "faculty"],
  },
  {
    path: "/roster",
    label: "Class Roster",
    icon: "📋",
    roles: ["admin", "faculty"],
  },
  {
    path: "/lab-computers",
    label: "Lab Computers",
    icon: "💻",
    roles: ["admin", "faculty"],
  },
  {
    path: "/reports",
    label: "Reports",
    icon: "📈",
    roles: ["admin", "faculty"],
  },
  { path: "/users", label: "User Management", icon: "👤", roles: ["admin"] },
  {
    path: "/subjects",
    label: "Subjects",
    icon: "📚",
    roles: ["admin", "faculty"],
  },
  {
    path: "/settings",
    label: "Settings",
    icon: "⚙️",
    roles: ["admin", "faculty"],
  },
];

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const filteredNavItems = navigationItems.filter(
    (item) =>
      user?.role && item.roles.includes(user.role as "admin" | "faculty")
  );

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  return (
    <div className="w-64 bg-gray-900 shadow-lg flex flex-col ios-scroll ios-safe-area">
      {/* Logo and Branding */}
      <div className="p-6 border-b border-gray-700 ios-safe-top">
        <h1 className="text-xl font-bold text-cyan-400 ios-font-optimized">
          CLIRDEC Presence
        </h1>
        <p className="text-sm text-gray-300">Attendance System</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 ios-scroll">
        <ul className="space-y-2">
          {filteredNavItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <a
                  onClick={onCloseMobile}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ios-button ios-touch-target ios-gesture-area ${
                    location === item.path
                      ? "bg-cyan-600 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-gray-700 ios-safe-bottom">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center text-white font-semibold ios-touch-target">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white ios-font-optimized">
              {user?.name}
            </p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-900 rounded-lg transition-colors ios-button ios-touch-target"
        >
          🚪 Logout
        </button>
      </div>

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
  );
};
