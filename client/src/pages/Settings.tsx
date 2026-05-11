import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import {
  useFormValidation,
  commonValidationRules,
} from "../hooks/useFormValidation";
import { api, getApiPayload } from "../lib/api";
import type { ApiRequestError } from "../lib/api";

interface SettingsAuditEvent {
  id: string;
  timestamp: string;
  userId?: number;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

interface SystemSettings {
  lateThreshold: number;
  absentThreshold: number;
  emailNotifications: boolean;
  semester: string;
  academicYear: string;
}

interface HardwareSettings {
  rfidScannerPort: string;
  proximitySensorThreshold: number;
  dualValidation: boolean;
  autoReconnect: boolean;
}

interface EmailSettings {
  smtpServer: string;
  senderEmail: string;
  absenceThreshold: number;
  dailySummary: boolean;
  lateNotifications: boolean;
}

interface SettingsResponse<T> {
  success?: boolean;
  message?: string;
  settings?: T;
}

export const Settings = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState<
    "profile" | "password" | "system" | "hardware" | "email" | null
  >(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditReloadKey, setAuditReloadKey] = useState(0);
  const [settingsAuditEvents, setSettingsAuditEvents] = useState<
    SettingsAuditEvent[]
  >([]);

  // Form validation hooks
  const profileValidation = useFormValidation({
    name: commonValidationRules.name,
    email: commonValidationRules.email,
  });

