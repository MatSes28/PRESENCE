import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

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
    path: "/settings",
    label: "Settings",
    icon: "⚙️",
    roles: ["admin", "faculty"],
  },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const filteredNavItems = navigationItems.filter(
    (item) =>
      user?.role && item.roles.includes(user.role as "admin" | "faculty")
  );

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      {/* Logo and Branding */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">CLIRDEC Presence</h1>
        <p className="text-sm text-gray-600">Attendance System</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {filteredNavItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <a
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    location === item.path
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
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
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
};
