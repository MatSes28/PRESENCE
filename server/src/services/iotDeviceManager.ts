/**
 * IoT Device Manager Service
 * Handles ESP32/IoT device registration, communication, and health monitoring
 */

import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { EventEmitter } from "events";
import type { Pool, PoolClient } from "pg";
import type Redis from "ioredis";

// Device interface definitions
export interface IoTDevice {
  id: string;
  device_id: string;
  name: string;
  type: DeviceType;
  location: string;
  room_id?: string;
  api_key: string;
  secret_key: string;
  status: DeviceStatus;
  firmware_version: string;
  last_heartbeat: Date;
  last_seen: Date;
  ip_address?: string;
  mac_address?: string;
  config: DeviceConfig;
  created_at: Date;
  updated_at: Date;
}

export type DeviceType =
  | "rfid_reader"
  | "biometric"
  | "camera"
  | "gateway"
  | "sensor_hub";
export type DeviceStatus =
  | "online"
  | "offline"
  | "maintenance"
  | "error"
  | "pending";

export interface DeviceConfig {
  scan_interval: number;
  debounce_time: number;
  led_enabled: boolean;
  buzzer_enabled: boolean;
  auto_sync: boolean;
  sync_interval: number;
  offline_buffer: boolean;
  max_offline_records: number;
}

export interface DeviceRegistrationRequest {
  device_id: string;
  name: string;
  type: DeviceType;
  location: string;
  room_id?: string;
  firmware_version: string;
  mac_address?: string;
  ip_address?: string;
}

export interface DeviceHeartbeat {
  device_id: string;
  timestamp: Date;
  uptime: number;
  free_heap: number;
  temperature: number;
  wifi_signal: number;
  battery_level?: number;
  firmware_version?: string;
}

export interface AttendanceRecord {
  device_id: string;
  card_id: string;
  timestamp: Date;
  direction: "in" | "out";
  raw_data?: string;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  command: string;
  payload?: Record<string, unknown>;
  created_at: Date;
  executed_at?: Date;
  status: "pending" | "sent" | "acknowledged" | "failed" | "timeout";
}

class IoTDeviceManager extends EventEmitter {
  private db: Pool;
  private redis: Redis | null;
  private commandQueue: Map<string, DeviceCommand> = new Map();
  private deviceSubscriptions: Map<string, (message: unknown) => void> =
    new Map();
  private offlineRecords: Map<string, AttendanceRecord[]> = new Map();

  constructor(db: Pool, redis: Redis | null = null) {
    super();
    this.db = db;
    this.redis = redis;
    this.setupCleanup();
  }

  /**
   * Register a new IoT device
   */
  async registerDevice(
    request: DeviceRegistrationRequest,
    client?: PoolClient
  ): Promise<IoTDevice> {
    const dbClient = client || (await this.db.connect());

    try {
      // Generate secure credentials
      const apiKey = `pk_${randomBytes(16).toString("hex")}`;
      const secretKey = randomBytes(32).toString("hex");

      // Hash the secret key for storage
      const hashedSecret = createHmac("sha256", apiKey)
        .update(secretKey)
        .digest("hex");

      const result = await dbClient.query<IoTDevice>(
        `INSERT INTO iot_devices (
          device_id, name, type, location, room_id, 
          api_key, secret_key, status, firmware_version,
          ip_address, mac_address, config, last_heartbeat, last_seen
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *`,
        [
          request.device_id,
          request.name,
          request.type,
          request.location,
          request.room_id || null,
          apiKey,
          hashedSecret,
          "pending",
          request.firmware_version,
          request.ip_address || null,
          request.mac_address || null,
          JSON.stringify(this.getDefaultConfig(request.type)),
        ]
      );

      const device = result.rows[0];
      this.emit("device:registered", device);

      // Cache the device credentials in Redis
      if (this.redis) {
        await this.redis.hset(
          `device:credentials:${apiKey}`,
          "device_id",
          device.device_id,
          "secret",
          hashedSecret
        );
        await this.redis.expire(`device:credentials:${apiKey}`, 86400 * 7); // 7 days
      }

      return device;
    } finally {
      if (!client) dbClient.release();
    }
  }

