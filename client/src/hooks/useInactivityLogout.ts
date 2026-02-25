import { useEffect, useRef, useCallback } from "react";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export type OnInactivityCallback = (reason: "idle" | "expired") => void;

/**
 * Calls onLogout after 10 minutes of no user activity (mouse, keyboard, touch, scroll).
 * Resets the timer on any activity. Only runs when active is true (e.g. user is logged in).
 */
export function useInactivityLogout(
  active: boolean,
  onLogout: OnInactivityCallback
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const resetTimer = useCallback(() => {
    if (!active) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onLogoutRef.current("idle");
    }, INACTIVITY_MS);
  }, [active]);

  useEffect(() => {
    if (!active) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    resetTimer();

    const handleActivity = () => resetTimer();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, handleActivity, { passive: true });
    }

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, handleActivity);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, resetTimer]);
}
