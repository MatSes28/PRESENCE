/**
 * Emergency stop flag for RFID processing.
 * Uses Redis when available (multi-server); falls back to in-memory.
 */

import { cacheService } from "./cacheService.js";

const REDIS_KEY = "rfid_emergency_stop";
const REDIS_TTL = 86400; // 24 hours

let inMemoryFlag = false;

export async function isEmergencyStopActive(): Promise<boolean> {
  try {
    const cached = await cacheService.get<string>(REDIS_KEY);
    if (cached !== null && cached !== undefined) {
      return cached === "1";
    }
  } catch {
    // Redis down: use in-memory
  }
  return inMemoryFlag;
}

export async function setEmergencyStop(active: boolean): Promise<void> {
  inMemoryFlag = active;
  try {
    if (active) {
      await cacheService.set(REDIS_KEY, "1", { ttl: REDIS_TTL });
    } else {
      await cacheService.delete(REDIS_KEY);
    }
  } catch {
    // Redis down: in-memory still updated
  }
}
