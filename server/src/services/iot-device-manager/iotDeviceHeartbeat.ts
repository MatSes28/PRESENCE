import db from "../../storage.js";
import { iotDeviceHeartbeats } from "../../schema.js";
import { eq, desc } from "drizzle-orm";

export class IoTDeviceHeartbeat {
  async recordHeartbeat(deviceId: string, heartbeatData: any) {
    try {
      await db.insert(iotDeviceHeartbeats).values({
        deviceId,
        status: "online",
        batteryLevel: heartbeatData.batteryLevel,
        signalStrength: heartbeatData.signalStrength,
        temperature: heartbeatData.temperature,
        uptime: heartbeatData.uptime,
        metadata: heartbeatData.metadata || {},
      });

      console.log(`Heartbeat recorded for device ${deviceId}`);
    } catch (error) {
      console.error(`Error recording heartbeat for device ${deviceId}:`, error);
    }
  }

  async getHeartbeatHistory(deviceId: string, limit: number = 50) {
    try {
      return await db
        .select()
        .from(iotDeviceHeartbeats)
        .where(eq(iotDeviceHeartbeats.deviceId, deviceId))
        .orderBy(desc(iotDeviceHeartbeats.timestamp))
        .limit(limit);
    } catch (error) {
      console.error(
        `Error getting heartbeat history for device ${deviceId}:`,
        error
      );
      return [];
    }
  }

  async getDeviceHeartbeatStats(deviceId: string) {
    try {
      const history = await this.getHeartbeatHistory(deviceId, 100);
      if (history.length === 0) {
        return null;
      }

      const latest = history[0];
      const avgBattery =
        history.reduce((sum, h) => sum + (h.batteryLevel || 0), 0) /
        history.length;
      const avgSignal =
        history.reduce((sum, h) => sum + (h.signalStrength || 0), 0) /
        history.length;
      const avgTemp =
        history.reduce((sum, h) => sum + (h.temperature || 0), 0) /
        history.length;

      return {
        deviceId,
        latestHeartbeat: latest,
        averageBatteryLevel: Math.round(avgBattery),
        averageSignalStrength: Math.round(avgSignal),
        averageTemperature: Math.round(avgTemp),
        totalHeartbeats: history.length,
        timeRange: {
          from: history[history.length - 1]?.timestamp,
          to: latest.timestamp,
        },
      };
    } catch (error) {
      console.error(
        `Error getting heartbeat stats for device ${deviceId}:`,
        error
      );
      return null;
    }
  }
}

export const iotDeviceHeartbeat = new IoTDeviceHeartbeat();
