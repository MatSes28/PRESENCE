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

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

  constructor(private userId?: number) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const userParam = this.userId ? `&userId=${this.userId}` : "";

      const wsUrl = `${protocol}//${host}/ws?client=web${userParam}`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onclose = () => {
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;

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
      // Unhandled message type
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

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WSMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected");
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
  userId?: number
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
