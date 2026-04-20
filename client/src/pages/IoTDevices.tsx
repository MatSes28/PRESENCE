import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useNotifications } from "../components/NotificationSystem";

type DeviceType = "esp32_s3" | "rfid_reader" | "ultrasonic_sensor";

interface DeviceConfig {
  rfidEnabled?: boolean;
  ultrasonicEnabled?: boolean;
  heartbeatInterval?: number;
  sensorThreshold?: number;
  sync_interval?: number;
  [key: string]: unknown;
}

interface IoTDevice {
  device: {
    id: number;
    deviceId: string;
    classroomId: number;
    deviceType: DeviceType | string;
    status: "online" | "offline" | "maintenance" | "pending" | "error";
    lastSeen: string | null;
    config: DeviceConfig | null;
    apiKey?: string;
    certificateFingerprint?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  classroom: {
    id: number;
    name: string;
    location: string;
    type: string;
    capacity: number | null;
  };
}

interface Classroom {
  id: number;
  name: string;
  location: string;
}

interface RegistrationFormState {
  deviceId: string;
  classroomId: string;
  deviceType: DeviceType;
  config: {
    rfidEnabled: boolean;
    ultrasonicEnabled: boolean;
    heartbeatInterval: number;
    sensorThreshold: number;
  };
}

const defaultRegistrationForm = (): RegistrationFormState => ({
  deviceId: "",
  classroomId: "",
  deviceType: "esp32_s3",
  config: {
    rfidEnabled: true,
    ultrasonicEnabled: true,
    heartbeatInterval: 30000,
    sensorThreshold: 50,
  },
});

const fieldClassName =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500";

const modalCardClassName =
  "relative top-16 mx-auto w-full max-w-md rounded-lg border border-gray-700 bg-gray-800 p-6 shadow-2xl";

export const IoTDevices = () => {
  const { addNotification } = useNotifications();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [commandTarget, setCommandTarget] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [regeneratingApiKey, setRegeneratingApiKey] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<IoTDevice | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityDeviceId, setSecurityDeviceId] = useState<string | null>(null);
  const [deviceApiKey, setDeviceApiKey] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(
    defaultRegistrationForm(),
  );

  useEffect(() => {
    void loadInitialData();
  }, []);

  const stats = useMemo(
    () => ({
      total: devices.length,
      online: devices.filter((entry) => entry.device.status === "online").length,
      offline: devices.filter((entry) => entry.device.status === "offline").length,
      maintenance: devices.filter((entry) => entry.device.status === "maintenance").length,
    }),
    [devices],
  );

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    const apiMessage = (error as any)?.data?.message;
    if (typeof apiMessage === "string" && apiMessage.trim()) {
      return apiMessage;
    }

