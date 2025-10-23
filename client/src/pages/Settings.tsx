import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../components/NotificationSystem";
import { LoadingButton } from "../components/LoadingSpinner";
import {
  useFormValidation,
  commonValidationRules,
} from "../hooks/useFormValidation";
import { api } from "../lib/api";

export const Settings = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState("profile");

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
  const [systemSettings, setSystemSettings] = useState({
    lateThreshold: 15, // Default: 15 minutes as per paper
    absentThreshold: 60, // Default: 60% of class time as per paper
    emailNotifications: true,
    semester: "1st Semester",
    academicYear: new Date().getFullYear().toString(),
  });

  const [hardwareSettings, setHardwareSettings] = useState({
    rfidScannerPort: "COM3",
    proximitySensorThreshold: 5,
    dualValidation: true,
    autoReconnect: true,
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpServer: "smtp.gmail.com",
    senderEmail: "clirdec.presence@clsu.edu.ph",
    absenceThreshold: 3,
    dailySummary: true,
    lateNotifications: true,
  });

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

    try {
      const response = await api.updateProfile(profileData);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Profile Updated",
          message: "Your profile has been updated successfully!",
        });
      } else {
        addNotification({
          type: "error",
          title: "Update Failed",
          message: response.message || "Failed to update profile",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Error",
        message:
          err.data?.message || "An error occurred while updating profile",
      });
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
      const response = await api.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.success) {
        addNotification({
          type: "success",
          title: "Password Changed",
          message: "Your password has been changed successfully!",
        });
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        passwordValidation.clearErrors();
      } else {
        addNotification({
          type: "error",
          title: "Password Change Failed",
          message: response.message || "Failed to change password",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Error",
        message:
          err.data?.message || "An error occurred while changing password",
      });
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "hardware", label: "Hardware", icon: "🔧" },
    { id: "email", label: "Email", icon: "📧" },
    { id: "system", label: "System", icon: "⚙️" },
  ];

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
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
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
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
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
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
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
                    loading={false}
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
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
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
                    className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
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
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
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
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
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
                      className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
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
                    loading={false}
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      RFID Scanner Port
                    </label>
                    <input
                      type="text"
                      value={hardwareSettings.rfidScannerPort}
                      onChange={(e) =>
                        setHardwareSettings({
                          ...hardwareSettings,
                          rfidScannerPort: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="COM3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Proximity Sensor Threshold
                    </label>
                    <div className="space-y-2">
                      <input
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
                    <label className="ml-2 block text-sm text-white">
                      Require dual validation (RFID + Proximity)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
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
                    <label className="ml-2 block text-sm text-white">
                      Auto-reconnect on hardware failure
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Test Connection
                  </button>
                  <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Save Hardware Settings
                  </button>
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SMTP Server
                    </label>
                    <input
                      type="text"
                      value={emailSettings.smtpServer}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          smtpServer: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sender Email
                    </label>
                    <input
                      type="email"
                      value={emailSettings.senderEmail}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          senderEmail: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="clirdec.presence@clsu.edu.ph"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Absence Threshold (consecutive days)
                  </label>
                  <select
                    value={emailSettings.absenceThreshold}
                    onChange={(e) =>
                      setEmailSettings({
                        ...emailSettings,
                        absenceThreshold: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                    <label className="ml-2 block text-sm text-white">
                      Send daily attendance summary
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
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
                    <label className="ml-2 block text-sm text-white">
                      Send notifications for late arrivals
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Test Email
                  </button>
                  <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Save Email Settings
                  </button>
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
                  <h5 className="text-md font-medium text-cyan-400 mb-3">
                    Class Session Settings
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Auto-start Buffer (minutes)
                      </label>
                      <input
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
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Late Threshold (minutes)
                      </label>
                      <input
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
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Default: 15 minutes (as per paper)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-center">
                      <input
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
                      <label className="ml-2 block text-sm text-white">
                        Auto-end sessions after scheduled time
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
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
                      <label className="ml-2 block text-sm text-white">
                        Require professor tap to activate session
                      </label>
                    </div>
                  </div>
                </div>

                {/* System Status Card */}
                <div>
                  <h5 className="text-md font-medium text-cyan-400 mb-3">
                    System Status
                  </h5>
                  <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            Database
                          </p>
                          <p className="text-xs text-gray-400">Connected</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            RFID Scanner
                          </p>
                          <p className="text-xs text-gray-400">Active</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
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
                      <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Reset to Defaults
                  </button>
                  <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
