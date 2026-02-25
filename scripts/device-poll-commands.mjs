#!/usr/bin/env node
/**
 * Example: poll for pending commands from the PRESENCE API (Test RFID Reader / Calibrate Sensors).
 * Use this from a device or gateway, or adapt for ESP32/firmware.
 *
 * Usage:
 *   API_BASE_URL=https://your-api.com DEVICE_API_KEY=pk_your_device_key node scripts/device-poll-commands.mjs
 *   Or with defaults (local): node scripts/device-poll-commands.mjs
 *
 * The script polls GET /api/iot/commands every 15 seconds. For each command it logs and acks via
 * POST /api/iot/commands/:commandId/ack. Implement your own actions (e.g. run test, run calibrate)
 * in the handleCommand function.
 */

const POLL_INTERVAL_MS = 15_000;
const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.DEVICE_API_KEY || "";

if (!API_KEY) {
  console.error("Set DEVICE_API_KEY (device API key from IoT Devices in the app).");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-Device-Api-Key": API_KEY,
};

async function fetchCommands() {
  const res = await fetch(`${API_BASE}/api/iot/commands`, { headers });
  if (!res.ok) {
    throw new Error(`Commands request failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function ackCommand(commandId) {
  const res = await fetch(`${API_BASE}/api/iot/commands/${commandId}/ack`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    throw new Error(`Ack failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function handleCommand(cmd) {
  // Implement your device behavior here (e.g. blink LED for "test", run calibration for "calibrate")
  console.log(`[Command] ${cmd.command}`, cmd.payload || "");
  if (cmd.command === "test") {
    // e.g. trigger reader self-test, blink LED
  }
  if (cmd.command === "calibrate") {
    // e.g. run sensor calibration
  }
  if (cmd.command === "restart") {
    // e.g. schedule device restart
  }
}

async function pollOnce() {
  try {
    const data = await fetchCommands();
    if (!data.success || !Array.isArray(data.commands) || data.commands.length === 0) {
      return;
    }
    for (const cmd of data.commands) {
      handleCommand(cmd);
      await ackCommand(cmd.id);
      console.log(`[Ack] ${cmd.id}`);
    }
  } catch (err) {
    console.error("[Poll error]", err.message);
  }
}

console.log(`Polling ${API_BASE}/api/iot/commands every ${POLL_INTERVAL_MS / 1000}s`);
pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);
