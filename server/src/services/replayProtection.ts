import { cacheService } from "./cacheService.js";

/**
 * Phase 2: replay protection for signed IoT events.
 *
 * Goal: prevent nonce reuse and gross timestamp replays across a device fleet.
 *
 * Design notes:
 * - Uses Redis (via cacheService) when available for cross-instance persistence.
 * - Falls back to in-memory state when Redis is not enabled/available.
 * - Intended to be called AFTER signature verification.
 */

const WINDOW_MS = 2 * 60 * 1000; // accept +/- 2 minutes clock skew
const NONCE_TTL_SECONDS = 10 * 60; // keep nonces for 10 minutes
const LAST_TS_TTL_SECONDS = 24 * 60 * 60; // keep per-device last timestamp for 1 day

// In-memory fallback
const memLastTimestampByDevice = new Map<string, number>();
const memNoncesByDevice = new Map<string, Map<string, number>>();

function getNonceKey(deviceId: string, nonce: string) {
  return `replay:${deviceId}:nonce:${nonce}`;
}

function getLastTsKey(deviceId: string) {
  return `replay:${deviceId}:lastTs`;
}

function validateTimestampWindow(tsMs: number) {
  const now = Date.now();
  if (Math.abs(now - tsMs) > WINDOW_MS) {
    throw new Error("timestamp_out_of_window");
  }
}

function memCheckTimestampReplay(deviceId: string, tsMs: number) {
  const lastTs = memLastTimestampByDevice.get(deviceId);
  if (lastTs !== undefined && tsMs + WINDOW_MS < lastTs) {
    throw new Error("timestamp_replay");
  }
}

function memCheckNonceReplay(deviceId: string, nonce: string) {
  const nonces = memNoncesByDevice.get(deviceId);
  if (nonces?.has(nonce)) {
    throw new Error("nonce_replay");
  }
}

function memMarkSeen(deviceId: string, tsMs: number, nonce: string) {
  const now = Date.now();
  const lastTs = memLastTimestampByDevice.get(deviceId);
  if (lastTs === undefined || tsMs > lastTs) {
    memLastTimestampByDevice.set(deviceId, tsMs);
  }

  let nonces = memNoncesByDevice.get(deviceId);
  if (!nonces) {
    nonces = new Map();
    memNoncesByDevice.set(deviceId, nonces);
  }

  // cleanup
  for (const [n, usedAt] of nonces) {
    if (now - usedAt > NONCE_TTL_SECONDS * 1000) nonces.delete(n);
  }

  nonces.set(nonce, now);
}

class ReplayProtectionService {
  async validateAndMark(deviceId: string, tsMs: number, nonce: string) {
    validateTimestampWindow(tsMs);

    // Prefer Redis when available (cross-instance persistence)
    if (cacheService.available()) {
      const lastKey = getLastTsKey(deviceId);
      const lastTs = await cacheService.get<number>(lastKey);

      if (typeof lastTs === "number" && tsMs + WINDOW_MS < lastTs) {
        throw new Error("timestamp_replay");
      }

      const nonceKey = getNonceKey(deviceId, nonce);
      const nonceOk = await cacheService.setIfNotExists(
        nonceKey,
        "1",
        NONCE_TTL_SECONDS,
      );

      if (!nonceOk) {
        throw new Error("nonce_replay");
      }

      // Update lastTs (best-effort). Race conditions are acceptable here.
      if (typeof lastTs !== "number" || tsMs > lastTs) {
        await cacheService.set(lastKey, tsMs, { ttl: LAST_TS_TTL_SECONDS });
      }

      return;
    }

    // In-memory fallback
    memCheckTimestampReplay(deviceId, tsMs);
    memCheckNonceReplay(deviceId, nonce);
    memMarkSeen(deviceId, tsMs, nonce);
  }
}

export const replayProtection = new ReplayProtectionService();
