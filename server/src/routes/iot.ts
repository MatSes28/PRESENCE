import { Router } from "express";
import { iotDeviceManager } from "../services/iotDeviceManager.js";
import { sendToDevice, broadcastToWebClients } from "../services/websocket.js";
import { validateRequest, validationRules } from "../middleware/validation.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

// Middleware to check device API key authentication
const requireDeviceAuth = async (req: any, res: any, next: any) => {
  try {
    const apiKey =
      req.headers["x-device-api-key"] ||
      req.headers["authorization"]?.replace("Bearer ", "");

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "Device API key required",
      });
    }

    // Validate API key against database
    const deviceInfo = await iotDeviceManager.authenticateDeviceByApiKey(
      apiKey
    );

    if (!deviceInfo) {
      return res.status(401).json({
        success: false,
        message: "Invalid or inactive device API key",
      });
    }

    // Store device info for later use
    req.deviceId = deviceInfo.deviceId;
    req.deviceClassroomId = deviceInfo.classroomId;
    req.deviceApiKey = apiKey;
    next();
  } catch (error) {
    console.error("Device authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication service error",
    });
  }
};

// Get all IoT devices with classroom info
router.get("/devices", requireAuth, async (req, res) => {
  try {
    const devices = await iotDeviceManager.getAllDevices();

    res.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error("Get IoT devices error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get device by ID
router.get("/devices/:deviceId", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await iotDeviceManager.getDeviceStatus(deviceId);

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
  } catch (error) {
    console.error("Get IoT device error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Register new device
router.post(
  "/devices",
  requireAuth,
  validateRequest({
    deviceId: (value) => {
      if (!value) return "Device ID is required";
      if (typeof value !== "string" || value.length < 3 || value.length > 50) {
        return "Device ID must be 3-50 characters";
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return "Device ID contains invalid characters";
      }
      return null;
    },
    classroomId: validationRules.positiveInteger,
    deviceType: (value) => {
      if (!value) return "Device type is required";
      if (!["esp32_s3", "rfid_reader", "ultrasonic_sensor"].includes(value)) {
        return "Invalid device type";
      }
      return null;
    },
  }),
  async (req, res) => {
    try {
      const { deviceId, classroomId, deviceType, config } = req.body;

      if (!deviceId || !classroomId || !deviceType) {
        return res.status(400).json({
          success: false,
          message: "Device ID, Classroom ID, and Device Type are required",
        });
      }

      const device = await iotDeviceManager.registerDevice({
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
    } catch (error) {
      console.error("Register IoT device error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Update device configuration
router.put("/devices/:deviceId/config", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { config } = req.body;

    const success = await iotDeviceManager.configureDevice(deviceId, config);

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
  } catch (error) {
    console.error("Update device config error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Send command to device
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

    const success = await iotDeviceManager.sendCommandToDevice(
      deviceId,
      command,
      params
    );

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
  } catch (error) {
    console.error("Send device command error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Restart device
router.post("/devices/:deviceId/restart", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const success = await iotDeviceManager.restartDevice(deviceId);

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
  } catch (error) {
    console.error("Restart device error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Update device firmware
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

    const success = await iotDeviceManager.updateDeviceFirmware(
      deviceId,
      firmwareUrl
    );

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
  } catch (error) {
    console.error("Update device firmware error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get devices by classroom
router.get(
  "/classrooms/:classroomId/devices",
  requireAuth,
  async (req, res) => {
    try {
      const classroomId = parseInt(req.params.classroomId);

      const devices = await iotDeviceManager.getDevicesByClassroom(classroomId);

      res.json({
        success: true,
        devices,
      });
    } catch (error) {
      console.error("Get devices by classroom error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get device statistics
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await iotDeviceManager.getDeviceStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get IoT stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get connected devices (real-time status)
router.get("/connected", requireAuth, async (req, res) => {
  try {
    const connectedDevices = await iotDeviceManager.getOnlineDevices();

    res.json({
      success: true,
      connectedDevices,
    });
  } catch (error) {
    console.error("Get connected devices error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get device heartbeat history
router.get("/devices/:deviceId/heartbeats", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50 } = req.query;

    const history = await iotDeviceManager.getHeartbeatHistory(
      deviceId,
      parseInt(limit as string, 10)
    );

    res.json({
      success: true,
      deviceId,
      heartbeats: history,
    });
  } catch (error) {
    console.error("Get device heartbeat history error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get device heartbeat statistics
router.get(
  "/devices/:deviceId/heartbeat-stats",
  requireAuth,
  async (req, res) => {
    try {
      const { deviceId } = req.params;

      const stats = await iotDeviceManager.getDeviceHeartbeatStats(deviceId);

      if (!stats) {
        return res.status(404).json({
          success: false,
          message: "Device not found or no heartbeat data available",
        });
      }

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Get device heartbeat stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Get device API key (for device setup)
router.get("/devices/:deviceId/api-key", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const apiKey = await iotDeviceManager.getDeviceApiKey(deviceId);

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "Device not found or API key not available",
      });
    }

    res.json({
      success: true,
      deviceId,
      apiKey,
    });
  } catch (error) {
    console.error("Get device API key error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Regenerate device API key
router.post(
  "/devices/:deviceId/regenerate-api-key",
  requireAuth,
  async (req, res) => {
    try {
      const { deviceId } = req.params;

      const newApiKey = await iotDeviceManager.regenerateDeviceApiKey(deviceId);

      if (!newApiKey) {
        return res.status(404).json({
          success: false,
          message: "Device not found",
        });
      }

      res.json({
        success: true,
        deviceId,
        apiKey: newApiKey,
        message: "API key regenerated successfully",
      });
    } catch (error) {
      console.error("Regenerate device API key error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Update device certificate
router.post("/devices/:deviceId/certificate", requireAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { certificateData, fingerprint } = req.body;

    if (!certificateData || !fingerprint) {
      return res.status(400).json({
        success: false,
        message: "Certificate data and fingerprint are required",
      });
    }

    const success = await iotDeviceManager.updateDeviceCertificate(
      deviceId,
      certificateData,
      fingerprint
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        message: "Failed to update device certificate",
      });
    }

    res.json({
      success: true,
      message: "Device certificate updated successfully",
    });
  } catch (error) {
    console.error("Update device certificate error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ============================================
// DEVICE-TO-SERVER COMMUNICATION ENDPOINTS
// These endpoints are called by IoT devices
// ============================================

// Device heartbeat endpoint (called by devices)
router.post("/heartbeat", requireDeviceAuth, async (req: any, res: any) => {
  try {
    const {
      status,
      batteryLevel,
      signalStrength,
      temperature,
      uptime,
      metadata,
    } = req.body;

    const heartbeatData = {
      deviceId: req.deviceId,
      timestamp: new Date().toISOString(),
      status: status || "online",
      batteryLevel,
      signalStrength,
      temperature,
      uptime,
      metadata,
    };

    await iotDeviceManager.recordHeartbeat(req.deviceId, heartbeatData);

    // Broadcast heartbeat to web clients
    broadcastToWebClients("deviceHeartbeat", heartbeatData);

    res.json({
      success: true,
      message: "Heartbeat recorded",
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record heartbeat",
    });
  }
});

// Get pending commands for this device (poll from device/firmware)
router.get("/commands", requireDeviceAuth, async (req: any, res: any) => {
  try {
    const pending = iotDeviceManager.getPendingCommandsForDevice(req.deviceId);
    res.json({
      success: true,
      commands: pending.map((c) => ({
        id: c.id,
        command: c.command,
        payload: c.payload,
        created_at: c.created_at,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get commands error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get commands",
    });
  }
});

// Acknowledge a command (device received and will execute it)
router.post("/commands/:commandId/ack", requireDeviceAuth, async (req: any, res: any) => {
  try {
    const { commandId } = req.params;
    const ok = iotDeviceManager.markCommandAcknowledged(commandId, req.deviceId);
    if (!ok) {
      return res.status(404).json({
        success: false,
        message: "Command not found or not for this device",
      });
    }
    res.json({
      success: true,
      message: "Command acknowledged",
    });
  } catch (error) {
    console.error("Ack command error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to acknowledge command",
    });
  }
});

// RFID scan endpoint (called by devices)
router.post(
  "/attendance/rfid",
  requireDeviceAuth,
  async (req: any, res: any) => {
    try {
      const { rfidUid, timestamp } = req.body;
      const requestId = uuidv4();

      if (!rfidUid) {
        return res.status(400).json({
          success: false,
          message: "RFID UID is required",
        });
      }

      // Import attendance monitor dynamically to avoid circular dependencies
      const { attendanceMonitor } = await import(
        "../services/attendanceMonitor.js"
      );

      console.log(
        `[IoT RFID] Device ${req.deviceId} scanned RFID: ${rfidUid} (Request: ${requestId})`
      );

      const result = await attendanceMonitor.processRFIDScan({
        deviceId: req.deviceId,
        rfidUid,
        timestamp: timestamp || new Date().toISOString(),
      });

      // Broadcast to web clients
      broadcastToWebClients("rfidScan", {
        requestId,
        deviceId: req.deviceId,
        rfidUid,
        result,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        requestId,
        message: "RFID scan processed",
        data: result,
      });
    } catch (error: any) {
      console.error("RFID scan error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process RFID scan",
      });
    }
  }
);

// Ultrasonic sensor data endpoint (called by devices)
router.post(
  "/sensor/ultrasonic",
  requireDeviceAuth,
  async (req: any, res: any) => {
    try {
      const { distance, timestamp } = req.body;
      const requestId = uuidv4();

      if (distance === undefined) {
        return res.status(400).json({
          success: false,
          message: "Distance value is required",
        });
      }

      // Process sensor data for presence detection using processSensorTrigger
      const { attendanceMonitor } = await import(
        "../services/attendanceMonitor.js"
      );

      const result = await attendanceMonitor.processSensorTrigger({
        deviceId: req.deviceId,
        sensorType: distance > 100 ? "entry" : "exit",
        distance,
        timestamp: timestamp || new Date().toISOString(),
      });

      // Broadcast to web clients
      broadcastToWebClients("sensorData", {
        requestId,
        deviceId: req.deviceId,
        sensorType: "ultrasonic",
        value: distance,
        result,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        requestId,
        message: "Sensor data processed",
        data: result,
      });
    } catch (error: any) {
      console.error("Ultrasonic sensor error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process sensor data",
      });
    }
  }
);

// Combined sensor data endpoint (called by devices with both RFID and ultrasonic)
router.post(
  "/attendance/combined",
  requireDeviceAuth,
  async (req: any, res: any) => {
    try {
      const { rfidUid, distance, timestamp } = req.body;
      const requestId = uuidv4();

      if (!rfidUid && distance === undefined) {
        return res.status(400).json({
          success: false,
          message: "At least RFID UID or distance value is required",
        });
      }

      const { attendanceMonitor } = await import(
        "../services/attendanceMonitor.js"
      );

      console.log(
        `[IoT Combined] Device ${req.deviceId} - RFID: ${rfidUid}, Distance: ${distance}cm (Request: ${requestId})`
      );

      // Process RFID scan first if present
      let rfidResult = null;
      if (rfidUid) {
        rfidResult = await attendanceMonitor.processRFIDScan({
          deviceId: req.deviceId,
          rfidUid,
          timestamp: timestamp || new Date().toISOString(),
        });
      }

      // Process sensor trigger if distance is present
      let sensorResult = null;
      if (distance !== undefined) {
        sensorResult = await attendanceMonitor.processSensorTrigger({
          deviceId: req.deviceId,
          sensorType: distance > 100 ? "entry" : "exit",
          distance,
          timestamp: timestamp || new Date().toISOString(),
        });
      }

      const result = {
        rfidResult,
        sensorResult,
        success: !!(rfidResult?.success || sensorResult?.success),
      };

      // Broadcast to web clients
      broadcastToWebClients("combinedSensorData", {
        requestId,
        deviceId: req.deviceId,
        rfidUid,
        distance,
        result,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        requestId,
        message: "Combined sensor data processed",
        data: result,
      });
    } catch (error: any) {
      console.error("Combined sensor error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to process combined sensor data",
      });
    }
  }
);

// Device status update endpoint (called by devices)
router.post("/status", requireDeviceAuth, async (req: any, res: any) => {
  try {
    const { status, config } = req.body;

    await iotDeviceManager.updateDeviceStatus(req.deviceId, status, config);

    // Broadcast status update
    broadcastToWebClients("deviceStatusUpdate", {
      deviceId: req.deviceId,
      status,
      config,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Status updated",
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Device status update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update device status",
    });
  }
});

// Device diagnostics endpoint (called by devices)
router.post("/diagnostics", requireDeviceAuth, async (req: any, res: any) => {
  try {
    const diagnostics = await iotDeviceManager.performHealthCheck(req.deviceId);

    res.json({
      success: true,
      deviceId: req.deviceId,
      diagnostics,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Device diagnostics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get device diagnostics",
    });
  }
});

// Simulate RFID tap for testing (requires device authentication)
router.post(
  "/attendance/simulate-rfid",
  requireDeviceAuth,
  validateRequest({
    rfidUid: validationRules.rfidUid,
  }),
  async (req, res) => {
    try {
      const { rfidUid } = req.body;

      if (!rfidUid) {
        return res.status(400).json({
          success: false,
          message: "RFID UID is required",
        });
      }

      // Simulate RFID scan by sending to WebSocket
      const simulatedData: any = {
        type: "rfid_scan",
        rfidUid,
        deviceId: "simulator",
        timestamp: new Date().toISOString(),
      };

      // Also process the RFID scan directly for testing
      try {
        const { attendanceMonitor } = await import(
          "../services/attendanceMonitor.js"
        );
        console.log(`[SIMULATE RFID] Processing RFID scan: ${rfidUid}`);
        const result = await attendanceMonitor.processRFIDScan({
          deviceId: "simulator",
          rfidUid,
          timestamp: simulatedData.timestamp,
        });
        console.log(`[SIMULATE RFID] Processing result:`, result);
        simulatedData.processingResult = result;
      } catch (error) {
        console.error(`[SIMULATE RFID] Error processing RFID scan:`, error);
        simulatedData.processingResult = {
          success: false,
          message: (error as Error).message,
        };
      }

      // Send to WebSocket for real-time updates
      broadcastToWebClients("rfidScan", simulatedData);

      res.json({
        success: true,
        message: "RFID tap simulated successfully",
        data: simulatedData,
      });
    } catch (error) {
      console.error("Simulate RFID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// ============================================
// HEALTH AND MAINTENANCE ENDPOINTS
// ============================================

// Get maintenance recommendations
router.get("/maintenance", requireAuth, async (req, res) => {
  try {
    const recommendations =
      await iotDeviceManager.getMaintenanceRecommendations();

    res.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error("Get maintenance recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Perform bulk health check
router.post("/health-check/bulk", requireAuth, async (req, res) => {
  try {
    const result = await iotDeviceManager.performBulkHealthCheck();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Bulk health check error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all health metrics
router.get("/health/all", requireAuth, async (req, res) => {
  try {
    const metrics = await iotDeviceManager.getAllHealthMetrics();

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("Get all health metrics error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
