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
    emailNotifications: true,
    darkMode: false,
    language: "en",
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

  const handleSystemSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await api.updateUserSettings(systemSettings);
      if (response.success) {
        addNotification({
          type: "success",
          title: "Settings Updated",
          message: "Your settings have been updated successfully!",
        });
      } else {
        addNotification({
          type: "error",
          title: "Update Failed",
          message: response.message || "Failed to update settings",
        });
      }
    } catch (err: any) {
      addNotification({
        type: "error",
        title: "Error",
        message:
          err.data?.message || "An error occurred while updating settings",
      });
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "system", label: "System", icon: "⚙️" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Settings</h3>
        <p className="text-sm text-gray-500">
          Manage your account and system preferences
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
              <h4 className="text-lg font-medium mb-4">Profile Information</h4>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        profileValidation.getFieldError("name")
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {profileValidation.getFieldError("name") && (
                      <p className="text-red-600 text-sm mt-1">
                        {profileValidation.getFieldError("name")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        profileValidation.getFieldError("email")
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {profileValidation.getFieldError("email") && (
                      <p className="text-red-600 text-sm mt-1">
                        {profileValidation.getFieldError("email")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
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
              <h4 className="text-lg font-medium mb-4">Change Password</h4>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      passwordValidation.getFieldError("currentPassword")
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    required
                  />
                  {passwordValidation.getFieldError("currentPassword") && (
                    <p className="text-red-600 text-sm mt-1">
                      {passwordValidation.getFieldError("currentPassword")}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        passwordValidation.getFieldError("newPassword")
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      required
                    />
                    {passwordValidation.getFieldError("newPassword") && (
                      <p className="text-red-600 text-sm mt-1">
                        {passwordValidation.getFieldError("newPassword")}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        passwordValidation.getFieldError("confirmPassword")
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      required
                    />
                    {passwordValidation.getFieldError("confirmPassword") && (
                      <p className="text-red-600 text-sm mt-1">
                        {passwordValidation.getFieldError("confirmPassword")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Change Password
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {/* System Settings */}
          {activeTab === "system" && (
            <div>
              <h4 className="text-lg font-medium mb-4">System Preferences</h4>
              <form onSubmit={handleSystemSettingsUpdate} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Dark Mode
                      </label>
                      <p className="text-sm text-gray-500">
                        Enable dark theme for the interface
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemSettings.darkMode}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          darkMode: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      value={systemSettings.language}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          language: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Save Settings
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === "notifications" && (
            <div>
              <h4 className="text-lg font-medium mb-4">
                Notification Preferences
              </h4>
              <form onSubmit={handleSystemSettingsUpdate} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Email Notifications
                      </label>
                      <p className="text-sm text-gray-500">
                        Receive email notifications for attendance events
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={systemSettings.emailNotifications}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          emailNotifications: e.target.checked,
                        })
                      }
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <LoadingButton
                    type="submit"
                    loading={false}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Save Preferences
                  </LoadingButton>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
