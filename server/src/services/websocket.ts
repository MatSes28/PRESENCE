import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import db from "../storage.js";
import { iotDevices } from "../schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { cacheService } from "./cacheService.js";
import { getAuthenticatedSessionFromRequest } from "../session.js";

interface WebSocketClient extends WebSocket {
  deviceId?: string;
  userId?: number;
  userRole?: string;
  isAlive?: boolean;
  // Device auth token captured from query param on connect.
  // Used for optional signed-event verification.
  deviceAuthToken?: string;
  deviceAuthType?: "apiKey" | "certificate";
}

interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
  // Signed event envelope fields (Phase 2: integrity & anti-replay)
  nonce?: string;
  signature?: string;
  v?: number;
}

const clients = new Map<string, WebSocketClient>();
const deviceClients = new Map<string, WebSocketClient>();

type DeviceAuthResult =
  | { ok: true; authType: "apiKey" | "certificate" }
  | { ok: false; reason: string };

// Device authentication function
async function authenticateDevice(
  deviceId: string,
  authToken?: string | null,
): Promise<DeviceAuthResult> {
  try {
    // Import iotDeviceManager dynamically to avoid circular imports
    const { iotDeviceManager } = await import("./iotDeviceManager.js");

    // Check if device exists and is active
    const device = await db
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.deviceId, deviceId))
      .limit(1);

    if (device.length === 0) {
      console.log(`Device ${deviceId} not found in database`);
      return { ok: false, reason: "device_not_found" };
    }

    const dbDevice = device[0];

    // Check if device is active
    if (!dbDevice.isActive) {
      console.log(`Device ${deviceId} is not active`);
      return { ok: false, reason: "device_inactive" };
    }

    // If no auth token provided, deny access
    if (!authToken) {
      console.log(
        `Device ${deviceId} attempted connection without authentication token`,
      );
      return { ok: false, reason: "missing_auth_token" };
    }

    // Try API key authentication first
    const apiKeyAuth =
      await iotDeviceManager.authenticateDeviceByApiKey(authToken);
    if (apiKeyAuth && apiKeyAuth.deviceId === deviceId) {
      console.log(`Device ${deviceId} authenticated successfully via API key`);
      return { ok: true, authType: "apiKey" };
    }

    // Try certificate fingerprint authentication
    const certAuth =
      await iotDeviceManager.authenticateDeviceByCertificate(authToken);
    if (certAuth && certAuth.deviceId === deviceId) {
      console.log(
        `Device ${deviceId} authenticated successfully via certificate`,
      );
      return { ok: true, authType: "certificate" };
    }

    console.log(`Device ${deviceId} authentication failed - invalid token`);
    return { ok: false, reason: "invalid_token" };
  } catch (error) {
    console.error("Device authentication error:", error);
    return { ok: false, reason: "auth_error" };
  }
}

function isProductionLike(): boolean {
  const env = (process.env.NODE_ENV || "").toLowerCase();
  if (env === "production") return true;
  // Railway sets RAILWAY_ENVIRONMENT (commonly "production")
  if ((process.env.RAILWAY_ENVIRONMENT || "").toLowerCase() === "production") {
    return true;
  }
  return false;
}

function requireSignedDeviceEvents(): boolean {
  // In production-like environments, require signed events by default.
  // In development, allow unsigned events unless explicitly required.
  const forced = (process.env.IOT_REQUIRE_SIGNED_EVENTS || "").toLowerCase();
  if (forced === "true" || forced === "1" || forced === "yes") return true;
  if (forced === "false" || forced === "0" || forced === "no") return false;
  return isProductionLike();
}

function extractDeviceAuthToken(
  request: IncomingMessage,
  url: URL,
): { token?: string; source?: "header" | "subprotocol" | "query" } {
  const authHeader = request.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.trim()) {
    const bearerPrefix = /^Bearer\s+/i;
    const token = authHeader.replace(bearerPrefix, "").trim();
    if (token) return { token, source: "header" };
  }

  const apiKeyHeader = request.headers["x-device-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.trim()) {
    return { token: apiKeyHeader.trim(), source: "header" };
  }

  const protocols = request.headers["sec-websocket-protocol"];
  if (typeof protocols === "string" && protocols.trim()) {
    const parts = protocols
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const token = parts[parts.length - 1];
      if (token) return { token, source: "subprotocol" };
    }
  }

  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken) return { token: queryToken, source: "query" };

  return {};
}

