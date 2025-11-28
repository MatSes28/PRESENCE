import { Router } from "express";
import { iotDeviceManager } from "../services/iotDeviceManager.js";
import { sendToDevice, broadcastToWebClients } from "../services/websocket.js";
import { validateRequest, validationRules } from "../middleware/validation.js";

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
const requireDeviceAuth = (req: any, res: any, next: any) => {
  const apiKey =
    req.headers["x-device-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "Device API key required",
    });
  }

  // In production, validate against a secure device registry
  // For now, accept any non-empty API key for development
  if (typeof apiKey !== "string" || apiKey.length < 10) {
    return res.status(401).json({
      success: false,
      message: "Invalid device API key",
    });
  }

  // Store device info for later use
  req.deviceApiKey = apiKey;
  next();
};

// Get all IoT devices
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
          message: error.message,
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

export default router;
