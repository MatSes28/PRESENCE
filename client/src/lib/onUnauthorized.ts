/**
 * Global callback for 401 Unauthorized. Set by the app so the API client
 * can trigger "session expired" message and logout without coupling to React.
 */
let on401: (() => void) | null = null;
let lastTriggerAt = 0;
const TRIGGER_COOLDOWN_MS = 1500;

export function setOn401(callback: (() => void) | null): void {
  on401 = callback;
}

export function getOn401(): (() => void) | null {
  return on401;
}

export function triggerOn401(): void {
  const now = Date.now();
  if (now - lastTriggerAt < TRIGGER_COOLDOWN_MS) {
    return;
  }

  lastTriggerAt = now;
  on401?.();
}
