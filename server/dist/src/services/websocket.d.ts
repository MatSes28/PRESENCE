import { WebSocketServer } from 'ws';
export declare function setupWebSocket(wss: WebSocketServer): void;
export declare function sendToDevice(deviceId: string, type: string, payload: any): boolean;
export declare function getConnectedDevices(): string[];
export declare function getConnectedWebClients(): string[];
//# sourceMappingURL=websocket.d.ts.map