  /**
   * Authenticate a device request using HMAC signature
   */
  async authenticateDevice(
    apiKey: string,
    timestamp: string,
    nonce: string,
    signature: string
  ): Promise<IoTDevice | null> {
    // Check Redis cache first
    if (this.redis) {
      const cached = await this.redis.hgetall(`device:credentials:${apiKey}`);
      if (cached.device_id) {
        const device = await this.getDeviceById(cached.device_id);
        if (
          device &&
          this.verifySignature(
            device,
            timestamp,
            nonce,
            signature,
            cached.secret
          )
        ) {
          return device;
        }
      }
    }

    // Fallback to database
    const result = await this.db.query(
      "SELECT * FROM iot_devices WHERE api_key = $1 AND status != $2",
      [apiKey, "decommissioned"]
    );

    if (result.rows.length === 0) return null;

    const device = result.rows[0];
    const storedSecret = device.secret_key;

    if (
      this.verifySignature(device, timestamp, nonce, signature, storedSecret)
    ) {
      // Update cache
      if (this.redis) {
        await this.redis.hset(
          `device:credentials:${apiKey}`,
          "device_id",
          device.device_id,
          "secret",
          storedSecret
        );
        await this.redis.expire(`device:credentials:${apiKey}`, 86400 * 7);
      }
      return device;
    }

    return null;
  }

