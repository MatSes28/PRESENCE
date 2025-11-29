import { iotDeviceCommunication } from "./iotDeviceCommunication.js";
import { iotDeviceRegistry } from "./iotDeviceRegistry.js";

export interface HealthMetrics {
  deviceId: string;
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  temperature?: number;
  signalStrength?: number;
  errorCount: number;
  lastHealthCheck: Date;
}

export class IoTDeviceHealth {
  private healthMetrics = new Map<string, HealthMetrics>();

  async performHealthCheck(deviceId: string): Promise<HealthMetrics | null> {
    try {
      // Request health data from device
      const success = await iotDeviceCommunication.sendCommandToDevice(
        deviceId,
        "health_check"
      );

      if (!success) {
        return null;
      }

      // In a real implementation, the device would respond with health data
      // For now, we'll simulate health metrics
      const metrics: HealthMetrics = {
        deviceId,
        uptime: Math.floor(Math.random() * 86400), // Random uptime in seconds
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        temperature: 25 + Math.random() * 30, // 25-55°C
        signalStrength: Math.floor(Math.random() * 100),
        errorCount: Math.floor(Math.random() * 10),
        lastHealthCheck: new Date(),
      };

      this.healthMetrics.set(deviceId, metrics);
      return metrics;
    } catch (error) {
      console.error(`Health check failed for device ${deviceId}:`, error);
      return null;
    }
  }

  async getDeviceHealthMetrics(
    deviceId: string
  ): Promise<HealthMetrics | null> {
    return this.healthMetrics.get(deviceId) || null;
  }

  async getAllHealthMetrics(): Promise<HealthMetrics[]> {
    return Array.from(this.healthMetrics.values());
  }

  async performBulkHealthCheck(): Promise<{
    checked: number;
    healthy: number;
    issues: number;
  }> {
    const allDevices = await iotDeviceRegistry.getAllDevices();
    let checked = 0;
    let healthy = 0;
    let issues = 0;

    for (const device of allDevices) {
      const metrics = await this.performHealthCheck(device.device.deviceId);
      if (metrics) {
        checked++;
        // Simple health check: CPU < 90%, Memory < 90%, Temperature < 50°C
        if (
          metrics.cpuUsage < 90 &&
          metrics.memoryUsage < 90 &&
          (!metrics.temperature || metrics.temperature < 50)
        ) {
          healthy++;
        } else {
          issues++;
        }
      }
    }

    return { checked, healthy, issues };
  }

  async getMaintenanceRecommendations(): Promise<
    Array<{
      deviceId: string;
      recommendation: string;
      priority: "low" | "medium" | "high";
      reason: string;
    }>
  > {
    const recommendations = [];
    const healthMetrics = await this.getAllHealthMetrics();

    for (const metrics of healthMetrics) {
      if (metrics.cpuUsage > 85) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Schedule CPU performance check",
          priority: "medium",
          reason: `High CPU usage: ${metrics.cpuUsage.toFixed(1)}%`,
        });
      }

      if (metrics.memoryUsage > 85) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Check memory usage and clear cache",
          priority: "medium",
          reason: `High memory usage: ${metrics.memoryUsage.toFixed(1)}%`,
        });
      }

      if (metrics.temperature && metrics.temperature > 45) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Check cooling system and ventilation",
          priority: "high",
          reason: `High temperature: ${metrics.temperature.toFixed(1)}°C`,
        });
      }

      if (metrics.errorCount > 5) {
        recommendations.push({
          deviceId: metrics.deviceId,
          recommendation: "Review error logs and firmware update",
          priority: "high",
          reason: `High error count: ${metrics.errorCount} errors`,
        });
      }
    }

    return recommendations;
  }

  startHealthMonitoring(): void {
    // Perform health checks every 30 minutes
    setInterval(async () => {
      await this.performBulkHealthCheck();
    }, 30 * 60 * 1000);
  }
}

export const iotDeviceHealth = new IoTDeviceHealth();
