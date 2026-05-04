import React from "react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("admin" | "faculty")[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      setLocation(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    if (!allowedRoles.includes(user.role as "admin" | "faculty")) {
      setLocation("/");
    }
  }, [user, allowedRoles, setLocation]);

  if (!user) {
    return null;
  }

  if (!allowedRoles.includes(user.role as "admin" | "faculty")) {
    return null;
  }

  return <>{children}</>;
};
