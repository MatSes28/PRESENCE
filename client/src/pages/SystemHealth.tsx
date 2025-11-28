import React, { useState, useEffect } from "react";
import { api } from "../lib/api";

interface HealthMetrics {
  server: {
    uptime: string;
    status: "healthy" | "warning" | "error";
    version: string;
  };
  database: {
    status: "connected" | "disconnected";
    connectionPool: {
      used: number;
      available: number;
      pending: number;
    };
  };
  websocket: {
    connections: number;
    status: "healthy" | "warning" | "error";
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  errors: Array<{
    timestamp: string;
    message: string;
    level: "error" | "warning" | "info";
  }>;
}

export const SystemHealth: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealthMetrics();
    const interval = setInterval(loadHealthMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadHealthMetrics = async () => {
    try {
      const response = await api.get<HealthMetrics>("/health");
      setMetrics(response.data);
    } catch (error) {
      console.error("Failed to load health metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
        return "text-green-600 bg-green-100";
      case "warning":
        return "text-yellow-600 bg-yellow-100";
      case "error":
      case "disconnected":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading system health...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-gray-500">
        Unable to load system health metrics
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">System Health</h2>

      {/* Server Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Server</h3>
          <div className="flex items-center space-x-2 mb-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                metrics.server.status
              )}`}
            >
              {metrics.server.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Uptime: {metrics.server.uptime}
          </p>
          <p className="text-sm text-gray-600">
            Version: {metrics.server.version}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Database</h3>
          <div className="flex items-center space-x-2 mb-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                metrics.database.status
              )}`}
            >
              {metrics.database.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Pool: {metrics.database.connectionPool.used}/
            {metrics.database.connectionPool.available}
          </p>
          <p className="text-sm text-gray-600">
            Pending: {metrics.database.connectionPool.pending}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            WebSocket
          </h3>
          <div className="flex items-center space-x-2 mb-2">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                metrics.websocket.status
              )}`}
            >
              {metrics.websocket.status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Connections: {metrics.websocket.connections}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Memory</h3>
          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full"
                style={{ width: `${metrics.memory.percentage}%` }}
              ></div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            {metrics.memory.used}MB / {metrics.memory.total}MB
          </p>
          <p className="text-sm text-gray-600">
            {metrics.memory.percentage}% used
          </p>
        </div>
      </div>

      {/* CPU Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">CPU Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Usage: {metrics.cpu.usage}%</p>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
              <div
                className="bg-blue-600 h-3 rounded-full"
                style={{ width: `${metrics.cpu.usage}%` }}
              ></div>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cores: {metrics.cpu.cores}</p>
          </div>
        </div>
      </div>

      {/* Error Logs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {metrics.errors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent errors
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {metrics.errors.map((error, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        error.level === "error"
                          ? "bg-red-100 text-red-800"
                          : error.level === "warning"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {error.level}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(error.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-900">{error.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