function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();

  const normalize = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v !== "object") return v;
    if (seen.has(v)) {
      throw new Error("Cyclic structure in payload");
    }
    seen.add(v);

    if (Array.isArray(v)) {
      return v.map(normalize);
    }

    const out: Record<string, any> = {};
    for (const key of Object.keys(v).sort()) {
      out[key] = normalize(v[key]);
    }
    return out;
  };

  return JSON.stringify(normalize(value));
}

function safeTimingEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Minimal in-memory anti-replay cache.
// TODO (Phase 2 item 15): persist via Redis/DB so restarts don't reset replay window.
const recentNoncesByDevice = new Map<string, Map<string, number>>();
const lastTimestampByDevice = new Map<string, number>();

function validateTimestampWindow(tsMs: number) {
  const WINDOW_MS = 2 * 60 * 1000; // accept +/- 2 minutes clock skew
  const now = Date.now();
  if (Math.abs(now - tsMs) > WINDOW_MS) {
    throw new Error("timestamp_out_of_window");
  }
}

function checkReplay(deviceId: string, tsMs: number, nonce: string) {
  const WINDOW_MS = 2 * 60 * 1000;

  // Enforce monotonic-ish timestamps (allow small backward skew).
  const lastTs = lastTimestampByDevice.get(deviceId);
  if (lastTs !== undefined && tsMs + WINDOW_MS < lastTs) {
    throw new Error("timestamp_replay");
  }

  const deviceNonces = recentNoncesByDevice.get(deviceId);
  if (deviceNonces?.has(nonce)) {
    throw new Error("nonce_replay");
  }
}

async function checkReplayPersisted(
  deviceId: string,
  tsMs: number,
  nonce: string,
) {
  if (!cacheService.available()) return;

  const WINDOW_MS = 2 * 60 * 1000;
  const lastTs = await cacheService.getDeviceLastTimestamp(deviceId);
  if (lastTs !== null && tsMs + WINDOW_MS < lastTs) {
    throw new Error("timestamp_replay");
  }

  const acquired = await cacheService.acquireDeviceNonce({
    deviceId,
    nonce,
    ttlSeconds: 10 * 60,
  });
  if (!acquired) {
    throw new Error("nonce_replay");
  }
}

function markSeen(deviceId: string, tsMs: number, nonce: string) {
  const NONCE_TTL_MS = 10 * 60 * 1000; // keep nonces for 10 minutes
  const now = Date.now();

  const lastTs = lastTimestampByDevice.get(deviceId);
  if (lastTs === undefined || tsMs > lastTs) {
    lastTimestampByDevice.set(deviceId, tsMs);
  }

  let deviceNonces = recentNoncesByDevice.get(deviceId);
  if (!deviceNonces) {
    deviceNonces = new Map();
    recentNoncesByDevice.set(deviceId, deviceNonces);
  }

  // Cleanup expired nonces opportunistically.
  for (const [n, usedAt] of deviceNonces) {
    if (now - usedAt > NONCE_TTL_MS) deviceNonces.delete(n);
  }

  deviceNonces.set(nonce, now);
}

async function markSeenPersisted(deviceId: string, tsMs: number) {
  if (!cacheService.available()) return;
  await cacheService.setDeviceLastTimestamp(deviceId, tsMs, 10 * 60);
}

