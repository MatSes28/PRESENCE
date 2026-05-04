type SessionSyncSnapshot = {
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
};

const sessionSyncState: SessionSyncSnapshot = {
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function recordSessionSyncSuccess(): void {
  sessionSyncState.lastSuccessAt = new Date().toISOString();
  sessionSyncState.lastFailureAt = null;
  sessionSyncState.lastFailureMessage = null;
}

export function recordSessionSyncFailure(error: unknown): void {
  sessionSyncState.lastFailureAt = new Date().toISOString();
  sessionSyncState.lastFailureMessage = getErrorMessage(error);
}

export function getSessionSyncHealth(): SessionSyncSnapshot & {
  status: "ok" | "degraded";
} {
  return {
    status: sessionSyncState.lastFailureAt ? "degraded" : "ok",
    ...sessionSyncState,
  };
}
