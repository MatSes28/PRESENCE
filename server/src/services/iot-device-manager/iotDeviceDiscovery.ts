import * as dgram from "dgram";
import { iotDeviceRegistry } from "./iotDeviceRegistry.js";

export interface DiscoveredDevice {
  ip: string;
  mac?: string;
  deviceId?: string;
  deviceType?: string;
  hostname?: string;
  services?: string[];
  lastSeen: Date;
}

export class IoTDeviceDiscovery {
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  private discoveryServer?: dgram.Socket;
  private isDiscovering = false;

  async startNetworkDiscovery(
    subnet: string = "192.168.1.0/24"
  ): Promise<void> {
    if (this.isDiscovering) {
      throw new Error("Network discovery already in progress");
    }

    this.isDiscovering = true;
    console.log(`Starting network discovery on subnet: ${subnet}`);

    try {
      // Parse subnet
      const [baseIP, mask] = subnet.split("/");
      const prefix = baseIP.split(".").slice(0, 3).join(".");

      // Create UDP discovery server
      this.discoveryServer = dgram.createSocket("udp4");

      this.discoveryServer.on("message", (msg, rinfo) => {
        try {
          const message = JSON.parse(msg.toString());
          if (message.type === "device_announce") {
            this.handleDeviceAnnouncement(message, rinfo.address);
          }
        } catch (error) {
          // Ignore invalid messages
        }
      });

      this.discoveryServer.bind(41234, () => {
        console.log("Discovery server listening on port 41234");
      });

      // Send discovery broadcasts
      await this.sendDiscoveryBroadcasts(prefix);

      // Wait for responses
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
    } finally {
      this.stopNetworkDiscovery();
    }
  }

  private async sendDiscoveryBroadcasts(prefix: string): Promise<void> {
    const client = dgram.createSocket("udp4");

    for (let i = 1; i <= 254; i++) {
      const targetIP = `${prefix}.${i}`;
      const message = JSON.stringify({
        type: "discovery_request",
        serverIP: this.getLocalIP(),
        timestamp: new Date().toISOString(),
      });

      client.send(message, 0, message.length, 41234, targetIP, (err) => {
        if (err) {
          // Ignore send errors
        }
      });
    }

    // Also try broadcast
    const broadcastMessage = JSON.stringify({
      type: "discovery_broadcast",
      serverIP: this.getLocalIP(),
      timestamp: new Date().toISOString(),
    });

    client.send(
      broadcastMessage,
      0,
      broadcastMessage.length,
      41234,
      `${prefix}.255`
    );
    client.close();
  }

  private handleDeviceAnnouncement(message: any, ip: string): void {
    const device: DiscoveredDevice = {
      ip,
      mac: message.mac,
      deviceId: message.deviceId,
      deviceType: message.deviceType,
      hostname: message.hostname,
      services: message.services || [],
      lastSeen: new Date(),
    };

    this.discoveredDevices.set(ip, device);
    console.log(
      `Discovered device: ${device.deviceId || device.hostname} at ${ip}`
    );
  }

  async stopNetworkDiscovery(): Promise<void> {
    if (this.discoveryServer) {
      this.discoveryServer.close();
      this.discoveryServer = undefined;
    }
    this.isDiscovering = false;
    console.log("Network discovery stopped");
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  async registerDiscoveredDevice(
    ip: string,
    classroomId: number
  ): Promise<boolean> {
    const device = this.discoveredDevices.get(ip);
    if (!device || !device.deviceId) {
      return false;
    }

    try {
      await iotDeviceRegistry.registerDevice({
        deviceId: device.deviceId,
        classroomId,
        deviceType: device.deviceType || "unknown",
        config: {
          ip: device.ip,
          mac: device.mac,
          hostname: device.hostname,
          services: device.services,
        },
      });
      return true;
    } catch (error) {
      console.error("Failed to register discovered device:", error);
      return false;
    }
  }

  private getLocalIP(): string {
    // In a real implementation, you'd detect the local IP
    // For now, return a placeholder
    return "192.168.1.100";
  }

  private cleanupDiscoveredDevices(): void {
    const now = Date.now();
    const timeout = 24 * 60 * 60 * 1000; // 24 hours

    for (const [ip, device] of this.discoveredDevices) {
      if (now - device.lastSeen.getTime() > timeout) {
        this.discoveredDevices.delete(ip);
      }
    }

    console.log("Cleaned up old discovered devices");
  }

  startPeriodicCleanup(): void {
    // Clean up old discovered devices every hour
    setInterval(() => {
      this.cleanupDiscoveredDevices();
    }, 60 * 60 * 1000);
  }
}

export const iotDeviceDiscovery = new IoTDeviceDiscovery();