async function verifySignedDeviceEvent(
  ws: WebSocketClient,
  message: WSMessage,
  deviceId: string,
): Promise<void> {
  // Only verify for device-originated attendance/security-sensitive events.
  const SIGNED_TYPES = new Set([
    "rfid_scan",
    "sensor_trigger",
    "attendance_record",
    "heartbeat",
  ]);

  if (!SIGNED_TYPES.has(message.type)) return;

  const mustVerify = requireSignedDeviceEvents();
  const hasEnvelope = !!message.signature || !!message.nonce || !!message.v;

  if (ws.deviceAuthType !== "apiKey") {
    // We cannot verify HMAC signatures without a shared secret.
    // Certificate-based auth *may* rely on mTLS at the reverse proxy; if not present,
    // signature verification is recommended.
    if (mustVerify && hasEnvelope) {
      // If device sends a signed envelope but we can't verify (no apiKey), fail closed.
      throw new Error("unsupported_auth_for_signed_events");
    }
    if (mustVerify) {
      throw new Error("signed_events_required_but_no_shared_secret");
    }
    return;
  }

  if (!ws.deviceAuthToken) {
    if (mustVerify) throw new Error("missing_device_auth_token");
    return;
  }

  // If policy requires signing, enforce envelope presence.
  if (mustVerify) {
    if (!message.timestamp) throw new Error("missing_timestamp");
    if (!message.nonce) throw new Error("missing_nonce");
    if (!message.signature) throw new Error("missing_signature");
  } else {
    // If not required and no signature provided, accept.
    if (!message.signature) return;
    if (!message.timestamp || !message.nonce) {
      throw new Error("partial_signature_envelope");
    }
  }

  const tsMs = Date.parse(message.timestamp!);
  if (!Number.isFinite(tsMs)) throw new Error("invalid_timestamp");

  validateTimestampWindow(tsMs);

  const nonce = String(message.nonce || "");
  if (nonce.length < 8 || nonce.length > 128) throw new Error("invalid_nonce");

  // Replay checks without side-effects; we only mark as seen after signature passes.
  checkReplay(deviceId, tsMs, nonce);
  await checkReplayPersisted(deviceId, tsMs, nonce);

  // Signature: HMAC-SHA256 over a canonical string.
  // IMPORTANT: use canonical JSON for payload to avoid signature ambiguity.
  const payloadJson = canonicalJson(message.payload ?? null);
  const payloadHash = crypto
    .createHash("sha256")
    .update(payloadJson)
    .digest("hex");
  const stringToSign = `${deviceId}|${message.type}|${message.timestamp}|${nonce}|${payloadHash}`;
  const expectedSig = crypto
    .createHmac("sha256", ws.deviceAuthToken)
    .update(stringToSign)
    .digest("hex");

  const providedSig = String(message.signature || "");
  if (!safeTimingEqualHex(providedSig, expectedSig)) {
    throw new Error("invalid_signature");
  }

  // Signature valid => mark nonce/timestamp as seen.
  markSeen(deviceId, tsMs, nonce);
  await markSeenPersisted(deviceId, tsMs);
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on(
    "connection",
    async (ws: WebSocketClient, request: IncomingMessage) => {
      const url = new URL(request.url || "", "http://localhost");
      const isDevice = url.pathname === "/iot";
      const deviceId = url.searchParams.get("deviceId");
      const userId = url.searchParams.get("userId");
      const authTokenInfo = extractDeviceAuthToken(request, url);
      const authToken = authTokenInfo.token;
      const authenticatedSession = !isDevice
        ? await getAuthenticatedSessionFromRequest(request)
        : null;
      const authenticatedUserId = authenticatedSession?.sessionData?.userId
        ? Number(authenticatedSession.sessionData.userId)
        : null;
      const authenticatedUserRole =
        authenticatedSession?.sessionData?.userRole || null;

      console.log(`New ${isDevice ? "device" : "web"} connection:`, {
        deviceId,
        userId: authenticatedUserId ?? userId,
        remoteAddress: request.socket?.remoteAddress,
      });

      // Authenticate device connections
      if (isDevice && deviceId) {
        if (authTokenInfo.source === "query" && isProductionLike()) {
          ws.send(
            JSON.stringify({
              type: "error",
              payload: {
                message:
                  "Authentication via query token is disabled in production",
              },
              timestamp: new Date().toISOString(),
            }),
          );
          ws.close(1008, "Insecure auth transport");
          return;
        }

        const auth = await authenticateDevice(deviceId, authToken);
        if (!auth.ok) {
          console.log(`Device authentication failed for ${deviceId}`);
          ws.send(
            JSON.stringify({
              type: "error",
              payload: { message: "Authentication failed" },
              timestamp: new Date().toISOString(),
            }),
          );
          ws.close(1008, "Authentication failed");
          return;
        }
        ws.deviceId = deviceId;
        ws.deviceAuthToken = authToken || undefined;
        ws.deviceAuthType = auth.authType;
        console.log(`Device ${deviceId} authenticated successfully`);
      } else if (!authenticatedUserId) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Authentication required" },
            timestamp: new Date().toISOString(),
          }),
        );
        ws.close(1008, "Authentication required");
        return;
      }

      // Setup ping/pong for connection health
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on("message", async (data: Buffer) => {
        let message: WSMessage;

        try {
          message = JSON.parse(data.toString());
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              payload: { message: "Invalid JSON" },
              timestamp: new Date().toISOString(),
            }),
          );
          return;
        }

        if (isDevice) {
          if (!deviceId) {
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { message: "Missing deviceId" },
                timestamp: new Date().toISOString(),
              }),
            );
            return;
          }

          try {
            // Phase 2: signed event envelopes + anti-replay.
            await verifySignedDeviceEvent(ws, message, deviceId);
          } catch (err: any) {
            const reason = err?.message || "integrity_check_failed";
            console.warn(
              `Device message integrity check failed for ${deviceId}: ${reason}`,
            );
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { message: "Integrity check failed", reason },
                timestamp: new Date().toISOString(),
              }),
            );
            if (requireSignedDeviceEvents()) {
              ws.close(1008, "Integrity check failed");
            }
            return;
          }

          void handleDeviceMessage(ws, message, deviceId).catch((err) => {
            console.error("Error handling device message:", err);
          });
        } else {
          try {
            handleWebMessage(ws, message, String(authenticatedUserId));
          } catch (error) {
            console.error("Failed to handle web message:", error);
          }
        }
      });

      // Handle connection close
      ws.on("close", async () => {
        if (isDevice && deviceId) {
          deviceClients.delete(deviceId);
          console.log(`Device disconnected: ${deviceId}`);

          // Update device status to offline
          try {
            const { iotDeviceManager } = await import("./iotDeviceManager.js");
            await iotDeviceManager.updateDeviceStatus(deviceId, "offline");
            console.log(`Device ${deviceId} status updated to offline`);
          } catch (error) {
            console.error(
              `Error updating device status for ${deviceId}:`,
              error,
            );
          }
        } else if (authenticatedUserId) {
          clients.delete(authenticatedUserId.toString());
          console.log(`Web client disconnected: ${authenticatedUserId}`);
        }
      });

      // Handle errors
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      // Register client
      if (isDevice && deviceId) {
        ws.deviceId = deviceId;
        deviceClients.set(deviceId, ws);
      } else if (authenticatedUserId) {
        ws.userId = authenticatedUserId;
        ws.userRole = authenticatedUserRole || undefined;
        clients.set(String(authenticatedUserId), ws);
      }

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "connected",
          payload: {
            message: `Connected to CLIRDEC:PRESENCE ${
              isDevice ? "IoT" : "Web"
            } server`,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        }),
      );
    },
  );

  // Connection health check
  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocketClient) => {
      if (ws.isAlive === false) {
        if (ws.deviceId) {
          deviceClients.delete(ws.deviceId);
        } else if (ws.userId) {
          clients.delete(ws.userId.toString());
        }
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // 30 seconds

  wss.on("close", () => {
    clearInterval(interval);
  });
}

async function handleDeviceMessage(
  ws: WebSocketClient,
  message: WSMessage,
  deviceId?: string | null,
) {
  if (!deviceId) {
    console.error("Device message received without deviceId");
    return;
  }

  // Import iotDeviceManager dynamically to avoid circular imports
  const { iotDeviceManager } = await import("./iotDeviceManager.js");

  // Validate and authorize the command
  const validation = await iotDeviceManager.validateAndAuthorizeCommand(
    deviceId,
    message.type,
    message.payload,
  );

  if (!validation.authorized) {
    console.log(
      `Command validation failed for device ${deviceId}: ${validation.reason}`,
    );
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          message: "Command not authorized",
          reason: validation.reason,
        },
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  switch (message.type) {
    case "rfid_scan":
      // Handle RFID scan from ESP32
      console.log(
        `[RFID SCAN] Received from device ${deviceId}: ${message.payload.rfidUid}`,
      );

      let processingResult = null;

      try {
        // Process the RFID scan through attendance monitor
        const { attendanceMonitor } = await import("./attendanceMonitor.js");
        console.log(`[RFID SCAN] Calling attendanceMonitor.processRFIDScan`);
        processingResult = await attendanceMonitor.processRFIDScan({
          deviceId,
          rfidUid: message.payload.rfidUid,
          timestamp: message.payload.timestamp || new Date().toISOString(),
        });

        console.log(`[RFID SCAN] Processing result:`, processingResult);
      } catch (error) {
        console.error(`[RFID SCAN] Error processing RFID scan:`, error);
        processingResult = { success: false, message: error.message };
      }

      broadcastToWebClients("rfid_scan", {
        deviceId,
        rfidUid: message.payload.rfidUid,
        timestamp: message.payload.timestamp || new Date().toISOString(),
        processingResult,
      });
      break;

    case "sensor_trigger":
      // Handle ultrasonic sensor trigger
      {
        let processingResult: any = null;
        try {
          const { attendanceMonitor } = await import("./attendanceMonitor.js");
          processingResult = await attendanceMonitor.processSensorTrigger({
            deviceId,
            sensorType: message.payload.sensorType,
            distance: message.payload.distance,
            timestamp: message.payload.timestamp || new Date().toISOString(),
          });
        } catch (error: any) {
          console.error(
            `[SENSOR TRIGGER] Error processing sensor trigger from ${deviceId}:`,
            error,
          );
          processingResult = {
            success: false,
            message: error?.message || "Error",
          };
        }

        broadcastToWebClients("sensor_trigger", {
          deviceId,
          sensorType: message.payload.sensorType, // 'entry' or 'exit'
          distance: message.payload.distance,
          timestamp: message.payload.timestamp || new Date().toISOString(),
          processingResult,
        });
      }
      break;

    case "attendance_record":
      // Handle complete attendance record
      broadcastToWebClients("attendance_record", {
        deviceId,
        ...message.payload,
        timestamp: message.payload.timestamp || new Date().toISOString(),
      });
      break;

    case "heartbeat":
      // Device heartbeat - update status and record heartbeat
      console.log(`Heartbeat from device ${deviceId}`);

      try {
        // Update device status to online and last seen
        await iotDeviceManager.updateDeviceStatus(deviceId, "online");

        // Record heartbeat using the device manager method
        await iotDeviceManager.recordHeartbeat(deviceId, message.payload || {});

        console.log(`Heartbeat recorded for device ${deviceId}`);
      } catch (error) {
        console.error(
          `Error processing heartbeat for device ${deviceId}:`,
          error,
        );
      }
      break;

    case "ping":
      // Respond to ping
      ws.send(
        JSON.stringify({
          type: "pong",
          payload: { message: "pong" },
          timestamp: new Date().toISOString(),
        }),
      );
      break;

    default:
      console.log(`Unknown device message type: ${message.type}`);
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: `Unknown command: ${message.type}` },
          timestamp: new Date().toISOString(),
        }),
      );
  }
}

