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
const express_1 = require("express");
const iotDeviceManager_js_1 = require("../services/iotDeviceManager.js");
const websocket_js_1 = require("../services/websocket.js");
const router = (0, express_1.Router)();
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    next();
};
router.get("/devices", requireAuth, async (req, res) => {
    try {
        const devices = await iotDeviceManager_js_1.iotDeviceManager.getAllDevices();
        res.json({
            success: true,
            devices,
        });
    }
    catch (error) {
        console.error("Get IoT devices error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.get("/devices/:deviceId", requireAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = await iotDeviceManager_js_1.iotDeviceManager.getDeviceStatus(deviceId);
        if (!device) {
            return res.status(404).json({
                success: false,
                message: "Device not found",
            });
        }
        res.json({
            success: true,
            device,
        });
    }
    catch (error) {
        console.error("Get IoT device error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/devices", requireAuth, async (req, res) => {
    try {
        const { deviceId, classroomId, deviceType, config } = req.body;
        if (!deviceId || !classroomId || !deviceType) {
            return res.status(400).json({
                success: false,
                message: "Device ID, Classroom ID, and Device Type are required",
            });
        }
        const device = await iotDeviceManager_js_1.iotDeviceManager.registerDevice({
            deviceId,
            classroomId: parseInt(classroomId),
            deviceType,
            config,
        });
        res.status(201).json({
            success: true,
            message: "Device registered successfully",
            device,
        });
    }
    catch (error) {
        console.error("Register IoT device error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.put("/devices/:deviceId/config", requireAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { config } = req.body;
        const success = await iotDeviceManager_js_1.iotDeviceManager.configureDevice(deviceId, config);
        if (!success) {
            return res.status(500).json({
                success: false,
                message: "Failed to update device configuration",
            });
        }
        res.json({
            success: true,
            message: "Device configuration updated successfully",
        });
    }
    catch (error) {
        console.error("Update device config error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/devices/:deviceId/command", requireAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { command, params } = req.body;
        if (!command) {
            return res.status(400).json({
                success: false,
                message: "Command is required",
            });
        }
        const success = await iotDeviceManager_js_1.iotDeviceManager.sendCommandToDevice(deviceId, command, params);
        if (!success) {
            return res.status(500).json({
                success: false,
                message: "Failed to send command to device",
            });
        }
        res.json({
            success: true,
            message: "Command sent successfully",
        });
    }
    catch (error) {
        console.error("Send device command error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/devices/:deviceId/restart", requireAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const success = await iotDeviceManager_js_1.iotDeviceManager.restartDevice(deviceId);
        if (!success) {
            return res.status(500).json({
                success: false,
                message: "Failed to restart device",
            });
        }
        res.json({
            success: true,
            message: "Device restart command sent successfully",
        });
    }
    catch (error) {
        console.error("Restart device error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/devices/:deviceId/firmware", requireAuth, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { firmwareUrl } = req.body;
        if (!firmwareUrl) {
            return res.status(400).json({
                success: false,
                message: "Firmware URL is required",
            });
        }
        const success = await iotDeviceManager_js_1.iotDeviceManager.updateDeviceFirmware(deviceId, firmwareUrl);
        if (!success) {
            return res.status(500).json({
                success: false,
                message: "Failed to initiate firmware update",
            });
        }
        res.json({
            success: true,
            message: "Firmware update initiated successfully",
        });
    }
    catch (error) {
        console.error("Update device firmware error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.get("/classrooms/:classroomId/devices", requireAuth, async (req, res) => {
    try {
        const classroomId = parseInt(req.params.classroomId);
        const devices = await iotDeviceManager_js_1.iotDeviceManager.getDevicesByClassroom(classroomId);
        res.json({
            success: true,
            devices,
        });
    }
    catch (error) {
        console.error("Get devices by classroom error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.get("/stats", requireAuth, async (req, res) => {
    try {
        const stats = await iotDeviceManager_js_1.iotDeviceManager.getDeviceStats();
        res.json({
            success: true,
            stats,
        });
    }
    catch (error) {
        console.error("Get IoT stats error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.get("/connected", requireAuth, async (req, res) => {
    try {
        const connectedDevices = await iotDeviceManager_js_1.iotDeviceManager.getOnlineDevices();
        res.json({
            success: true,
            connectedDevices,
        });
    }
    catch (error) {
        console.error("Get connected devices error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
router.post("/attendance/simulate-rfid", async (req, res) => {
    try {
        const { rfidUid } = req.body;
        if (!rfidUid) {
            return res.status(400).json({
                success: false,
                message: "RFID UID is required",
            });
        }
        const simulatedData = {
            type: "rfid_scan",
            rfidUid,
            deviceId: "simulator",
            timestamp: new Date().toISOString(),
        };
        try {
            const { attendanceMonitor } = await Promise.resolve().then(() => __importStar(require("../services/attendanceMonitor.js")));
            console.log(`[SIMULATE RFID] Processing RFID scan: ${rfidUid}`);
            const result = await attendanceMonitor.processRFIDScan({
                deviceId: "simulator",
                rfidUid,
                timestamp: simulatedData.timestamp,
            });
            console.log(`[SIMULATE RFID] Processing result:`, result);
            simulatedData.processingResult = result;
        }
        catch (error) {
            console.error(`[SIMULATE RFID] Error processing RFID scan:`, error);
            simulatedData.processingResult = {
                success: false,
                message: error.message,
            };
        }
        (0, websocket_js_1.broadcastToWebClients)("rfidScan", simulatedData);
        res.json({
            success: true,
            message: "RFID tap simulated successfully",
            data: simulatedData,
        });
    }
    catch (error) {
        console.error("Simulate RFID error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.default = router;
