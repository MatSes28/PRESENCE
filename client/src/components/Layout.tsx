import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false); // Close mobile sidebar on desktop
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
          !target.closest("[data-sidebar]") &&
          !target.closest("[data-sidebar-toggle]")
        ) {
          setSidebarOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMobile, sidebarOpen]);

  return (
    <div className="flex min-h-screen-ios bg-gray-900 pt-safe-top pb-safe-bottom ios-safe-area ios-dark-mode ios-font-optimized">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden ios-modal"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        data-sidebar
        className={`
          ${
            isMobile
              ? `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ios-optimized-animation ${
                  sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`
              : "relative w-64"
          }
          bg-gray-800 border-r border-gray-700 ios-scroll
        `}
      >
        <Sidebar onCloseMobile={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <TopBar
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          showMenuButton={isMobile}
        />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900 px-4 py-6 md:px-6 md:py-6 pb-safe-bottom ios-scroll">
          <div className="max-w-full mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