  /**
   * Verify HMAC signature
   */
  private async verifySignature(
    device: IoTDevice,
    timestamp: string,
    nonce: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    // Check timestamp freshness (5 minute window)
    const requestTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (Math.abs(now - requestTime) > 300000) {
      return false;
    }

    // Verify nonce hasn't been used (prevent replay attacks)
    const nonceKey = `device:nonce:${device.device_id}:${nonce}`;
    if (this.redis) {
      const exists = await this.redis.set(nonceKey, "1", "PX", 60000, "NX");
      if (!exists) return false; // Nonce already used
    }

    // Compute expected signature
    const message = `${device.device_id}:${timestamp}:${nonce}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    try {
      return timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch {
      return false;
    }
  }

  /**
   * Process device heartbeat
   */
  async processHeartbeat(
    heartbeat: DeviceHeartbeat,
    client?: PoolClient
  ): Promise<void> {
    const dbClient = client || (await this.db.connect());

    try {
      await dbClient.query(
        `UPDATE iot_devices 
         SET last_heartbeat = NOW(), 
             last_seen = NOW(),
             status = 'online',
             ip_address = COALESCE($2, ip_address),
             firmware_version = COALESCE($3, firmware_version)
         WHERE device_id = $1`,
        [
          heartbeat.device_id,
          heartbeat.wifi_signal ? null : null, // Skip IP update if not provided
          heartbeat.firmware_version || null,
        ]
      );

      // Update device metrics in Redis for real-time monitoring
      if (this.redis) {
        await this.redis.hset(
          `device:metrics:${heartbeat.device_id}`,
          "uptime",
          heartbeat.uptime.toString(),
          "free_heap",
          heartbeat.free_heap.toString(),
          "temperature",
          heartbeat.temperature.toString(),
          "wifi_signal",
          heartbeat.wifi_signal.toString(),
          "battery_level",
          (heartbeat.battery_level || 100).toString(),
          "timestamp",
          new Date().toISOString()
        );
        await this.redis.expire(`device:metrics:${heartbeat.device_id}`, 300); // 5 minutes TTL
      }

      // Check for offline records to sync
      await this.syncOfflineRecords(heartbeat.device_id);

      // Send pending commands
      await this.sendPendingCommands(heartbeat.device_id);

      this.emit("device:heartbeat", heartbeat);
    } finally {
      if (!client) dbClient.release();
    }
  }

  /**
   * Process attendance scan from device
   */
  async processScan(
    record: AttendanceRecord,
    client?: PoolClient
  ): Promise<void> {
    const dbClient = client || (await this.db.connect());

    try {
      // Find the student by card ID
      const studentResult = await dbClient.query(
        `SELECT id, student_id, name FROM students WHERE rfid_card_id = $1 OR nfc_id = $1`,
        [record.card_id]
      );

      if (studentResult.rows.length === 0) {
        // Unknown card - log and optionally alert
        this.emit("scan:unknown", record);
        return;
      }

      const student = studentResult.rows[0];

      // Find current active session for the room
      const sessionResult = await dbClient.query(
        `SELECT cs.* FROM class_sessions cs
         JOIN rooms r ON r.id = cs.room_id
         JOIN iot_devices d ON d.room_id = r.id
         WHERE d.device_id = $1 
         AND NOW() BETWEEN cs.start_time AND cs.end_time
         AND cs.status = 'active'
         LIMIT 1`,
        [record.device_id]
      );

      let session_id: string | null = null;
      if (sessionResult.rows.length > 0) {
        session_id = sessionResult.rows[0].id;
      }

      // Insert attendance record
      await dbClient.query(
        `INSERT INTO attendance_records (
          student_id, session_id, device_id, 
          scan_time, direction, raw_data, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'present')`,
        [
          student.id,
          session_id,
          record.device_id,
          record.timestamp,
          record.direction,
          record.raw_data || null,
        ]
      );

      // Update statistics
      await dbClient.query(
        `INSERT INTO daily_attendance_stats (date, total_scans, unique_students)
         VALUES (CURRENT_DATE, 1, 1)
         ON CONFLICT (date) DO UPDATE SET 
           total_scans = daily_attendance_stats.total_scans + 1,
           unique_students = daily_attendance_stats.unique_students + 1`
      );

      this.emit("scan:processed", { record, student, session_id });
    } finally {
      if (!client) dbClient.release();
    }
  }

  /**
   * Queue attendance record when device is offline
   */
  async queueOfflineRecord(record: AttendanceRecord): Promise<void> {
    const key = `device:offline:${record.device_id}`;

    if (this.redis) {
      await this.redis.lpush(key, JSON.stringify(record));
      await this.redis.expire(key, 86400 * 7); // 7 days retention
    } else {
      // Fallback to memory storage
      const records = this.offlineRecords.get(record.device_id) || [];
      records.push(record);
      if (records.length > 1000) records.shift(); // Limit memory usage
      this.offlineRecords.set(record.device_id, records);
    }
  }

  /**
   * Sync offline records when device comes online
   */
  private async syncOfflineRecords(deviceId: string): Promise<void> {
    const key = `device:offline:${deviceId}`;

    if (this.redis) {
      const records = await this.redis.lrange(key, 0, -1);

      if (records.length > 0) {
        for (const recordJson of records) {
          try {
            const record: AttendanceRecord = JSON.parse(recordJson);
            await this.processScan(record);
          } catch (err) {
            console.error("Error processing offline record:", err);
          }
        }

        // Clear synced records
        await this.redis.del(key);
      }
    } else {
      const records = this.offlineRecords.get(deviceId);
      if (records && records.length > 0) {
        for (const record of records) {
          await this.processScan(record);
        }
        this.offlineRecords.delete(deviceId);
      }
    }
  }

  /**
   * Send pending commands to device
   */
  private async sendPendingCommands(deviceId: string): Promise<void> {
    const pendingCommands = Array.from(this.commandQueue.values())
      .filter((cmd) => cmd.device_id === deviceId && cmd.status === "pending")
      .slice(0, 10); // Limit to 10 commands per heartbeat

    for (const command of pendingCommands) {
      command.status = "sent";

      if (this.redis) {
        await this.redis.publish(
          `device:commands:${deviceId}`,
          JSON.stringify(command)
        );
      }
    }
  }

  /**
   * Queue a command for a device
   */
  async queueCommand(
    deviceId: string,
    command: string,
    payload?: Record<string, unknown>
  ): Promise<DeviceCommand> {
    const cmd: DeviceCommand = {
      id: `cmd_${randomBytes(8).toString("hex")}`,
      device_id: deviceId,
      command,
      payload,
      created_at: new Date(),
      status: "pending",
    };

    this.commandQueue.set(cmd.id, cmd);

    // Store in Redis for distributed processing
    if (this.redis) {
      await this.redis.rpush(
        `device:commandQueue:${deviceId}`,
        JSON.stringify(cmd)
      );
    }

    return cmd;
  }

  /**
   * Acknowledge command execution
   */
  async acknowledgeCommand(commandId: string, success: boolean): Promise<void> {
    const command = this.commandQueue.get(commandId);
    if (!command) return;

    command.status = success ? "acknowledged" : "failed";
    command.executed_at = new Date();

    this.emit("command:acknowledged", command);
  }

  /**
   * Get device by ID
   */
  async getDeviceById(deviceId: string): Promise<IoTDevice | null> {
    const result = await this.db.query(
      "SELECT * FROM iot_devices WHERE device_id = $1",
      [deviceId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all devices with optional filters
   */
  async getDevices(filters?: {
    status?: DeviceStatus;
    type?: DeviceType;
    location?: string;
  }): Promise<IoTDevice[]> {
    let query = "SELECT * FROM iot_devices WHERE 1=1";
    const params: (string | number | boolean)[] = [];

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }
    if (filters?.type) {
      params.push(filters.type);
      query += ` AND type = $${params.length}`;
    }
    if (filters?.location) {
      params.push(`%${filters.location}%`);
      query += ` AND location ILIKE $${params.length}`;
    }

    query += " ORDER BY last_seen DESC";

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get device statistics
   */
  async getDeviceStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    maintenance: number;
    byType: Record<DeviceType, number>;
  }> {
    const result = await this.db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'online') as online,
        COUNT(*) FILTER (WHERE status = 'offline') as offline,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
        COUNT(*) FILTER (WHERE type = 'rfid_reader') as rfid_readers,
        COUNT(*) FILTER (WHERE type = 'biometric') as biometric,
        COUNT(*) FILTER (WHERE type = 'camera') as cameras,
        COUNT(*) FILTER (WHERE type = 'gateway') as gateways,
        COUNT(*) FILTER (WHERE type = 'sensor_hub') as sensor_hubs
      FROM iot_devices
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      online: parseInt(row.online, 10),
      offline: parseInt(row.offline, 10),
      maintenance: parseInt(row.maintenance, 10),
      byType: {
        rfid_reader: parseInt(row.rfid_readers, 10),
        biometric: parseInt(row.biometric, 10),
        camera: parseInt(row.cameras, 10),
        gateway: parseInt(row.gateways, 10),
        sensor_hub: parseInt(row.sensor_hubs, 10),
      },
    };
  }

  /**
   * Check device health and mark offline devices
   */
  async checkDeviceHealth(): Promise<void> {
    const offlineThreshold = new Date(Date.now() - 120000); // 2 minutes

    const result = await this.db.query(
      `UPDATE iot_devices 
       SET status = 'offline'
       WHERE status = 'online' 
       AND last_heartbeat < $1`,
      [offlineThreshold]
    );

    if (result.rowCount && result.rowCount > 0) {
      this.emit("devices:marked_offline", result.rowCount);
    }
  }

  /**
   * Update device configuration
   */
  async updateDeviceConfig(
    deviceId: string,
    config: Partial<DeviceConfig>
  ): Promise<void> {
    await this.db.query(
      `UPDATE iot_devices 
       SET config = config || $2::jsonb,
           updated_at = NOW()
       WHERE device_id = $1`,
      [deviceId, JSON.stringify(config)]
    );

    // Queue config update command
    await this.queueCommand(deviceId, "UPDATE_CONFIG", config);
  }

  /**
   * Decommission a device
   */
  async decommissionDevice(deviceId: string): Promise<void> {
    await this.db.query(
      `UPDATE iot_devices 
       SET status = 'decommissioned',
           api_key = NULL,
           secret_key = NULL,
           updated_at = NOW()
       WHERE device_id = $1`,
      [deviceId]
    );

    // Remove from cache
    if (this.redis) {
      const device = await this.getDeviceById(deviceId);
      if (device) {
        await this.redis.del(`device:credentials:${device.api_key}`);
      }
    }

    this.emit("device:decommissioned", deviceId);
  }

  /**
   * Get default configuration based on device type
   */
  private getDefaultConfig(type: DeviceType): DeviceConfig {
    const configs: Record<DeviceType, DeviceConfig> = {
      rfid_reader: {
        scan_interval: 100,
        debounce_time: 250,
        led_enabled: true,
        buzzer_enabled: true,
        auto_sync: true,
        sync_interval: 30000,
        offline_buffer: true,
        max_offline_records: 100,
      },
      biometric: {
        scan_interval: 500,
        debounce_time: 500,
        led_enabled: true,
        buzzer_enabled: true,
        auto_sync: true,
        sync_interval: 60000,
        offline_buffer: true,
        max_offline_records: 50,
      },
      camera: {
        scan_interval: 1000,
        debounce_time: 1000,
        led_enabled: false,
        buzzer_enabled: false,
        auto_sync: true,
        sync_interval: 60000,
        offline_buffer: false,
        max_offline_records: 0,
      },
      gateway: {
        scan_interval: 1000,
        debounce_time: 100,
        led_enabled: true,
        buzzer_enabled: false,
        auto_sync: true,
        sync_interval: 10000,
        offline_buffer: true,
        max_offline_records: 500,
      },
      sensor_hub: {
        scan_interval: 5000,
        debounce_time: 100,
        led_enabled: false,
        buzzer_enabled: false,
        auto_sync: true,
        sync_interval: 60000,
        offline_buffer: true,
        max_offline_records: 200,
      },
    };

    return configs[type] || configs.rfid_reader;
  }

  /**
   * Setup periodic cleanup tasks
   */
  private setupCleanup(): void {
    // Check device health every minute
    setInterval(() => this.checkDeviceHealth(), 60000);

    // Clean up old commands every 5 minutes
    setInterval(() => {
      const cutoff = Date.now() - 3600000; // 1 hour
      for (const [id, cmd] of this.commandQueue) {
        if (cmd.created_at.getTime() < cutoff && cmd.status === "pending") {
          cmd.status = "timeout";
          this.commandQueue.delete(id);
        }
      }
    }, 300000);
  }
}

export { IoTDeviceManager as iotDeviceManager };
