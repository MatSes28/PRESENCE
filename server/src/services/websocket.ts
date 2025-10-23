import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";

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

export function setupWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocketClient, request: IncomingMessage) => {
    const url = new URL(request.url || "", "http://localhost");
    const isDevice = url.pathname === "/iot";
    const deviceId = url.searchParams.get("deviceId");
    const userId = url.searchParams.get("userId");

    console.log(`New ${isDevice ? "device" : "web"} connection:`, {
      deviceId,
      userId,
      remoteAddress: request.socket?.remoteAddress,
    });

    // Setup ping/pong for connection health
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
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
    ws.on("close", () => {
      if (isDevice && deviceId) {
        deviceClients.delete(deviceId);
        console.log(`Device disconnected: ${deviceId}`);
      } else if (userId) {
        clients.delete(userId.toString());
        console.log(`Web client disconnected: ${userId}`);
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
  });

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

function handleDeviceMessage(
  ws: WebSocketClient,
  message: WSMessage,
  deviceId?: string | null
) {
  switch (message.type) {
    case "rfid_scan":
      // Handle RFID scan from ESP32
      broadcastToWebClients("rfid_scan", {
        deviceId,
        rfidUid: message.payload.rfidUid,
        timestamp: message.payload.timestamp || new Date().toISOString(),
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
      // Device heartbeat
      if (deviceId) {
        console.log(`Heartbeat from device ${deviceId}`);
      }
      break;

    default:
      console.log(`Unknown device message type: ${message.type}`);
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

export { broadcastToWebClients };
