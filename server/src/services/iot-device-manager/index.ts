import {
  iotDeviceRegistry,
  type DeviceConfig,
  type DeviceStatus,
} from "./iotDeviceRegistry.js";
import { iotDeviceCommunication } from "./iotDeviceCommunication.js";
import {
  iotDeviceDiscovery,
  type DiscoveredDevice,
} from "./iotDeviceDiscovery.js";
import { iotDeviceHealth, type HealthMetrics } from "./iotDeviceHealth.js";
import { iotDeviceAuth } from "./iotDeviceAuth.js";
import { iotDeviceHeartbeat } from "./iotDeviceHeartbeat.js";

// Re-export types for backward compatibility
export type { DeviceConfig, DeviceStatus, DiscoveredDevice, HealthMetrics };

class IoTDeviceManager {
  // Registry methods
  async registerDevice(config: DeviceConfig) {
    return iotDeviceRegistry.registerDevice(config);
  }

  async updateDeviceStatus(
    deviceId: string,
    status: DeviceStatus["status"],
    config?: any
  ) {
    return iotDeviceRegistry.updateDeviceStatus(deviceId, status, config);
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus | null> {
    return iotDeviceRegistry.getDeviceStatus(deviceId);
  }

  async getDevicesByClassroom(classroomId: number) {
    return iotDeviceRegistry.getDevicesByClassroom(classroomId);
  }

  async getAllDevices() {
    return iotDeviceRegistry.getAllDevices();
  }

  async getOnlineDevices(): Promise<string[]> {
    return iotDeviceRegistry.getOnlineDevices();
  }

  async cleanupOfflineDevices() {
    return iotDeviceRegistry.cleanupOfflineDevices();
  }

  async getDeviceStats() {
    return iotDeviceRegistry.getDeviceStats();
  }

  // Communication methods
  async sendCommandToDevice(
    deviceId: string,
    command: string,
    params?: any
  ): Promise<boolean> {
    return iotDeviceCommunication.sendCommandToDevice(
      deviceId,
      command,
      params
    );
  }

  async configureDevice(deviceId: string, config: any): Promise<boolean> {
    return iotDeviceCommunication.configureDevice(deviceId, config);
  }

  async restartDevice(deviceId: string): Promise<boolean> {
    return iotDeviceCommunication.restartDevice(deviceId);
  }

  async updateDeviceFirmware(
    deviceId: string,
    firmwareUrl: string
  ): Promise<boolean> {
    return iotDeviceCommunication.updateDeviceFirmware(deviceId, firmwareUrl);
  }

  // Discovery methods
  async startNetworkDiscovery(
    subnet: string = "192.168.1.0/24"
  ): Promise<void> {
    return iotDeviceDiscovery.startNetworkDiscovery(subnet);
  }

  async stopNetworkDiscovery(): Promise<void> {
    return iotDeviceDiscovery.stopNetworkDiscovery();
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return iotDeviceDiscovery.getDiscoveredDevices();
  }

  async registerDiscoveredDevice(
    ip: string,
    classroomId: number
  ): Promise<boolean> {
    return iotDeviceDiscovery.registerDiscoveredDevice(ip, classroomId);
  }

  // Health monitoring methods
  async performHealthCheck(deviceId: string): Promise<HealthMetrics | null> {
    return iotDeviceHealth.performHealthCheck(deviceId);
  }

  async getDeviceHealthMetrics(
    deviceId: string
  ): Promise<HealthMetrics | null> {
    return iotDeviceHealth.getDeviceHealthMetrics(deviceId);
  }

  async getAllHealthMetrics(): Promise<HealthMetrics[]> {
    return iotDeviceHealth.getAllHealthMetrics();
  }

  async performBulkHealthCheck(): Promise<{
    checked: number;
    healthy: number;
    issues: number;
  }> {
    return iotDeviceHealth.performBulkHealthCheck();
  }

  async getMaintenanceRecommendations(): Promise<
    Array<{
      deviceId: string;
      recommendation: string;
      priority: "low" | "medium" | "high";
      reason: string;
    }>
  > {
    return iotDeviceHealth.getMaintenanceRecommendations();
  }

  // Authentication methods
  async authenticateDeviceByApiKey(
    apiKey: string
  ): Promise<{ deviceId: string; classroomId: number } | null> {
    return iotDeviceAuth.authenticateDeviceByApiKey(apiKey);
  }

  async authenticateDeviceByCertificate(
    fingerprint: string
  ): Promise<{ deviceId: string; classroomId: number } | null> {
    return iotDeviceAuth.authenticateDeviceByCertificate(fingerprint);
  }

  async updateDeviceCertificate(
    deviceId: string,
    certificateData: string,
    fingerprint: string
  ): Promise<boolean> {
    return iotDeviceAuth.updateDeviceCertificate(
      deviceId,
      certificateData,
      fingerprint
    );
  }

  async getDeviceApiKey(deviceId: string): Promise<string | null> {
    return iotDeviceAuth.getDeviceApiKey(deviceId);
  }

  async regenerateDeviceApiKey(deviceId: string): Promise<string | null> {
    return iotDeviceAuth.regenerateDeviceApiKey(deviceId);
  }

  // Heartbeat methods
  async recordHeartbeat(deviceId: string, heartbeatData: any) {
    return iotDeviceHeartbeat.recordHeartbeat(deviceId, heartbeatData);
  }

  async getHeartbeatHistory(deviceId: string, limit: number = 50) {
    return iotDeviceHeartbeat.getHeartbeatHistory(deviceId, limit);
  }

  async getDeviceHeartbeatStats(deviceId: string) {
    return iotDeviceHeartbeat.getDeviceHeartbeatStats(deviceId);
  }

  // Command validation method (for backward compatibility)
  async validateAndAuthorizeCommand(
    deviceId: string,
    command: string,
    params?: any
  ): Promise<{ authorized: boolean; reason?: string }> {
    return iotDeviceCommunication.validateAndAuthorizeCommand(
      deviceId,
      command,
      params
    );
  }

  // Start periodic tasks
  startPeriodicCleanup() {
    iotDeviceRegistry.startPeriodicCleanup();
  }

  startHealthMonitoring(): void {
    iotDeviceHealth.startHealthMonitoring();
  }

  startPeriodicCleanupForDiscovery(): void {
    iotDeviceDiscovery.startPeriodicCleanup();
  }
}

// Export singleton instance
export const iotDeviceManager = new IoTDeviceManager();

// Start periodic cleanup when module is loaded
iotDeviceManager.startPeriodicCleanup();
