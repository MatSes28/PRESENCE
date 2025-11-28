import { createClient, RedisClientType } from "redis";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheService {
  private client: RedisClientType;
  private isConnected = false;
  private defaultTTL = 300; // 5 minutes default
  private keyPrefix = "clirdec_presence:";

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    // Redis configuration with production optimizations
    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 60000,
      },
    });

    this.setupEventHandlers();
    this.connect();
  }

  private setupEventHandlers(): void {
    // Only log Redis connection events in development, completely silent in production
    const isDevelopment = process.env.NODE_ENV !== "production";

    this.client.on("error", (err) => {
      // Only log Redis errors in development environment
      if (isDevelopment) {
        console.warn("Redis Client Error:", err.message);
      }
      this.isConnected = false;
    });

    this.client.on("connect", () => {
      if (isDevelopment) {
        console.log("Connected to Redis");
      }
      this.isConnected = true;
    });

    this.client.on("disconnect", () => {
      if (isDevelopment) {
        console.log("Disconnected from Redis");
      }
      this.isConnected = false;
    });
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      console.warn("Failed to connect to Redis, caching disabled:", error);
      this.isConnected = false;
    }
  }

  private generateKey(key: string, prefix?: string): string {
    const fullPrefix = prefix || this.keyPrefix;
    return `${fullPrefix}${key}`;
  }

  // Generic cache operations
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this.generateKey(key, options.keyPrefix);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: options.ttl || this.defaultTTL,
      };

      await this.client.setEx(cacheKey, entry.ttl, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  async get<T>(key: string, prefix?: string): Promise<T | null> {
    if (!this.isConnected) return null;

    try {
      const cacheKey = this.generateKey(key, prefix);
      const cached = await this.client.get(cacheKey);

      if (!cached || cached === "") return null;

      const entry: CacheEntry<T> = JSON.parse(cached as string);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        await this.delete(key, prefix);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async delete(key: string, prefix?: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this.generateKey(key, prefix);
      await this.client.del(cacheKey);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  async clear(pattern: string = "*"): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const keys = await this.client.keys(this.generateKey(pattern));
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error("Cache clear error:", error);
      return false;
    }
  }

  async exists(key: string, prefix?: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this.generateKey(key, prefix);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error("Cache exists error:", error);
      return false;
    }
  }

  // Specialized caching methods for common data
  async getDashboardStats(): Promise<any | null> {
    return this.get("dashboard:stats");
  }

  async setDashboardStats(stats: any, ttl: number = 60): Promise<boolean> {
    return this.set("dashboard:stats", stats, { ttl });
  }

  async getUserData(userId: number): Promise<any | null> {
    return this.get(`user:${userId}`);
  }

  async setUserData(
    userId: number,
    data: any,
    ttl: number = 600
  ): Promise<boolean> {
    return this.set(`user:${userId}`, data, { ttl });
  }

  async getStudentData(studentId: string): Promise<any | null> {
    return this.get(`student:${studentId}`);
  }

  async setStudentData(
    studentId: string,
    data: any,
    ttl: number = 600
  ): Promise<boolean> {
    return this.set(`student:${studentId}`, data, { ttl });
  }

  async getSchedules(facultyId?: number, date?: string): Promise<any[] | null> {
    const key = facultyId ? `schedules:faculty:${facultyId}` : `schedules:all`;
    const dateKey = date ? `:${date}` : "";
    return this.get(`${key}${dateKey}`);
  }

  async setSchedules(
    schedules: any[],
    facultyId?: number,
    date?: string,
    ttl: number = 300
  ): Promise<boolean> {
    const key = facultyId ? `schedules:faculty:${facultyId}` : `schedules:all`;
    const dateKey = date ? `:${date}` : "";
    return this.set(`${key}${dateKey}`, schedules, { ttl });
  }

  async getActiveSessions(): Promise<any[] | null> {
    return this.get("sessions:active");
  }

  async setActiveSessions(sessions: any[], ttl: number = 60): Promise<boolean> {
    return this.set("sessions:active", sessions, { ttl });
  }

  async getAttendanceStats(sessionId: number): Promise<any | null> {
    return this.get(`attendance:stats:${sessionId}`);
  }

  async setAttendanceStats(
    sessionId: number,
    stats: any,
    ttl: number = 120
  ): Promise<boolean> {
    return this.set(`attendance:stats:${sessionId}`, stats, { ttl });
  }

  async getAnalyticsData(period: string): Promise<any | null> {
    return this.get(`analytics:${period}`);
  }

  async setAnalyticsData(
    period: string,
    data: any,
    ttl: number = 600
  ): Promise<boolean> {
    return this.set(`analytics:${period}`, data, { ttl });
  }

  async getComputerAssignments(sessionId: number): Promise<any[] | null> {
    return this.get(`computer_assignments:${sessionId}`);
  }

  async setComputerAssignments(
    sessionId: number,
    assignments: any[],
    ttl: number = 180
  ): Promise<boolean> {
    return this.set(`computer_assignments:${sessionId}`, assignments, { ttl });
  }

  async getIoTDevices(classroomId?: number): Promise<any[] | null> {
    const key = classroomId
      ? `iot_devices:classroom:${classroomId}`
      : "iot_devices:all";
    return this.get(key);
  }

  async setIoTDevices(
    devices: any[],
    classroomId?: number,
    ttl: number = 300
  ): Promise<boolean> {
    const key = classroomId
      ? `iot_devices:classroom:${classroomId}`
      : "iot_devices:all";
    return this.set(key, devices, { ttl });
  }

  async getEnrollments(
    studentId?: number,
    subjectId?: number
  ): Promise<any[] | null> {
    let key = "enrollments";
    if (studentId) key += `:student:${studentId}`;
    if (subjectId) key += `:subject:${subjectId}`;
    return this.get(key);
  }

  async setEnrollments(
    enrollments: any[],
    studentId?: number,
    subjectId?: number,
    ttl: number = 1800
  ): Promise<boolean> {
    let key = "enrollments";
    if (studentId) key += `:student:${studentId}`;
    if (subjectId) key += `:subject:${subjectId}`;
    return this.set(key, enrollments, { ttl });
  }

  // Cache invalidation methods
  async invalidateUserData(userId: number): Promise<void> {
    await this.delete(`user:${userId}`);
  }

  async invalidateStudentData(studentId: string): Promise<void> {
    await this.delete(`student:${studentId}`);
  }

  async invalidateSchedules(facultyId?: number): Promise<void> {
    if (facultyId) {
      await this.clear(`schedules:faculty:${facultyId}:*`);
    } else {
      await this.clear("schedules:*");
    }
  }

  async invalidateSessions(): Promise<void> {
    await this.delete("sessions:active");
  }

  async invalidateAttendance(sessionId?: number): Promise<void> {
    if (sessionId) {
      await this.delete(`attendance:stats:${sessionId}`);
    } else {
      await this.clear("attendance:*");
    }
  }

  async invalidateAnalytics(): Promise<void> {
    await this.clear("analytics:*");
  }

  async invalidateComputerAssignments(sessionId?: number): Promise<void> {
    if (sessionId) {
      await this.delete(`computer_assignments:${sessionId}`);
    } else {
      await this.clear("computer_assignments:*");
    }
  }

  async invalidateIoTDevices(classroomId?: number): Promise<void> {
    if (classroomId) {
      await this.delete(`iot_devices:classroom:${classroomId}`);
    } else {
      await this.delete("iot_devices:all");
      await this.clear("iot_devices:classroom:*");
    }
  }

  async invalidateEnrollments(
    studentId?: number,
    subjectId?: number
  ): Promise<void> {
    if (studentId || subjectId) {
      let pattern = "enrollments";
      if (studentId) pattern += `:student:${studentId}`;
      if (subjectId) pattern += `:subject:${subjectId}`;
      pattern += "*";
      await this.clear(pattern);
    } else {
      await this.clear("enrollments*");
    }
  }

  // Bulk cache operations
  async invalidateAll(): Promise<void> {
    await this.clear("*");
  }

  async getCacheStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: any;
  }> {
    if (!this.isConnected) {
      return { connected: false, keys: 0, memory: null };
    }

    try {
      const keys = await this.client.dbSize();
      const memory = await this.client.info("memory");
      return { connected: true, keys, memory };
    } catch (error) {
      console.error("Failed to get cache stats:", error);
      return { connected: false, keys: 0, memory: null };
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      return false;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

export const cacheService = new CacheService();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await cacheService.disconnect();
});

process.on("SIGINT", async () => {
  await cacheService.disconnect();
});
