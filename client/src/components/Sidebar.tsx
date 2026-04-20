import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: ("admin" | "faculty")[];
}

interface NavSection {
  title: string;
  icon: string;
  items: NavItem[];
  roles: ("admin" | "faculty")[];
  defaultOpen?: boolean;
}

// Define navigation hierarchy - Enterprise-grade university attendance system
const navigationSections: NavSection[] = [
  {
    title: "Dashboard",
    icon: "📊",
    roles: ["admin", "faculty"],
    items: [
      { path: "/", label: "Overview", icon: "📊", roles: ["admin", "faculty"] },
    ],
    defaultOpen: true,
  },
  {
    title: "Attendance",
    icon: "📍",
    roles: ["admin", "faculty"],
    items: [
      {
        path: "/attendance",
        label: "Take Attendance",
        icon: "🎯",
        roles: ["admin", "faculty"],
      },
      {
        path: "/discrepancies",
        label: "Discrepancies",
        icon: "⚠️",
        roles: ["admin", "faculty"],
      },
      {
        path: "/roster",
        label: "Attendance Records",
        icon: "📋",
        roles: ["admin", "faculty"],
      },
    ],
  },
  {
    title: "Management",
    icon: "⚙️",
    roles: ["admin", "faculty"],
    items: [
      {
        path: "/students",
        label: "Students",
        icon: "👥",
        roles: ["admin", "faculty"],
      },
      { path: "/faculty", label: "Faculty", icon: "👨‍🏫", roles: ["admin"] },
      {
        path: "/subjects",
        label: "Courses",
        icon: "📚",
        roles: ["admin", "faculty"],
      },
      {
        path: "/schedule",
        label: "Schedules",
        icon: "📅",
        roles: ["admin", "faculty"],
      },
      {
        path: "/classrooms",
        label: "Rooms",
        icon: "🏫",
        roles: ["admin"],
      },
      {
        path: "/iot",
        label: "IoT Devices",
        icon: "📡",
        roles: ["admin"],
      },
      {
        path: "/enrollments",
        label: "Enrollments",
        icon: "📝",
        roles: ["admin"],
      },
    ],
  },
  {
    title: "Reports",
    icon: "📈",
    roles: ["admin", "faculty"],
    items: [
      {
        path: "/reports",
        label: "Attendance Summary",
        icon: "📊",
        roles: ["admin", "faculty"],
      },
      {
        path: "/ai-analytics",
        label: "Analytics",
        icon: "🤖",
        roles: ["admin", "faculty"],
      },
    ],
  },
  {
    title: "Settings",
    icon: "⚙️",
    roles: ["admin", "faculty"],
    items: [
      {
        path: "/settings",
        label: "System Settings",
        icon: "🔧",
        roles: ["admin"],
      },
      {
        path: "/users",
        label: "User Management",
        icon: "👤",
        roles: ["admin"],
      },
      {
        path: "/roles",
        label: "User Management",
        icon: "🔐",
        roles: ["admin"],
      },
    ],
  },
];

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  // Initialize expanded sections based on active route
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    navigationSections.forEach((section) => {
      // Expand section if it contains the current path
      const hasActiveItem = section.items.some(
        (item) => item.path === location,
      );
      initialExpanded[section.title] =
        hasActiveItem || section.defaultOpen || false;
    });
    setExpandedSections(initialExpanded);
  }, []);

  // Toggle section expansion
  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Filter sections by role
  const filteredSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          user?.role && item.roles.includes(user.role as "admin" | "faculty"),
      ),
    }))
    .filter((section) => section.items.length > 0);

  // Check if a path is active (improved logic for exact and prefix matching)
  const isActive = (path: string) => {
    // Exact match for root
    if (path === "/") return location === "/";
    // Exact match or child route
    return location === path || location.startsWith(path + "/");
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  return (
    <div className="flex w-64 flex-col bg-gray-900 shadow-lg ios-scroll ios-safe-area">
      {/* Logo and Branding */}
      <div className="border-b border-gray-700 p-4 ios-safe-top">
        <h1 className="text-lg font-bold text-cyan-400 ios-font-optimized truncate">
          CLIRDEC Presence
        </h1>
        <p className="mt-2 text-xs text-gray-400">Attendance System</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4 ios-scroll">
        {filteredSections.map((section) => {
          const isExpanded = expandedSections[section.title] !== false;

          return (
            <div key={section.title} className="mb-4">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.title)}
                aria-expanded={isExpanded}
                aria-controls={`sidebar-section-${section.title.replace(/\s+/g, "-").toLowerCase()}`}
                className="flex w-full items-center justify-between rounded-lg px-4 py-2 text-gray-300 transition-colors hover:bg-gray-800 ios-button"
              >
                <div className="flex items-center">
                  <span className="mr-4">{section.icon}</span>
                  <span className="font-medium text-sm">{section.title}</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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

              {/* Section Items */}
              {isExpanded && (
                <ul
                  id={`sidebar-section-${section.title.replace(/\s+/g, "-").toLowerCase()}`}
                  className="ml-4 mt-2 space-y-2 border-l-2 border-gray-700"
                >
                  {section.items.map((item) => (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        onClick={onCloseMobile}
                        className={`flex items-center rounded-r-lg py-2 pl-4 pr-4 text-sm transition-colors ios-button ios-touch-target ${
                          isActive(item.path)
                            ? "bg-cyan-600 text-white border-l-2 border-cyan-400 -ml-0.5"
                            : "text-gray-400 hover:bg-gray-700 hover:text-white"
                        }`}
                      >
                        <span className="mr-4">{item.icon}</span>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-gray-700 p-4 ios-safe-bottom">
        <div className="mb-4 flex items-center">
          <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="ml-4 flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.name}
            </p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="flex w-full items-center rounded-lg px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-900/30 ios-button ios-touch-target"
        >
          <span className="mr-4">🚪</span>
          Logout
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