function handleWebMessage(
  ws: WebSocketClient,
  message: WSMessage,
  userId?: string | null,
) {
  switch (message.type) {
    case "subscribe_attendance":
      // Web client subscribing to attendance updates
      console.log(`Web client ${userId} subscribed to attendance updates`);
      break;

    case "get_device_status":
      // Send device status to web client
      const deviceStatus = Array.from(deviceClients.entries()).map(
        ([id, client]) => ({
          deviceId: id,
          status: client.readyState === WebSocket.OPEN ? "online" : "offline",
          lastSeen: new Date().toISOString(),
        }),
      );

      ws.send(
        JSON.stringify({
          type: "device_status",
          payload: deviceStatus,
          timestamp: new Date().toISOString(),
        }),
      );
      break;

    default:
      console.log(`Unknown web message type: ${message.type}`);
  }
}

function maskRfidUid(rfidUid?: string) {
  if (!rfidUid) return undefined;

  if (rfidUid.length <= 4) {
    return "*".repeat(rfidUid.length);
  }

  return `${"*".repeat(Math.max(0, rfidUid.length - 4))}${rfidUid.slice(-4)}`;
}

function sanitizeProcessingResult(result: any) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const sanitized = { ...result };

  if (sanitized.student && typeof sanitized.student === "object") {
    sanitized.student = {
      id: sanitized.student.id,
      studentId: sanitized.student.studentId,
      name: sanitized.student.name,
    };
  }

  if (sanitized.session && typeof sanitized.session === "object") {
    sanitized.session = {
      id: sanitized.session.id,
      status: sanitized.session.status,
      date: sanitized.session.date,
      classroomId: sanitized.session.classroomId,
      facultyId: sanitized.session.facultyId,
      subjectId: sanitized.session.subjectId,
      scheduleId: sanitized.session.scheduleId,
    };
  }

  if (typeof sanitized.rfidUid === "string") {
    sanitized.maskedRfidUid = maskRfidUid(sanitized.rfidUid);
    delete sanitized.rfidUid;
  }

  return sanitized;
}