    return fallback;
  };

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([loadDevices(true), loadClassrooms(true)]);
    setLoading(false);
  };

  const loadDevices = async (silent: boolean = false) => {
    try {
      const response = (await api.get("/iot/devices")) as {
        success?: boolean;
        message?: string;
        data?: IoTDevice[];
        devices?: IoTDevice[];
      };

      const nextDevices = response.devices ?? response.data ?? [];
      setDevices(Array.isArray(nextDevices) ? nextDevices : []);

      if (!silent && response.success === false) {
        addNotification({
          type: "error",
          title: "Unable to Load Devices",
          message: response.message || "The device list could not be refreshed.",
        });
      }
    } catch (error) {
      console.error("Failed to load IoT devices:", error);
      setDevices([]);

      if (!silent) {
        addNotification({
          type: "error",
          title: "Network Error",
          message: getErrorMessage(error, "Failed to load IoT devices."),
        });
      }
    }
  };

  const loadClassrooms = async (silent: boolean = false) => {
    try {
      const response = (await api.get("/classrooms")) as {
        success?: boolean;
        message?: string;
        data?: Classroom[];
      };

      const nextClassrooms = response.data ?? [];
      setClassrooms(Array.isArray(nextClassrooms) ? nextClassrooms : []);

      if (!silent && response.success === false) {
        addNotification({
          type: "error",
          title: "Unable to Load Rooms",
          message: response.message || "The room list could not be refreshed.",
        });
      }
    } catch (error) {
      console.error("Failed to load classrooms:", error);
      setClassrooms([]);

      if (!silent) {
        addNotification({
          type: "error",
          title: "Network Error",
          message: getErrorMessage(error, "Failed to load rooms."),
        });
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDevices(), loadClassrooms()]);
    setRefreshing(false);
    addNotification({
      type: "success",
      title: "Device List Refreshed",
      message: "Latest IoT device status has been loaded.",
    });
  };

  const resetRegistrationForm = () => {
    setRegistrationForm(defaultRegistrationForm());
  };

  const validateRegistrationForm = () => {
    if (!registrationForm.deviceId.trim()) {
      addNotification({
        type: "error",
        title: "Device ID Required",
        message: "Enter the ESP32 device ID before registering.",
      });
      return false;
    }

    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(registrationForm.deviceId.trim())) {
      addNotification({
        type: "error",
        title: "Invalid Device ID",
        message: "Use 3-50 letters, numbers, hyphens, or underscores only.",
      });
      return false;
    }

    if (!registrationForm.classroomId) {
      addNotification({
        type: "error",
        title: "Classroom Required",
        message: "Select the room where this device will be installed.",
      });
      return false;
    }

    if (classrooms.length === 0) {
      addNotification({
        type: "error",
        title: "No Rooms Available",
        message: "Create a room first in the Rooms page before registering a device.",
      });
      return false;
    }

    return true;
  };

  const handleRegisterDevice = async () => {
    if (!validateRegistrationForm()) {
      return;
    }

    setRegistering(true);

    const payload = {
      deviceId: registrationForm.deviceId.trim(),
      classroomId: Number(registrationForm.classroomId),
      deviceType: registrationForm.deviceType,
      config: registrationForm.config,
    };

    try {
      const response = (await api.post("/iot/devices", payload)) as {
        success?: boolean;
        message?: string;
        device?: {
          deviceId?: string;
          api_key?: string;
          apiKey?: string;
        };
      };

      await loadDevices(true);

      setShowRegisterModal(false);
      resetRegistrationForm();

      addNotification({
        type: "success",
        title: "Device Registered",
        message:
          response.message ||
          `${payload.deviceId} is now registered and ready for setup.`,
      });

      const returnedApiKey = response.device?.api_key ?? response.device?.apiKey ?? null;
      if (returnedApiKey) {
        setSecurityDeviceId(payload.deviceId);
        setDeviceApiKey(returnedApiKey);
        setShowSecurityModal(true);
        addNotification({
          type: "info",
          title: "Copy the Device API Key",
          message: `Use this key in the ESP32 firmware for ${payload.deviceId}.`,
        });
      }
    } catch (error) {
      console.error("Failed to register device:", error);
      addNotification({
        type: "error",
        title: "Registration Failed",
        message: getErrorMessage(error, "The device could not be registered."),
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleSendCommand = async (
    deviceId: string,
    command: string,
    params?: unknown,
  ) => {
    setCommandTarget(`${deviceId}:${command}`);
    try {
      await api.post(`/iot/devices/${deviceId}/command`, { command, params });
      addNotification({
        type: "success",
        title: "Command Sent",
        message: `${command} was sent to ${deviceId}.`,
      });
    } catch (error) {
      console.error("Failed to send command:", error);
      addNotification({
        type: "error",
        title: "Command Failed",
        message: getErrorMessage(error, `Failed to send ${command} to ${deviceId}.`),
      });
    } finally {
      setCommandTarget(null);
    }
  };

  const handleUpdateConfig = async () => {
    if (!selectedDevice) {
      return;
    }

    setUpdatingConfig(true);
    try {
      await api.put(`/iot/devices/${selectedDevice.device.deviceId}/config`, {
        config: selectedDevice.device.config,
      });

      await loadDevices(true);
      setShowConfigModal(false);
      setSelectedDevice(null);

      addNotification({
        type: "success",
        title: "Configuration Updated",
        message: "The device configuration was saved successfully.",
      });
    } catch (error) {
      console.error("Failed to update config:", error);
      addNotification({
        type: "error",
        title: "Update Failed",
        message: getErrorMessage(error, "Failed to update device configuration."),
      });
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleOpenSecurity = async (deviceId: string) => {
    setSecurityDeviceId(deviceId);
    setDeviceApiKey(null);
    setShowSecurityModal(true);
    setApiKeyLoading(true);

    try {
      const response = (await api.get(`/iot/devices/${deviceId}/api-key`)) as {
        data?: { apiKey?: string };
        apiKey?: string;
      };

      setDeviceApiKey(response.apiKey ?? response.data?.apiKey ?? null);
    } catch (error) {
      console.error("Failed to get API key:", error);
      addNotification({
        type: "error",
        title: "Unable to Load API Key",
        message: getErrorMessage(error, `Failed to load the API key for ${deviceId}.`),
      });
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!securityDeviceId) {
      return;
    }

    setRegeneratingApiKey(true);
    try {
      const response = (await api.post(
        `/iot/devices/${securityDeviceId}/regenerate-api-key`,
      )) as { data?: { apiKey?: string }; apiKey?: string };

      const nextApiKey = response.apiKey ?? response.data?.apiKey ?? null;
      setDeviceApiKey(nextApiKey);

      addNotification({
        type: "success",
        title: "API Key Regenerated",
        message: `A new API key was created for ${securityDeviceId}.`,
      });
    } catch (error) {
      console.error("Failed to regenerate API key:", error);
      addNotification({
        type: "error",
        title: "Regeneration Failed",
        message: getErrorMessage(error, "Failed to regenerate the API key."),
      });
    } finally {
      setRegeneratingApiKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (!deviceApiKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(deviceApiKey);
      addNotification({
        type: "success",
        title: "API Key Copied",
        message: "Paste it into the ESP32 firmware before uploading.",
      });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Copy Failed",
        message: getErrorMessage(error, "The API key could not be copied."),
      });
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "online":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      case "offline":
        return "border-rose-500/30 bg-rose-500/10 text-rose-300";
      case "maintenance":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
      case "pending":
        return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
      default:
        return "border-gray-600 bg-gray-700/60 text-gray-300";
    }
  };

  const getDeviceTypeLabel = (deviceType: string) => {
    switch (deviceType) {
      case "esp32_s3":
        return "ESP32-S3";
      case "rfid_reader":
        return "RFID Reader";
      case "ultrasonic_sensor":
        return "Ultrasonic Sensor";
      default:
        return deviceType;
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "esp32_s3":
        return "📡";
      case "rfid_reader":
        return "🪪";
      case "ultrasonic_sensor":
        return "📏";
      default:
        return "🔧";
    }
  };

  const getHeartbeatLabel = (config: DeviceConfig | null) => {
    const interval = config?.heartbeatInterval ?? config?.sync_interval;
    return typeof interval === "number" ? `${interval} ms` : "Not set";
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-gray-700 bg-gray-800/70">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500" />
          <p className="mt-4 text-sm text-gray-300">Loading IoT devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-lg border border-gray-700 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-400">
              Device Control
            </p>
            <h2 className="text-2xl font-semibold text-white">IoT Device Management</h2>
            <p className="max-w-2xl text-sm text-gray-300">
              Register ESP32 attendance devices, manage their configuration, and copy the API key needed for firmware setup.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
            >
              Register Device
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-cyan-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {classrooms.length === 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            No rooms are available yet. Create a room in `Rooms` first, then return here to register an ESP32.
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Devices", value: stats.total, accent: "text-cyan-400", icon: "📊" },
          { label: "Online", value: stats.online, accent: "text-emerald-400", icon: "🟢" },
          { label: "Offline", value: stats.offline, accent: "text-rose-400", icon: "🔴" },
          { label: "Maintenance", value: stats.maintenance, accent: "text-amber-400", icon: "🟡" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-700 bg-gray-800 p-4 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="text-2xl">{card.icon}</div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">{card.label}</p>
                <p className={`text-2xl font-semibold ${card.accent}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {devices.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-600 bg-gray-800/70 p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-3xl">
            📡
          </div>
          <h3 className="text-lg font-semibold text-white">No IoT devices registered</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
            Add your first ESP32 device, then copy its API key into the firmware before uploading the sketch.
          </p>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="mt-6 rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Register Device
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {devices.map((deviceData) => {
            const { device, classroom } = deviceData;
            const activeCommand = commandTarget?.startsWith(`${device.deviceId}:`);

            return (
              <article
                key={device.id}
                className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-lg"
              >
                <div className="border-b border-gray-700 bg-gray-900/60 px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/10 text-2xl">
                        {getDeviceIcon(device.deviceType)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{device.deviceId}</h3>
                        <p className="text-sm text-gray-400">{classroom.name}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-4 py-1 text-xs font-medium capitalize ${getStatusBadgeClass(
                        device.status,
                      )}`}
                    >
                      {device.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 px-6 py-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
                      <p className="mt-1 text-gray-100">{getDeviceTypeLabel(device.deviceType)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Room</p>
                      <p className="mt-1 text-gray-100">{classroom.name}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Last Seen</p>
                      <p className="mt-1 text-gray-100">
                        {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "Never"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Heartbeat</p>
                      <p className="mt-1 text-gray-100">{getHeartbeatLabel(device.config)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm">
                    <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Configuration</p>
                    <div className="space-y-1 text-gray-200">
                      <div>
                        RFID: {device.config?.rfidEnabled === false ? "Disabled" : "Enabled"}
                      </div>
                      <div>
                        Ultrasonic: {device.config?.ultrasonicEnabled === false ? "Disabled" : "Enabled"}
                      </div>
                      <div>Threshold: {device.config?.sensorThreshold ?? "Not set"}</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-700 bg-gray-900/50 px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSendCommand(device.deviceId, "ping")}
                      disabled={!!activeCommand}
                      className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {commandTarget === `${device.deviceId}:ping` ? "Sending..." : "Ping"}
                    </button>
                    <button
                      onClick={() => handleSendCommand(device.deviceId, "restart")}
                      disabled={!!activeCommand}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {commandTarget === `${device.deviceId}:restart` ? "Sending..." : "Restart"}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDevice(deviceData);
                        setShowConfigModal(true);
                      }}
                      className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-xs font-medium text-gray-200 transition hover:border-cyan-500 hover:text-white"
                    >
                      Configure
                    </button>
                    <button
                      onClick={() => handleSendCommand(device.deviceId, "diagnostics")}
                      disabled={!!activeCommand}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {commandTarget === `${device.deviceId}:diagnostics` ? "Sending..." : "Diagnostics"}
                    </button>
                    <button
                      onClick={() => void handleOpenSecurity(device.deviceId)}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
                    >
                      Security
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {showRegisterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className={modalCardClassName}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">
                  New Device
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">Register IoT Device</h3>
                <p className="mt-1 text-sm text-gray-400">
                  Create the device record first, then copy the generated API key into the ESP32 firmware.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="iot-register-device-id" className="mb-1 block text-sm font-medium text-gray-200">
                    Device ID
                  </label>
                  <input
                    id="iot-register-device-id"
                    name="deviceId"
                    type="text"
                    value={registrationForm.deviceId}
                    onChange={(e) =>
                      setRegistrationForm((prev) => ({
                        ...prev,
                        deviceId: e.target.value,
                      }))
                    }
                    className={fieldClassName}
                    placeholder="ESP32-001"
                  />
                </div>

                <div>
                  <label htmlFor="iot-register-classroom" className="mb-1 block text-sm font-medium text-gray-200">
                    Classroom
                  </label>
                  <select
                    id="iot-register-classroom"
                    name="classroomId"
                    value={registrationForm.classroomId}
                    onChange={(e) =>
                      setRegistrationForm((prev) => ({
                        ...prev,
                        classroomId: e.target.value,
                      }))
                    }
                    className={fieldClassName}
                  >
                    <option value="">Select Classroom</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="iot-register-device-type" className="mb-1 block text-sm font-medium text-gray-200">
                    Device Type
                  </label>
                  <select
                    id="iot-register-device-type"
                    name="deviceType"
                    value={registrationForm.deviceType}
                    onChange={(e) =>
                      setRegistrationForm((prev) => ({
                        ...prev,
                        deviceType: e.target.value as DeviceType,
                      }))
                    }
                    className={fieldClassName}
                  >
                    <option value="esp32_s3">ESP32-S3</option>
                    <option value="rfid_reader">RFID Reader</option>
                    <option value="ultrasonic_sensor">Ultrasonic Sensor</option>
                  </select>
                </div>
              </div>

              {classrooms.length === 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                  Registration is disabled until at least one room exists.
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    resetRegistrationForm();
                  }}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterDevice}
                  disabled={registering || classrooms.length === 0}
                  className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {registering ? "Registering..." : "Register Device"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && selectedDevice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className={modalCardClassName}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">Configuration</p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {selectedDevice.device.deviceId}
                </h3>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={selectedDevice.device.config?.rfidEnabled ?? true}
                    onChange={(e) =>
                      setSelectedDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              device: {
                                ...prev.device,
                                config: {
                                  ...(prev.device.config ?? {}),
                                  rfidEnabled: e.target.checked,
                                },
                              },
                            }
                          : prev,
                      )
                    }
                  />
                  Enable RFID scanning
                </label>

                <label className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={selectedDevice.device.config?.ultrasonicEnabled ?? true}
                    onChange={(e) =>
                      setSelectedDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              device: {
                                ...prev.device,
                                config: {
                                  ...(prev.device.config ?? {}),
                                  ultrasonicEnabled: e.target.checked,
                                },
                              },
                            }
                          : prev,
                      )
                    }
                  />
                  Enable ultrasonic sensor
                </label>

                <div>
                  <label htmlFor="iot-heartbeat-interval" className="mb-1 block text-sm font-medium text-gray-200">
                    Heartbeat Interval (ms)
                  </label>
                  <input
                    id="iot-heartbeat-interval"
                    name="heartbeatInterval"
                    type="number"
                    value={selectedDevice.device.config?.heartbeatInterval ?? 30000}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setSelectedDevice((prev) =>
                        prev
                          ? {
                              ...prev,
                              device: {
                                ...prev.device,
                                config: {
                                  ...(prev.device.config ?? {}),
                                  heartbeatInterval: Number.isFinite(value) ? value : 30000,
                                },
                              },
                            }
                          : prev,
                      );
                    }}
                    className={fieldClassName}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    setSelectedDevice(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateConfig}
                  disabled={updatingConfig}
                  className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updatingConfig ? "Saving..." : "Update Configuration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSecurityModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className={modalCardClassName}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400">Device Security</p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {securityDeviceId ? `${securityDeviceId} API Key` : "Device API Key"}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Copy this key into `DEVICE_API_KEY` in the ESP32 firmware before uploading.
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-200">API Key</p>
                <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-4 font-mono text-sm break-all text-cyan-300">
                  {apiKeyLoading
                    ? "Loading API key..."
                    : deviceApiKey || "API key unavailable."}
                </div>
              </div>

              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                Paste this value into `ESP32_S3_DUAL_SENSOR_ATTENDANCE/ESP32_S3_DUAL_SENSOR_ATTENDANCE.ino` at `const char* DEVICE_API_KEY = "...";`
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleRegenerateApiKey}
                  disabled={regeneratingApiKey || !securityDeviceId}
                  className="flex-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {regeneratingApiKey ? "Regenerating..." : "Regenerate API Key"}
                </button>
                <button
                  onClick={handleCopyKey}
                  disabled={!deviceApiKey}
                  className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Copy Key
                </button>
              </div>

              <button
                onClick={() => {
                  setShowSecurityModal(false);
                  setDeviceApiKey(null);
                  setSecurityDeviceId(null);
                }}
                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-gray-500 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

