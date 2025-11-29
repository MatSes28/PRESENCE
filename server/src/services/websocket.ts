import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "../storage.js";
import { iotDevices } from "../schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

interface WebSocketClient extends WebSocket {
  deviceId?: string;
  userId?: number;
  isAlive?: boolean;
}

interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
}

const clients = new Map<string, WebSocketClient>();
const deviceClients = new Map<string, WebSocketClient>();

// Connection limits and monitoring
const MAX_CONNECTIONS = 1000;
const CONNECTION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CONNECTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Track connection metrics
let totalConnections = 0;
let activeConnections = 0;
let peakConnections = 0;

// Connection cleanup function
function cleanupStaleConnections() {
  const now = Date.now();
  let cleaned = 0;

  // Clean up device connections
  for (const [deviceId, client] of deviceClients) {
    if (
      !client.isAlive ||
      ((client as any).lastActivity &&
        now - (client as any).lastActivity > CONNECTION_TIMEOUT)
    ) {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, "Connection timeout");
      }
      deviceClients.delete(deviceId);
      cleaned++;
    }
  }

  // Clean up web client connections
  for (const [userId, client] of clients) {
    if (
      !client.isAlive ||
      ((client as any).lastActivity &&
        now - (client as any).lastActivity > CONNECTION_TIMEOUT)
    ) {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, "Connection timeout");
      }
      clients.delete(userId);
      cleaned++;
    }
  }

  activeConnections = clients.size + deviceClients.size;

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} stale WebSocket connections`);
  }
}

// Start periodic cleanup
setInterval(cleanupStaleConnections, CONNECTION_CLEANUP_INTERVAL);

// Device authentication function
async function authenticateDevice(
  deviceId: string,
  authToken?: string | null
): Promise<boolean> {
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
      return false;
    }

    const dbDevice = device[0];

    // Check if device is active
    if (!dbDevice.isActive) {
      console.log(`Device ${deviceId} is not active`);
      return false;
    }

    // If no auth token provided, deny access
    if (!authToken) {
      console.log(
        `Device ${deviceId} attempted connection without authentication token`
      );
      return false;
    }

    // Try API key authentication first
    const apiKeyAuth = await iotDeviceManager.authenticateDeviceByApiKey(
      authToken
    );
    if (apiKeyAuth && apiKeyAuth.deviceId === deviceId) {
      console.log(`Device ${deviceId} authenticated successfully via API key`);
      return true;
    }

    // Try certificate fingerprint authentication
    const certAuth = await iotDeviceManager.authenticateDeviceByCertificate(
      authToken
    );
    if (certAuth && certAuth.deviceId === deviceId) {
      console.log(
        `Device ${deviceId} authenticated successfully via certificate`
      );
      return true;
    }

    console.log(`Device ${deviceId} authentication failed - invalid token`);
    return false;
  } catch (error) {
    console.error("Device authentication error:", error);
    return false;
  }
}

export function setupWebSocket(wss: WebSocketServer) {
  wss.on(
    "connection",
    async (ws: WebSocketClient, request: IncomingMessage) => {
      // Check connection limits
      const currentConnections = clients.size + deviceClients.size;
      if (currentConnections >= MAX_CONNECTIONS) {
        console.warn(
          `Connection limit reached (${MAX_CONNECTIONS}), rejecting new connection`
        );
        ws.close(1013, "Server is at capacity");
        return;
      }

      const url = new URL(request.url || "", "http://localhost");
      const isDevice = url.pathname === "/iot";
      const deviceId = url.searchParams.get("deviceId");
      const userId = url.searchParams.get("userId");
      const authToken = url.searchParams.get("token");

      // Track connection metrics
      totalConnections++;
      activeConnections = currentConnections + 1;
      peakConnections = Math.max(peakConnections, activeConnections);

      // Add activity tracking
      (ws as any).lastActivity = Date.now();
      (ws as any).connectionId = `${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      console.log(
        `New ${
          isDevice ? "device" : "web"
        } connection (${activeConnections}/${MAX_CONNECTIONS}):`,
        {
          deviceId,
          userId,
          connectionId: (ws as any).connectionId,
          remoteAddress: request.socket?.remoteAddress,
        }
      );

      // Authenticate device connections
      if (isDevice && deviceId) {
        const isAuthenticated = await authenticateDevice(deviceId, authToken);
        if (!isAuthenticated) {
          console.log(`Device authentication failed for ${deviceId}`);
          ws.send(
            JSON.stringify({
              type: "error",
              payload: { message: "Authentication failed" },
              timestamp: new Date().toISOString(),
            })
          );
          ws.close(1008, "Authentication failed");
          return;
        }
        console.log(`Device ${deviceId} authenticated successfully`);
      }

      // Setup ping/pong for connection health
      ws.isAlive = true;
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on("message", (data: Buffer) => {
        // Update activity timestamp
        (ws as any).lastActivity = Date.now();

        try {
          const message: WSMessage = JSON.parse(data.toString());

          if (isDevice) {
            handleDeviceMessage(ws, message, deviceId);
          } else {
            handleWebMessage(ws, message, userId);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              payload: { message: "Invalid message format" },
              timestamp: new Date().toISOString(),
            })
          );
        }
      });

      // Handle connection close
      ws.on("close", async () => {
        activeConnections--;

        if (isDevice && deviceId) {
          deviceClients.delete(deviceId);
          console.log(
            `Device disconnected: ${deviceId} (${activeConnections} active connections)`
          );

          // Update device status to offline
          try {
            const { iotDeviceManager } = await import("./iotDeviceManager.js");
            await iotDeviceManager.updateDeviceStatus(deviceId, "offline");
            console.log(`Device ${deviceId} status updated to offline`);
          } catch (error) {
            console.error(
              `Error updating device status for ${deviceId}:`,
              error
            );
          }
        } else if (userId) {
          clients.delete(userId.toString());
          console.log(
            `Web client disconnected: ${userId} (${activeConnections} active connections)`
          );
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
      } else if (userId) {
        ws.userId = parseInt(userId);
        clients.set(userId, ws);
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
        })
      );
    }
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
  deviceId?: string | null
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
    message.payload
  );

  if (!validation.authorized) {
    console.log(
      `Command validation failed for device ${deviceId}: ${validation.reason}`
    );
    ws.send(
      JSON.stringify({
        type: "error",
        payload: {
          message: "Command not authorized",
          reason: validation.reason,
        },
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  switch (message.type) {
    case "rfid_scan":
      // Handle RFID scan from ESP32
      console.log(
        `[RFID SCAN] Received from device ${deviceId}: ${message.payload.rfidUid}`
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
      broadcastToWebClients("sensor_trigger", {
        deviceId,
        sensorType: message.payload.sensorType, // 'entry' or 'exit'
        distance: message.payload.distance,
        timestamp: message.payload.timestamp || new Date().toISOString(),
      });
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
          error
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
        })
      );
      break;

    default:
      console.log(`Unknown device message type: ${message.type}`);
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: `Unknown command: ${message.type}` },
          timestamp: new Date().toISOString(),
        })
      );
  }
}

function handleWebMessage(
  ws: WebSocketClient,
  message: WSMessage,
  userId?: string | null
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
        })
      );

      ws.send(
        JSON.stringify({
          type: "device_status",
          payload: deviceStatus,
          timestamp: new Date().toISOString(),
        })
      );
      break;

    default:
      console.log(`Unknown web message type: ${message.type}`);
  }
}

function broadcastToWebClients(type: string, payload: any) {
  const message = JSON.stringify({
    type,
    payload,
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
      })
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

// Get connection statistics
export function getConnectionStats() {
  return {
    totalConnections,
    activeConnections,
    peakConnections,
    deviceConnections: deviceClients.size,
    webClientConnections: clients.size,
    connectionLimit: MAX_CONNECTIONS,
    utilizationPercent: ((activeConnections / MAX_CONNECTIONS) * 100).toFixed(
      1
    ),
  };
}

// Force cleanup of stale connections
export function forceCleanup() {
  cleanupStaleConnections();
  return getConnectionStats();
}

export { broadcastToWebClients };