function sanitizeRealtimePayload(type: string, payload: any) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const sanitized = { ...payload };

  if (typeof sanitized.rfidUid === "string") {
    sanitized.maskedRfidUid = maskRfidUid(sanitized.rfidUid);
    delete sanitized.rfidUid;
  }

  if (type === "rfid_scan" || type === "rfidScan") {
    sanitized.cardDetected = true;
  }

  if ("processingResult" in sanitized) {
    sanitized.processingResult = sanitizeProcessingResult(
      sanitized.processingResult,
    );
  }

  if ("result" in sanitized) {
    sanitized.result = sanitizeProcessingResult(sanitized.result);
  }

  return sanitized;
}

function broadcastToWebClients(type: string, payload: any) {
  const message = JSON.stringify({
    type,
    payload: sanitizeRealtimePayload(type, payload),
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function sendToDevice(deviceId: string, type: string, payload: any) {
  const device = deviceClients.get(deviceId);
  if (device && device.readyState === WebSocket.OPEN) {
    device.send(
      JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString(),
      }),
    );
    return true;
  }
  return false;
}

export function getConnectedDevices(): string[] {
  return Array.from(deviceClients.keys());
}

export function getConnectedWebClients(): string[] {
  return Array.from(clients.keys());
}

export { broadcastToWebClients };
