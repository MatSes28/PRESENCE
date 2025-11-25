"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.sendToDevice = sendToDevice;
exports.getConnectedDevices = getConnectedDevices;
exports.getConnectedWebClients = getConnectedWebClients;
exports.broadcastToWebClients = broadcastToWebClients;
const ws_1 = require("ws");
const clients = new Map();
const deviceClients = new Map();
function setupWebSocket(wss) {
    wss.on("connection", (ws, request) => {
        const url = new URL(request.url || "", "http://localhost");
        const isDevice = url.pathname === "/iot";
        const deviceId = url.searchParams.get("deviceId");
        const userId = url.searchParams.get("userId");
        console.log(`New ${isDevice ? "device" : "web"} connection:`, {
            deviceId,
            userId,
            remoteAddress: request.socket?.remoteAddress,
        });
        ws.isAlive = true;
        ws.on("pong", () => {
            ws.isAlive = true;
        });
        ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (isDevice) {
                    handleDeviceMessage(ws, message, deviceId);
                }
                else {
                    handleWebMessage(ws, message, userId);
                }
            }
            catch (error) {
                console.error("Failed to parse WebSocket message:", error);
                ws.send(JSON.stringify({
                    type: "error",
                    payload: { message: "Invalid message format" },
                    timestamp: new Date().toISOString(),
                }));
            }
        });
        ws.on("close", () => {
            if (isDevice && deviceId) {
                deviceClients.delete(deviceId);
                console.log(`Device disconnected: ${deviceId}`);
            }
            else if (userId) {
                clients.delete(userId.toString());
                console.log(`Web client disconnected: ${userId}`);
            }
        });
        ws.on("error", (error) => {
            console.error("WebSocket error:", error);
        });
        if (isDevice && deviceId) {
            ws.deviceId = deviceId;
            deviceClients.set(deviceId, ws);
        }
        else if (userId) {
            ws.userId = parseInt(userId);
            clients.set(userId, ws);
        }
        ws.send(JSON.stringify({
            type: "connected",
            payload: {
                message: `Connected to CLIRDEC:PRESENCE ${isDevice ? "IoT" : "Web"} server`,
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
        }));
    });
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                if (ws.deviceId) {
                    deviceClients.delete(ws.deviceId);
                }
                else if (ws.userId) {
                    clients.delete(ws.userId.toString());
                }
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    wss.on("close", () => {
        clearInterval(interval);
    });
}
async function handleDeviceMessage(ws, message, deviceId) {
    switch (message.type) {
        case "rfid_scan":
            console.log(`[RFID SCAN] Received from device ${deviceId}: ${message.payload.rfidUid}`);
            let processingResult = null;
            try {
                const { attendanceMonitor } = await Promise.resolve().then(() => __importStar(require("./attendanceMonitor.js")));
                console.log(`[RFID SCAN] Calling attendanceMonitor.processRFIDScan`);
                processingResult = await attendanceMonitor.processRFIDScan({
                    deviceId,
                    rfidUid: message.payload.rfidUid,
                    timestamp: message.payload.timestamp || new Date().toISOString(),
                });
                console.log(`[RFID SCAN] Processing result:`, processingResult);
            }
            catch (error) {
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
            broadcastToWebClients("sensor_trigger", {
                deviceId,
                sensorType: message.payload.sensorType,
                distance: message.payload.distance,
                timestamp: message.payload.timestamp || new Date().toISOString(),
            });
            break;
        case "attendance_record":
            broadcastToWebClients("attendance_record", {
                deviceId,
                ...message.payload,
                timestamp: message.payload.timestamp || new Date().toISOString(),
            });
            break;
        case "heartbeat":
            if (deviceId) {
                console.log(`Heartbeat from device ${deviceId}`);
            }
            break;
        default:
            console.log(`Unknown device message type: ${message.type}`);
    }
}
function handleWebMessage(ws, message, userId) {
    switch (message.type) {
        case "subscribe_attendance":
            console.log(`Web client ${userId} subscribed to attendance updates`);
            break;
        case "get_device_status":
            const deviceStatus = Array.from(deviceClients.entries()).map(([id, client]) => ({
                deviceId: id,
                status: client.readyState === ws_1.WebSocket.OPEN ? "online" : "offline",
                lastSeen: new Date().toISOString(),
            }));
            ws.send(JSON.stringify({
                type: "device_status",
                payload: deviceStatus,
                timestamp: new Date().toISOString(),
            }));
            break;
        default:
            console.log(`Unknown web message type: ${message.type}`);
    }
}
function broadcastToWebClients(type, payload) {
    const message = JSON.stringify({
        type,
        payload,
        timestamp: new Date().toISOString(),
    });
    clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    });
}
function sendToDevice(deviceId, type, payload) {
    const device = deviceClients.get(deviceId);
    if (device && device.readyState === ws_1.WebSocket.OPEN) {
        device.send(JSON.stringify({
            type,
            payload,
            timestamp: new Date().toISOString(),
        }));
        return true;
    }
    return false;
}
function getConnectedDevices() {
    return Array.from(deviceClients.keys());
}
function getConnectedWebClients() {
    return Array.from(clients.keys());
}
