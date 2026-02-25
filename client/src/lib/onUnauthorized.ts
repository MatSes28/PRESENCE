/**
 * Global callback for 401 Unauthorized. Set by the app so the API client
 * can trigger "session expired" message and logout without coupling to React.
 */
let on401: (() => void) | null = null;

export function setOn401(callback: (() => void) | null): void {
  on401 = callback;
}

export function getOn401(): (() => void) | null {
  return on401;
}

export function triggerOn401(): void {
  on401?.();
}
