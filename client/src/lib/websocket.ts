export interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface RFIDScan {
  deviceId: string;
  rfidUid: string;
  timestamp: string;
  student?: {
    id: number;
    name: string;
    studentId: string;
  };
}

export interface SensorTrigger {
  deviceId: string;
  sensorType: "entry" | "exit";
  distance: number;
  timestamp: string;
}

export interface AttendanceRecord {
  studentId: number;
  classSessionId: number;
  entryTime?: string;
  exitTime?: string;
  rfidDetected: boolean;
  sensorDetected: boolean;
  isValid: boolean;
  discrepancyFlag: boolean;
}

export type WebSocketConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

const isWebSocketDebugEnabled = () =>
  typeof window !== "undefined" &&
  window.localStorage.getItem("presence.debugWebSocket") === "true";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private manualDisconnect = false;
  private connectionState: WebSocketConnectionState = "disconnected";

  constructor(private userId?: number) {}

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.ws?.readyState === WebSocket.CONNECTING && this.connectPromise) {
      return this.connectPromise;
    }

    this.manualDisconnect = false;
    this.setConnectionState("connecting");

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      let settled = false;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const userParam = this.userId ? `&userId=${encodeURIComponent(this.userId)}` : "";
      const wsUrl = `${protocol}//${host}/ws?client=web${userParam}`;

      try {
        const socket = new WebSocket(wsUrl);
        this.ws = socket;

        socket.onopen = () => {
          if (this.ws !== socket) return;
          if (isWebSocketDebugEnabled()) console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          this.connectPromise = null;
          this.setConnectionState("connected");
          this.emit("connect", { connectedAt: new Date().toISOString() });
          settled = true;
          resolve();
        };

        socket.onmessage = (event) => {
          if (this.ws !== socket) return;
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        socket.onclose = (event) => {
          if (this.ws !== socket) return;

          if (isWebSocketDebugEnabled()) console.log("WebSocket disconnected");
          this.ws = null;
          this.connectPromise = null;
          this.setConnectionState("disconnected");
          this.emit("disconnect", { disconnectedAt: new Date().toISOString() });

          if (!settled) {
            settled = true;
            reject(new Error(event.reason || `WebSocket closed (${event.code})`));
          }

          if (!this.manualDisconnect && event.code !== 1008) {
            this.attemptReconnect();
          }
        };

        socket.onerror = (error) => {
          if (this.ws !== socket) return;
          if (isWebSocketDebugEnabled()) console.error("WebSocket error:", error);
          this.emit("error", error);

          if (!settled) {
            settled = true;
            this.connectPromise = null;
            reject(error);
          }
        };
      } catch (error) {
        this.emit("error", error);
        this.connectPromise = null;
        reject(error);
      }
    });

    return this.connectPromise;
  }

  disconnect() {
    this.manualDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState("disconnected");
  }

  private attemptReconnect() {
    if (this.manualDisconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionState("failed");
      if (isWebSocketDebugEnabled()) console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    this.setConnectionState("reconnecting");
    if (isWebSocketDebugEnabled()) {
      console.log(
        `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        this.attemptReconnect();
      });
    }, this.reconnectInterval);
  }

  private handleMessage(message: WSMessage) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload));
    }

    // Handle specific message types
    switch (message.type) {
      case "connected":
        this.emit("connected", message.payload);
        break;
      case "rfid_scan":
        this.emit("rfidScan", message.payload as RFIDScan);
        break;
      case "sensor_trigger":
        this.emit("sensorTrigger", message.payload as SensorTrigger);
        break;
      case "attendance_record":
        this.emit("attendanceRecord", message.payload as AttendanceRecord);
        break;
      case "device_status":
        this.emit("deviceStatus", message.payload);
        break;
      case "error":
        this.emit("error", message.payload);
        break;
      default:
        if (isWebSocketDebugEnabled()) console.log("Unhandled message type:", message.type);
    }
  }

  on(event: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: (data: any) => void) {
    if (!handler) {
      this.messageHandlers.delete(event);
      return;
    }

    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  private setConnectionState(state: WebSocketConnectionState) {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.emit("status", {
      state,
      reconnectAttempts: this.reconnectAttempts,
      timestamp: new Date().toISOString(),
    });
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      if (isWebSocketDebugEnabled()) console.warn("WebSocket is not connected");
    }
  }

  subscribeToAttendance() {
    this.send("subscribe_attendance", {});
  }

  getDeviceStatus() {
    this.send("get_device_status", {});
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  setUserId(userId: number) {
    this.userId = userId;
    // Reconnect with new user ID if connected
    if (this.isConnected()) {
      this.disconnect();
      this.connect();
    }
  }
}

// Global WebSocket instance
let wsClient: WebSocketClient | null = null;

export const getWebSocketClient = (userId?: number): WebSocketClient => {
  if (!wsClient) {
    wsClient = new WebSocketClient(userId);
  } else if (userId && wsClient["userId"] !== userId) {
    wsClient.setUserId(userId);
  }
  return wsClient;
};

export const connectWebSocket = async (
  userId?: number,
): Promise<WebSocketClient> => {
  const client = getWebSocketClient(userId);
  await client.connect();
  return client;
};

export const disconnectWebSocket = () => {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
};