  const passwordValidation = useFormValidation({
    currentPassword: { required: true },
    newPassword: commonValidationRules.password,
    confirmPassword: commonValidationRules.confirmPassword("newPassword"),
  });

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    lateThreshold: 15, // Default: 15 minutes as per paper
    absentThreshold: 60, // Default: 60% of class time as per paper
    emailNotifications: true,
    semester: "1st Semester",
    academicYear: new Date().getFullYear().toString(),
  });

  const [hardwareSettings, setHardwareSettings] = useState<HardwareSettings>({
    rfidScannerPort: "COM3",
    proximitySensorThreshold: 5,
    dualValidation: true,
    autoReconnect: true,
  });

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    smtpServer: "smtp.gmail.com",
    senderEmail: "clirdec.presence@clsu.edu.ph",
    absenceThreshold: 3,
    dailySummary: true,
    lateNotifications: true,
  });

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.role !== "admin") return;
      try {
        const [systemRes, hardwareRes, emailRes] = await Promise.all([
          api.get("/settings/system") as Promise<
            SettingsResponse<SystemSettings>
          >,
          api.get("/settings/hardware") as Promise<
            SettingsResponse<HardwareSettings>
          >,
          api.get("/settings/email") as Promise<SettingsResponse<EmailSettings>>,
        ]);

        // API returns { success, settings } directly (no .data wrapper)
        if (systemRes?.success && systemRes.settings) {
          setSystemSettings(systemRes.settings);
        }
        if (hardwareRes?.success && hardwareRes.settings) {
          setHardwareSettings(hardwareRes.settings);
        }
        if (emailRes?.success && emailRes.settings) {
          setEmailSettings(emailRes.settings);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        const status = (error as ApiRequestError)?.status;
        const isForbidden = status === 403;
        addNotification({
          type: "error",
          title: "Settings Load Failed",
          message: isForbidden
            ? "You do not have permission to view settings."
            : "Could not load current settings from server",
        });
      }
    };

    loadSettings();
  }, [user?.role, addNotification]);

  useEffect(() => {
    if (
      user?.role !== "admin" &&
      ["hardware", "email", "system", "audit"].includes(activeTab)
    ) {
      setActiveTab("profile");
    }
  }, [activeTab, user?.role]);

  useEffect(() => {
    if (activeTab !== "audit" || user?.role !== "admin") return;

    const loadAuditEvents = async () => {
      setAuditLoading(true);
      try {
        const response = await api.get<{ data?: SettingsAuditEvent[] }>(
          "/audit/events?action=SETTINGS_UPDATED&resource=settings&limit=10",
        );
        const result = getApiPayload(response);
        setSettingsAuditEvents(Array.isArray(result?.data) ? result.data : []);
      } catch (error) {
        console.error("Failed to load settings audit events:", error);
        addNotification({
          type: "error",
          title: "Audit Load Failed",
          message: "Could not load recent settings audit events.",
        });
      } finally {
        setAuditLoading(false);
      }
    };

    loadAuditEvents();
  }, [activeTab, addNotification, auditReloadKey, user?.role]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profileValidation.validateForm(profileData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    setSaving("profile");
    try {
      const response = await api.put<SettingsResponse<typeof profileData>>(
        "/settings/profile",
        profileData,
      );
      const result = getApiPayload(response);
      if (result?.success) {
        addNotification({
          type: "success",
          title: "Profile Updated",
          message: "Your profile has been updated successfully",
        });
      } else {
        throw new Error(result?.message || "Update failed");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      addNotification({
        type: "error",
        title: "Update Failed",
        message: "Could not update profile. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.validateForm(passwordData)) {
      addNotification({
        type: "error",
        title: "Validation Error",
        message: "Please fix the errors in the form",
      });
      return;
    }

    try {
      const response = await api.put<SettingsResponse<never>>(
        "/settings/password",
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
      );
      const result = getApiPayload(response);
      if (result?.success) {
        addNotification({
          type: "success",
          title: "Password Changed",
          message: "Your password has been changed successfully",
        });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        passwordValidation.clearErrors();
      } else {
        throw new Error(result?.message || "Password change failed");
      }
    } catch (error) {
      console.error("Password change error:", error);
      addNotification({
        type: "error",
        title: "Password Change Failed",
        message: "Could not change password. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleSystemSettingsSave = async () => {
    setSaving("system");
    setSaving("password");
    try {
      const response = await api.put<SettingsResponse<SystemSettings>>(
        "/settings/system",
        systemSettings,
      );
      const result = getApiPayload(response);
      if (result?.success) {
        if (result.settings) setSystemSettings(result.settings);
        addNotification({
          type: "success",
          title: "System Settings Saved",
          message: "System settings have been saved successfully",
        });
      } else {
        throw new Error(result?.message || "Save failed");
      }
    } catch (error) {
      console.error("System settings save error:", error);
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Could not save system settings. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleHardwareSettingsSave = async () => {
    setSaving("hardware");
    try {
      const response = await api.put<SettingsResponse<HardwareSettings>>(
        "/settings/hardware",
        hardwareSettings,
      );
      const result = getApiPayload(response);
      if (result?.success) {
        if (result.settings) setHardwareSettings(result.settings);
        addNotification({
          type: "success",
          title: "Hardware Settings Saved",
          message: "Hardware settings have been saved successfully",
        });
      } else {
        throw new Error(result?.message || "Save failed");
      }
    } catch (error) {
      console.error("Hardware settings save error:", error);
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Could not save hardware settings. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleEmailSettingsSave = async () => {
    setSaving("email");
    try {
      const response = await api.put<SettingsResponse<EmailSettings>>(
        "/settings/email",
        emailSettings,
      );
      const result = getApiPayload(response);
      if (result?.success) {
        if (result.settings) setEmailSettings(result.settings);
        addNotification({
          type: "success",
          title: "Email Settings Saved",
          message: "Email settings have been saved successfully",
        });
      } else {
        throw new Error(result?.message || "Save failed");
      }
    } catch (error) {
      console.error("Email settings save error:", error);
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Could not save email settings. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤", adminOnly: false },
    { id: "security", label: "Security", icon: "🔒", adminOnly: false },
    { id: "hardware", label: "Hardware", icon: "🔧", adminOnly: true },
    { id: "email", label: "Email", icon: "📧", adminOnly: true },
    { id: "system", label: "System", icon: "⚙️", adminOnly: true },
    { id: "audit", label: "Audit", icon: "🧾", adminOnly: true },
  ].filter((tab) => user?.role === "admin" || !tab.adminOnly);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-white">Settings</h3>
        <p className="text-sm text-gray-300">
          Manage your profile and security settings
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="bg-gray-800 shadow rounded-lg">
        <div className="border-b border-gray-700">
          <nav className="flex gap-3 overflow-x-auto px-6" aria-label="Settings sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-none whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium ${
                  activeTab === tab.id
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Profile Settings */}
          {activeTab === "profile" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                Profile Information
              </h4>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="settings-profile-name" className="block text-sm font-medium text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      id="settings-profile-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={profileData.name}
                      onChange={(e) => {
                        setProfileData({
                          ...profileData,
                          name: e.target.value,
                        });
                        profileValidation.validateSingleField(
                          "name",
                          e.target.value
                        );
                        profileValidation.setFieldTouched("name");
                      }}
                      className={`w-full px-4 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        profileValidation.getFieldError("name")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                    />
                    {profileValidation.getFieldError("name") && (
                      <p className="text-red-400 text-sm mt-1">
                        {profileValidation.getFieldError("name")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="settings-profile-email" className="block text-sm font-medium text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      id="settings-profile-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={profileData.email}
                      onChange={(e) => {
                        setProfileData({
                          ...profileData,
                          email: e.target.value,
                        });
                        profileValidation.validateSingleField(
                          "email",
                          e.target.value
                        );
                        profileValidation.setFieldTouched("email");
                      }}
                      className={`w-full px-4 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        profileValidation.getFieldError("email")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                    />
                    {profileValidation.getFieldError("email") && (
                      <p className="text-red-400 text-sm mt-1">
                        {profileValidation.getFieldError("email")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={saving === "profile"}
                    loadingText="Updating..."
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Update Profile
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                Change Password
              </h4>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label htmlFor="settings-current-password" className="block text-sm font-medium text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    id="settings-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={passwordData.currentPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      });
                      passwordValidation.validateSingleField(
                        "currentPassword",
                        e.target.value
                      );
                      passwordValidation.setFieldTouched("currentPassword");
                    }}
                    className={`w-full px-4 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      passwordValidation.getFieldError("currentPassword")
                        ? "border-red-500"
                        : "border-gray-600"
                    }`}
                    required
                  />
                  {passwordValidation.getFieldError("currentPassword") && (
                    <p className="text-red-400 text-sm mt-1">
                      {passwordValidation.getFieldError("currentPassword")}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="settings-new-password" className="block text-sm font-medium text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      id="settings-new-password"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={passwordData.newPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        });
                        passwordValidation.validateSingleField(
                          "newPassword",
                          e.target.value
                        );
                        passwordValidation.setFieldTouched("newPassword");
                      }}
                      className={`w-full px-4 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        passwordValidation.getFieldError("newPassword")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                      required
                    />
                    {passwordValidation.getFieldError("newPassword") && (
                      <p className="text-red-400 text-sm mt-1">
                        {passwordValidation.getFieldError("newPassword")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="settings-confirm-password" className="block text-sm font-medium text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="settings-confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => {
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        });
                        passwordValidation.validateSingleField(
                          "confirmPassword",
                          e.target.value
                        );
                        passwordValidation.setFieldTouched("confirmPassword");
                      }}
                      className={`w-full px-4 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        passwordValidation.getFieldError("confirmPassword")
                          ? "border-red-500"
                          : "border-gray-600"
                      }`}
                      required
                    />
                    {passwordValidation.getFieldError("confirmPassword") && (
                      <p className="text-red-400 text-sm mt-1">
                        {passwordValidation.getFieldError("confirmPassword")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={saving === "password"}
                    loadingText="Changing..."
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Change Password
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {/* Hardware Configuration */}
          {activeTab === "hardware" && user?.role === "admin" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                Hardware Configuration
              </h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="settings-rfid-port" className="block text-sm font-medium text-gray-300 mb-2">
                      RFID Scanner Port
                    </label>
                    <input
                      id="settings-rfid-port"
                      name="rfidScannerPort"
                      type="text"
                      value={hardwareSettings.rfidScannerPort}
                      onChange={(e) =>
                        setHardwareSettings({
                          ...hardwareSettings,
                          rfidScannerPort: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="COM3"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-proximity-threshold" className="block text-sm font-medium text-gray-300 mb-2">
                      Proximity Sensor Threshold
                    </label>
                    <div className="space-y-2">
                      <input
                        id="settings-proximity-threshold"
                        name="proximitySensorThreshold"
                        type="range"
                        min="1"
                        max="10"
                        value={hardwareSettings.proximitySensorThreshold}
                        onChange={(e) =>
                          setHardwareSettings({
                            ...hardwareSettings,
                            proximitySensorThreshold: parseInt(e.target.value),
                          })
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>1m</span>
                        <span className="text-cyan-400">
                          {hardwareSettings.proximitySensorThreshold}m
                        </span>
                        <span>10m</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      id="settings-dual-validation"
                      name="dualValidation"
                      type="checkbox"
                      checked={hardwareSettings.dualValidation}
                      onChange={(e) =>
                        setHardwareSettings({
                          ...hardwareSettings,
                          dualValidation: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                    />
                    <label htmlFor="settings-dual-validation" className="ml-2 block text-sm text-white">
                      Require dual validation (RFID + Proximity)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="settings-auto-reconnect"
                      name="autoReconnect"
                      type="checkbox"
                      checked={hardwareSettings.autoReconnect}
                      onChange={(e) =>
                        setHardwareSettings({
                          ...hardwareSettings,
                          autoReconnect: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                    />
                    <label htmlFor="settings-auto-reconnect" className="ml-2 block text-sm text-white">
                      Auto-reconnect on hardware failure
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Test Connection
                  </button>
                  <LoadingButton
                    onClick={handleHardwareSettingsSave}
                    loading={saving === "hardware"}
                    loadingText="Saving..."
                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Save Hardware Settings
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}

          {/* Email Notifications */}
          {activeTab === "email" && user?.role === "admin" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                Email Notifications
              </h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="settings-smtp-server" className="block text-sm font-medium text-gray-300 mb-2">
                      SMTP Server
                    </label>
                    <input
                      id="settings-smtp-server"
                      name="smtpServer"
                      type="text"
                      value={emailSettings.smtpServer}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          smtpServer: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-sender-email" className="block text-sm font-medium text-gray-300 mb-2">
                      Sender Email
                    </label>
                    <input
                      id="settings-sender-email"
                      name="senderEmail"
                      type="email"
                      value={emailSettings.senderEmail}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          senderEmail: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="clirdec.presence@clsu.edu.ph"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="settings-absence-threshold" className="block text-sm font-medium text-gray-300 mb-2">
                    Absence Threshold (consecutive days)
                  </label>
                  <select
                    id="settings-absence-threshold"
                    name="absenceThreshold"
                    value={emailSettings.absenceThreshold}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        absenceThreshold: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="1">1 consecutive day</option>
                    <option value="2">2 consecutive days</option>
                    <option value="3">3 consecutive days</option>
                    <option value="5">5 consecutive days</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      id="settings-daily-summary"
                      name="dailySummary"
                      type="checkbox"
                      checked={emailSettings.dailySummary}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          dailySummary: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                    />
                    <label htmlFor="settings-daily-summary" className="ml-2 block text-sm text-white">
                      Send daily attendance summary
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="settings-late-notifications"
                      name="lateNotifications"
                      type="checkbox"
                      checked={emailSettings.lateNotifications}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          lateNotifications: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                    />
                    <label htmlFor="settings-late-notifications" className="ml-2 block text-sm text-white">
                      Send notifications for late arrivals
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Test Email
                  </button>
                  <LoadingButton
                    onClick={handleEmailSettingsSave}
                    loading={saving === "email"}
                    loadingText="Saving..."
                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Save Email Settings
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === "system" && user?.role === "admin" && (
            <div>
              <h4 className="text-lg font-medium text-white mb-4">
                System Settings
              </h4>
              <div className="space-y-6">
                {/* Class Session Settings */}
                <div>
                  <h5 className="text-md font-medium text-cyan-400 mb-4">
                    Class Session Settings
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-auto-start-buffer" className="block text-sm font-medium text-gray-300 mb-1">
                        Auto-start Buffer (minutes)
                      </label>
                      <input
                        id="settings-auto-start-buffer"
                        name="autoStartBuffer"
                        type="number"
                        min="0"
                        max="60"
                        value={systemSettings.lateThreshold}
                        onChange={(e) =>
                          setSystemSettings({
                            ...systemSettings,
                            lateThreshold: parseInt(e.target.value) || 15,
                          })
                        }
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-late-threshold" className="block text-sm font-medium text-gray-300 mb-1">
                        Late Threshold (minutes)
                      </label>
                      <input
                        id="settings-late-threshold"
                        name="lateThreshold"
                        type="number"
                        min="1"
                        max="60"
                        value={systemSettings.lateThreshold}
                        onChange={(e) =>
                          setSystemSettings({
                            ...systemSettings,
                            lateThreshold: parseInt(e.target.value) || 15,
                          })
                        }
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Default: 15 minutes (as per paper)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-center">
                      <input
                        id="settings-auto-end-sessions"
                        name="autoEndSessions"
                        type="checkbox"
                        checked={systemSettings.emailNotifications}
                        onChange={(e) =>
                          setSystemSettings({
                            ...systemSettings,
                            emailNotifications: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                      />
                      <label htmlFor="settings-auto-end-sessions" className="ml-2 block text-sm text-white">
                        Auto-end sessions after scheduled time
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="settings-require-professor-tap"
                        name="requireProfessorTap"
                        type="checkbox"
                        checked={systemSettings.emailNotifications}
                        onChange={(e) =>
                          setSystemSettings({
                            ...systemSettings,
                            emailNotifications: e.target.checked,
                          })
                        }
                        className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-600 rounded bg-gray-700"
                      />
                      <label htmlFor="settings-require-professor-tap" className="ml-2 block text-sm text-white">
                        Require professor tap to activate session
                      </label>
                    </div>
                  </div>
                </div>

                {/* System Status Card */}
                <div>
                  <h5 className="text-md font-medium text-cyan-400 mb-4">
                    System Status
                  </h5>
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            Database
                          </p>
                          <p className="text-xs text-gray-400">Connected</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            RFID Scanner
                          </p>
                          <p className="text-xs text-gray-400">Active</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            Proximity Sensors
                          </p>
                          <p className="text-xs text-gray-400">2/3 active</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-1 rounded text-sm">
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Reset to Defaults
                  </button>
                  <LoadingButton
                    onClick={handleSystemSettingsSave}
                    loading={saving === "system"}
                    loadingText="Saving..."
                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Save Settings
                  </LoadingButton>
                </div>
              </div>
            </div>
          )}

          {activeTab === "audit" && user?.role === "admin" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-white">
                    Settings Audit Trail
                  </h4>
                  <p className="text-sm text-gray-400">
                    Recent changes to system, hardware, and email settings.
                  </p>
                </div>
                <button
                  onClick={() => setAuditReloadKey((key) => key + 1)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      {["When", "Category", "User", "IP Address", "Changed Values"].map(
                        (column) => (
                          <th
                            key={column}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                          >
                            {column}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {auditLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-sm text-gray-400"
                        >
                          Loading audit events...
                        </td>
                      </tr>
                    ) : settingsAuditEvents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-sm text-gray-400"
                        >
                          No settings changes have been logged yet.
                        </td>
                      </tr>
                    ) : (
                      settingsAuditEvents.map((event) => (
                        <tr key={event.id}>
                          <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                            {new Date(event.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-cyan-300 capitalize">
                            {event.resourceId || "settings"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {event.userId ? `User #${event.userId}` : "System"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {event.ipAddress || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {Object.keys(event.newValues || {}).join(", ") || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

